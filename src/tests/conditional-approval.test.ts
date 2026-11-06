import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  apply: vi.fn(),
  regenerate: vi.fn(),
  notify: vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = { inputValidator: () => builder, handler: (handler: unknown) => handler };
    return builder;
  },
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      let patch: Record<string, unknown> | undefined;
      let id: string | undefined;
      const query = {
        select: () => query,
        eq: (column: string, value: string) => {
          if (column === "id") id = value;
          return query;
        },
        maybeSingle: async () => ({
          data: {
            id: "parent", plan_id: "1", profile_id: "child", status: "pending",
            expires_at: "2099-01-01T00:00:00Z", decided_via: "link",
          },
        }),
        update: (value: Record<string, unknown>) => { patch = value; return query; },
        insert: async () => ({ error: null }),
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
          const run = async () => {
            if (table === "parent_approvals" && patch) {
              await mocks.query(
                "update parent_approvals set status=$1,condition_text=$2,responded_at=$3,decided_via=$4 where id=$5",
                [patch.status, patch.condition_text, patch.responded_at, patch.decided_via, id],
              );
            }
            return { error: null };
          };
          return run().then(resolve, reject);
        },
      };
      return query;
    },
  },
}));
vi.mock("@/lib/quorum/recommend.server", () => ({
  applyParentCondition: mocks.apply,
  regenerateRecommendations: mocks.regenerate,
}));
vi.mock("@/lib/quorum/notify.server", () => ({ notifyProfiles: mocks.notify }));
import { respondToApproval } from "@/lib/quorum/approval.functions";

const respond = respondToApproval as unknown as (input: {
  data: { token: string; decision: "approved_with_condition"; condition: string };
}) => Promise<unknown>;
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated;
    create table plans(id int primary key,title text,category text,window_start timestamptz,window_end timestamptz,itinerary jsonb,selected_recommendation_id int,location_area text,est_cost_min numeric,est_cost_max numeric,status text);
    create table parent_approvals(id text primary key,plan_id int,status text,responded_at timestamptz,decided_via text,condition_text text);`);
  await db.exec(await readFile(new URL(
    "../../supabase/migrations/20261012040000_invalidate_changed_plan_approvals.sql", import.meta.url,
  ), "utf8"));
}, 30000);
afterAll(async () => { await db?.close(); });
beforeEach(async () => {
  vi.resetAllMocks();
  mocks.query.mockImplementation((sql, params) => db.query(sql, params));
  mocks.regenerate.mockImplementation(async () => {
    await db.exec("update plans set selected_recommendation_id=null,status='collecting'; update plans set status='voting'");
  });
  await db.exec(`truncate plans,parent_approvals;
    insert into plans values(1,'Dinner','dinner',null,null,null,7,'Town',10,20,'finalized');
    insert into parent_approvals values('parent',1,'pending',null,'link',null),('other',1,'approved',now(),'guardian',null);`);
});

describe.sequential("conditional decisions survive the real approval-invalidation trigger", () => {
  it("keeps the new answer, condition and response time after replacing a selected option", async () => {
    mocks.notify.mockImplementation(async () => {
      const result = await db.query("select status from parent_approvals where id='parent'");
      expect(result.rows[0]).toMatchObject({ status: "approved_with_condition" });
    });
    await respond({ data: { token: "fixture", decision: "approved_with_condition", condition: "Home by 10pm" } });
    const result = await db.query("select * from parent_approvals where id='parent'");
    expect(result.rows[0]).toMatchObject({ status: "approved_with_condition", condition_text: "Home by 10pm", decided_via: "link" });
    expect(result.rows[0].responded_at).not.toBeNull();
    expect(mocks.apply).toHaveBeenCalledWith("1", "child", "Home by 10pm");
    expect(mocks.notify).toHaveBeenCalledOnce();
    // Other answers covered the old chosen option, not newly generated ones.
    expect((await db.query("select status from parent_approvals where id='other'")).rows[0]).toMatchObject({ status: "pending" });
  });
  it("still saves the conditional answer if recalculation fails after clearing selection", async () => {
    mocks.regenerate.mockImplementation(async () => {
      await db.exec("update plans set selected_recommendation_id=null,status='collecting'");
      throw new Error("Venue service unavailable");
    });
    await expect(respond({ data: { token: "fixture", decision: "approved_with_condition", condition: "Stay with 3 friends" } })).resolves.toEqual({ ok: true });
    expect((await db.query("select status,condition_text from parent_approvals where id='parent'")).rows[0]).toMatchObject({ status: "approved_with_condition", condition_text: "Stay with 3 friends" });
  });
});