import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated;
    create table plans(id int primary key,title text,category text,window_start timestamptz,window_end timestamptz,itinerary jsonb,selected_recommendation_id int,location_area text,est_cost_min numeric,est_cost_max numeric,status text);
    create table parent_approvals(plan_id int, status text, responded_at timestamptz, decided_via text, condition_text text);`);
  await db.exec(
    await readFile(
      new URL(
        "../../supabase/migrations/20261012040000_invalidate_changed_plan_approvals.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec(`truncate plans,parent_approvals;
    insert into plans values(1,'Dinner','dinner','2030-10-12T23:00:00Z','2030-10-13T01:00:00Z',null,1,'Town',10,20,'finalized');
    insert into parent_approvals values(1,'approved',now(),'guardian','Home by 10');`);
});
describe.sequential("approval belongs to the reviewed plan", () => {
  it.each([
    "window_start=window_start+interval '1 hour'",
    "window_end=window_end+interval '1 hour'",
    "selected_recommendation_id=2",
    "itinerary='{}'",
    "est_cost_max=40",
    "location_area='Other town'",
  ])("requires fresh review when %s", async (change) => {
    await db.exec(`update plans set ${change} where id=1`);
    expect((await db.query("select * from parent_approvals")).rows[0]).toMatchObject({
      status: "pending",
      responded_at: null,
      decided_via: "guardian",
      condition_text: "Home by 10",
    });
  });
  it("does not invalidate an unchanged plan or a lifecycle-only update", async () => {
    await db.exec("update plans set title=title,status='completed'");
    expect(
      (await db.query<{ status: string }>("select status from parent_approvals")).rows[0].status,
    ).toBe("approved");
  });
  it("rolls the plan edit back if approval invalidation fails", async () => {
    await db.exec(
      "alter table parent_approvals add constraint fixture_failure check(status<>'pending')",
    );
    try {
      await expect(db.exec("update plans set selected_recommendation_id=2")).rejects.toThrow(
        "fixture_failure",
      );
      expect(
        (
          await db.query<{ selected_recommendation_id: number }>(
            "select selected_recommendation_id from plans",
          )
        ).rows[0].selected_recommendation_id,
      ).toBe(1);
    } finally {
      await db.exec("alter table parent_approvals drop constraint fixture_failure");
    }
  });
});
