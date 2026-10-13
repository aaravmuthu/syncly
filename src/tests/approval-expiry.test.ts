import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn(), rows: {} as Record<string, unknown> }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = { inputValidator: () => builder, handler: (handler: unknown) => handler };
    return builder;
  },
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      mocks.from(table);
      const result = () => ({ data: mocks.rows[table] ?? [], error: null });
      const query = {
        select: () => query,
        eq: () => query,
        single: async () => result(),
        maybeSingle: async () => result(),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve),
      };
      return query;
    },
  },
}));
import { getApproval, respondToApproval } from "@/lib/quorum/approval.functions";
const read = getApproval as unknown as (input: { data: { token: string } }) => Promise<unknown>;
const respond = respondToApproval as unknown as (input: {
  data: { token: string; decision: string };
}) => Promise<unknown>;
const now = new Date("2026-10-12T12:00:00Z");
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  mocks.from.mockClear();
  mocks.rows = {
    parent_approvals: {
      id: "approval",
      status: "pending",
      expires_at: "2026-10-12T13:00:00Z",
      plan_id: "plan",
      profile_id: "child",
    },
    plans: {
      title: "Dinner",
      category: "dinner",
      window_start: null,
      selected_recommendation_id: null,
    },
    profiles: { display_name: "Child" },
    transport_assignments: [],
  };
});
afterEach(() => vi.useRealTimers());
describe("public approval credentials expire for reads as well as decisions", () => {
  it.each(["2026-10-12T11:59:59Z", "2026-10-12T12:00:00Z", "invalid"])(
    "does not disclose plan/child details for expiration %s",
    async (expires_at) => {
      mocks.rows.parent_approvals = { ...(mocks.rows.parent_approvals as object), expires_at };
      expect(await read({ data: { token: "fixture" } })).toBeNull();
      expect(mocks.from.mock.calls).toEqual([["parent_approvals"]]);
      await expect(respond({ data: { token: "fixture", decision: "approved" } })).rejects.toThrow(
        "expired",
      );
    },
  );
  it("still returns the intended logistics for a live link", async () => {
    expect(await read({ data: { token: "fixture" } })).toMatchObject({
      planTitle: "Dinner",
      childName: "Child",
    });
  });
});
