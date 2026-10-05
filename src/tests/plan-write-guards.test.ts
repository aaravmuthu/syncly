import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertPlanOpen } from "@/lib/quorum/plan-lifecycle.server";
import { PLAN_END_GRACE_MS } from "@/lib/quorum/plan-time";

const { read } = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: read }) }) }),
  },
}));

describe("plan writes cannot depend on the next background sweep", () => {
  beforeEach(() => read.mockReset());
  it("rejects an expired plan even while its stored status still says voting", async () => {
    read.mockResolvedValue({
      data: {
        status: "voting",
        window_start: null,
        window_end: new Date(Date.now() - PLAN_END_GRACE_MS - 60_000).toISOString(),
      },
      error: null,
    });
    await expect(assertPlanOpen("plan")).rejects.toThrow("already ended");
  });
  it("allows a live plan and an unscheduled draft", async () => {
    read.mockResolvedValue({
      data: {
        status: "collecting",
        window_start: new Date(Date.now() + 3600_000).toISOString(),
        window_end: null,
      },
      error: null,
    });
    await expect(assertPlanOpen("plan")).resolves.toBeUndefined();
    read.mockResolvedValue({
      data: { status: "draft", window_start: null, window_end: "2020-01-01T00:00:00Z" },
      error: null,
    });
    await expect(assertPlanOpen("draft")).resolves.toBeUndefined();
  });
  it("rejects a missing plan", async () => {
    read.mockResolvedValue({ data: null, error: null });
    await expect(assertPlanOpen("missing")).rejects.toThrow("Plan not found");
  });
  it("does not permit writes when the lifecycle read fails", async () => {
    read.mockResolvedValue({ data: null, error: { code: "08006", message: "Connection failure" } });
    await expect(assertPlanOpen("plan")).rejects.toThrow();
  });
});
