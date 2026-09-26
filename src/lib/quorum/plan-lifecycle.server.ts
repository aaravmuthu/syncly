/**
 * Moves plans out of their live statuses once their time has passed. Nothing
 * else ever writes `completed`, so without this a locked-in plan read
 * "Happening now" and an unlocked one "Voting active" forever.
 *
 * A plan is over at `window_end`, or `window_start` + END_GRACE_MS when no end
 * was set. Locked-in plans become `completed`; plans that never locked in
 * become `cancelled` (the only terminal state for "didn't happen"). Drafts are
 * left alone -- they were never scheduled.
 */

const END_GRACE_MS = 4 * 60 * 60 * 1000;
const THROTTLE_MS = 60 * 1000;
const LIVE = ["collecting", "recommending", "voting"] as const;

let lastRun = 0;

export async function settlePastPlans() {
  const now = Date.now();
  if (now - lastRun < THROTTLE_MS) return;
  lastRun = now;

  try {
    await sweep(now);
  } catch (e) {
    // Best-effort: a failed sweep must never break the read that triggered it.
    lastRun = 0;
    console.error("settlePastPlans:", e);
  }
}

async function sweep(now: number) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const ended = `window_end.lt.${new Date(now).toISOString()},and(window_end.is.null,window_start.lt.${new Date(now - END_GRACE_MS).toISOString()})`;

  const results = await Promise.all([
    supabaseAdmin.from("plans").update({ status: "completed" }).eq("status", "finalized").or(ended),
    supabaseAdmin
      .from("plans")
      .update({ status: "cancelled" })
      .in("status", [...LIVE])
      .or(ended),
  ]);
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);
}

/** Rejects writes to a plan that has ended, so a stale tab can't reopen it. */
export async function assertPlanOpen(planId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("plans")
    .select("status")
    .eq("id", planId)
    .maybeSingle();
  if (data?.status === "completed" || data?.status === "cancelled") {
    throw new Error("This plan has already ended");
  }
}
