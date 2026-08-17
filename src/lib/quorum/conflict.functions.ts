import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PlanConflict = {
  id: string;
  kind: string;
  detail: string | null;
  profile_id: string | null;
  created_at: string;
};

/** Open conflicts for a plan plus the AI/Geoapify alternatives on the ballot. */
export const getPlanConflicts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { planId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: allowed } = await supabase.rpc("can_see_plan", { _plan_id: data.planId });
    if (!allowed) throw new Error("Forbidden");
    const { data: conflicts } = await supabase
      .from("plan_conflicts")
      .select("id, kind, detail, profile_id, created_at")
      .eq("plan_id", data.planId)
      .eq("resolved", false)
      .order("created_at", { ascending: false });
    return { conflicts: (conflicts ?? []) as PlanConflict[] };
  });

/**
 * One-tap "this doesn't work for me", or an automatic constraint sweep.
 * Either way the plan auto-pivots: alternatives are generated and everyone is
 * pushed a quick re-vote.
 */
export const flagConflict = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { planId: string; kind?: "curfew" | "budget" | "distance" | "manual"; detail?: string }) =>
      d,
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: allowed } = await supabase.rpc("can_see_plan", { _plan_id: data.planId });
    if (!allowed) throw new Error("Forbidden");
    const { data: me } = await supabase.rpc("my_profile_id");

    const { error } = await supabase.from("plan_conflicts").insert({
      plan_id: data.planId,
      profile_id: (me as string | null) ?? null,
      kind: data.kind ?? "manual",
      detail: data.detail?.slice(0, 200) ?? "A member flagged that this doesn't work for them",
    });
    if (error) throw new Error(error.message);

    const { detectConflicts, generateAlternatives } = await import("./conflict.server");
    await detectConflicts(data.planId);
    const result = await generateAlternatives(data.planId);
    return { ok: true, alternatives: result.created };
  });

/** Runs the automatic constraint sweep (curfew / budget / distance). */
export const runConflictSweep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { planId: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: allowed } = await context.supabase.rpc("can_see_plan", { _plan_id: data.planId });
    if (!allowed) throw new Error("Forbidden");
    const { detectConflicts, generateAlternatives } = await import("./conflict.server");
    const found = await detectConflicts(data.planId);
    const alt = found.length ? await generateAlternatives(data.planId) : { created: 0 };
    return { conflicts: found.length, alternatives: alt.created };
  });

/**
 * One-tap resolution vote. When a majority of attending members land on the
 * same option the plan locks itself in and the conflicts close.
 */
export const castResolutionVote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { planId: string; recommendationId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: me } = await supabase.rpc("my_profile_id");
    if (!me) throw new Error("Profile missing");
    const { error } = await supabase
      .from("votes")
      .upsert(
        { plan_id: data.planId, profile_id: me, recommendation_id: data.recommendationId },
        { onConflict: "plan_id,profile_id" },
      );
    if (error) throw new Error(error.message);

    const { data: parts } = await supabase
      .from("plan_participants")
      .select("profile_id, attending")
      .eq("plan_id", data.planId);
    const attending = (parts ?? []).filter((p) => p.attending !== false).length;
    const { data: votes } = await supabase
      .from("votes")
      .select("recommendation_id")
      .eq("plan_id", data.planId);
    const tally = new Map<string, number>();
    for (const v of votes ?? []) {
      tally.set(v.recommendation_id, (tally.get(v.recommendation_id) ?? 0) + 1);
    }
    const forThis = tally.get(data.recommendationId) ?? 0;
    const majority = Math.max(1, Math.ceil(attending / 2));

    if (forThis >= majority) {
      await supabase
        .from("plans")
        .update({ status: "finalized", selected_recommendation_id: data.recommendationId })
        .eq("id", data.planId);
      await supabase
        .from("plan_conflicts")
        .update({ resolved: true })
        .eq("plan_id", data.planId)
        .eq("resolved", false);
      await supabase.from("activity_events").insert({
        plan_id: data.planId,
        type: "plan_finalized",
        message: "The group agreed on an adjusted option — the plan is locked in",
      });
      const { notifyPlanParticipants } = await import("./notify.server");
      await notifyPlanParticipants(data.planId, {
        type: "plan_finalized",
        title: "Adjusted plan locked in",
        body: "Everyone's timeline has been updated.",
      });
      return { ok: true, locked: true, votes: forThis, needed: majority };
    }
    return { ok: true, locked: false, votes: forThis, needed: majority };
  });

/** 1-tap attendance confirmation straight from the dashboard timeline. */
export const confirmAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { planId: string; attending: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: me } = await supabase.rpc("my_profile_id");
    if (!me) throw new Error("Profile missing");
    const { error } = await supabase
      .from("plan_participants")
      .update({ attending: data.attending, responded: true })
      .eq("plan_id", data.planId)
      .eq("profile_id", me);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
