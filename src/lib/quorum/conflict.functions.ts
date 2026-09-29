import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as v from "./schemas";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { dbError } from "@/lib/db-error";

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
  .inputValidator(z.object({ planId: v.id }))
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
export type ConflictReason = "budget" | "curfew" | "distance" | "schedule" | "manual";

/** Quick-pill copy for the 1-tap "doesn't work for me" overlay. */
export const CONFLICT_REASONS: { id: ConflictReason; label: string; detail: string }[] = [
  { id: "budget", label: "Too Expensive", detail: "This is over someone's budget" },
  { id: "curfew", label: "Past Curfew", detail: "This runs past someone's curfew" },
  { id: "distance", label: "Too Far", detail: "This is outside someone's travel range" },
  { id: "schedule", label: "Time Conflict", detail: "Someone is busy at this time" },
];

/**
 * One-tap "this doesn't work for me". No forms: a single reason pill records
 * the flag, pings the host, and auto-pivots the plan with fresh alternatives.
 */
export const flagConflict = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      planId: v.id,
      kind: z.enum(["budget", "curfew", "distance", "schedule", "manual"]).optional(),
      detail: v.text(500).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: allowed } = await supabase.rpc("can_see_plan", { _plan_id: data.planId });
    if (!allowed) throw new Error("Forbidden");
    const { data: me } = await supabase.rpc("my_profile_id");
    const kind = data.kind ?? "manual";
    const preset = CONFLICT_REASONS.find((r) => r.id === kind);

    const { error } = await supabase.from("plan_conflicts").insert({
      plan_id: data.planId,
      profile_id: (me as string | null) ?? null,
      kind,
      detail:
        data.detail?.slice(0, 200) ??
        preset?.detail ??
        "A member flagged that this doesn't work for them",
    });
    if (error) throw dbError(error, "flagConflict");

    // The flag also means "I'm not locked in" until the group re-votes.
    if (me) {
      await supabase
        .from("plan_participants")
        .update({ responded: true, attending: false })
        .eq("plan_id", data.planId)
        .eq("profile_id", me as string);
    }

    const { detectConflicts, generateAlternatives } = await import("./conflict.server");
    await detectConflicts(data.planId);
    const result = await generateAlternatives(data.planId);

    // Ping the host directly — budget flags ask them to adjust the estimate.
    const { data: plan } = await supabase
      .from("plans")
      .select("created_by, title, est_cost_min, est_cost_max")
      .eq("id", data.planId)
      .maybeSingle();
    if (plan?.created_by) {
      const { notifyProfiles } = await import("./notify.server");
      const budgetNote =
        kind === "budget"
          ? plan.est_cost_max != null
            ? `Your $${Math.round(Number(plan.est_cost_max))}/person estimate is too high for someone — cheaper options are on the ballot.`
            : "Someone needs a cheaper option — cheaper picks are on the ballot."
          : null;
      await notifyProfiles([plan.created_by], {
        type: "conflict_flagged",
        title: `${preset?.label ?? "Doesn't work"} · ${plan.title}`,
        body:
          budgetNote ??
          (result.created
            ? `${result.created} adjusted options are up for a quick re-vote.`
            : "A member flagged this plan."),
        planId: data.planId,
      });
    }

    return { ok: true, alternatives: result.created, kind };
  });

/** Runs the automatic constraint sweep (curfew / budget / distance). */
export const runConflictSweep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ planId: v.id }))
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
  .inputValidator(z.object({ planId: v.id, recommendationId: v.id }))
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
    if (error) throw dbError(error, "castResolutionVote");

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
      // Plan status is server-managed; the vote above already passed the
      // votes RLS (can_see_plan), so lock in through the service role.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: option } = await supabaseAdmin
        .from("recommendations")
        .select("id")
        .eq("id", data.recommendationId)
        .eq("plan_id", data.planId)
        .maybeSingle();
      if (!option) throw new Error("That option isn't on this plan");
      await supabaseAdmin
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
  .inputValidator(z.object({ planId: v.id, attending: z.boolean() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: me } = await supabase.rpc("my_profile_id");
    if (!me) throw new Error("Profile missing");
    const { error } = await supabase
      .from("plan_participants")
      .update({ attending: data.attending, responded: true })
      .eq("plan_id", data.planId)
      .eq("profile_id", me);
    if (error) throw dbError(error, "confirmAttendance");
    return { ok: true };
  });
