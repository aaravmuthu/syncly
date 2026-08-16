// Server-only. Reads private constraints with elevated access, aggregates them,
// and writes back only group-safe results (scores, generic reasons, transport).
import { optionsForCategory } from "./catalog";
import { normalizeZip, queryVenuesNear } from "./location";
import { geocodeZipServer } from "./location.server";
import { buildTransportPlan, rankOptions, type MemberInput } from "./engine";
import type { ConstraintPayload, PlanCategory } from "./types";

export async function regenerateRecommendations(planId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: plan } = await supabaseAdmin.from("plans").select("*").eq("id", planId).single();
  if (!plan) throw new Error("Plan not found");

  const { data: participants } = await supabaseAdmin
    .from("plan_participants")
    .select("profile_id, attending, profiles(display_name)")
    .eq("plan_id", planId);
  const { data: constraintRows } = await supabaseAdmin
    .from("plan_constraints")
    .select("profile_id, payload")
    .eq("plan_id", planId);

  const constraintsFor = (profileId: string) =>
    ((constraintRows ?? []).find((c) => c.profile_id === profileId)?.payload as ConstraintPayload) ?? {};

  const attending = (participants ?? []).filter((p) => p.attending !== false);
  const members: MemberInput[] = attending.map((p) => ({
    profileId: p.profile_id,
    constraints: constraintsFor(p.profile_id),
  }));

  // ---- Live, ZIP-anchored venue discovery (keyless) ------------------------
  // The plan's ZIP wins; otherwise fall back to any attending member's home ZIP.
  const { data: profileRows } = await supabaseAdmin
    .from("profiles")
    .select("id, zip_code")
    .in("id", attending.length ? attending.map((p) => p.profile_id) : ["00000000-0000-0000-0000-000000000000"]);

  const memberZip = (profileRows ?? []).map((r) => normalizeZip(r.zip_code)).find(Boolean) ?? null;
  const constraintZip = members.map((m) => normalizeZip(m.constraints.zipCode)).find(Boolean) ?? null;
  const zip = normalizeZip(plan.location_area) ?? constraintZip ?? memberZip;

  const numbers = (vals: (number | null | undefined)[]) => vals.filter((v): v is number => v != null);
  const radii = numbers(members.map((m) => m.constraints.maxDistanceMiles));
  const budgets = numbers(members.map((m) => m.constraints.maxSpend ?? m.constraints.maxTicketPrice));

  const origin = zip ? await geocodeZipServer(zip) : null;
  const options = origin
    ? queryVenuesNear({
        origin,
        category: plan.category as PlanCategory,
        maxRadiusMiles: radii.length ? Math.min(...radii) : null,
        maxBudget: budgets.length ? Math.min(...budgets) : null,
      })
    : optionsForCategory(plan.category as PlanCategory);

  const ranked = rankOptions(options, members).slice(0, 6);

  await supabaseAdmin.from("recommendations").delete().eq("plan_id", planId);
  const { data: inserted, error } = await supabaseAdmin
    .from("recommendations")
    .insert(
      ranked.map((r, i) => ({
        plan_id: planId,
        rank: i + 1,
        title: r.option.title,
        subtitle: r.option.subtitle,
        category: plan.category,
        cost_min: r.option.costMin,
        cost_max: r.option.costMax,
        travel_minutes: r.option.travelMinutes,
        suggested_start: r.option.start,
        suggested_end: r.option.end,
        location_name: r.option.location,
        tags: r.option.tags,
        score: r.score,
        feasible: r.feasible,
        breakdown: r.breakdown as never,
      })),
    )
    .select("id, feasible");
  if (error) throw new Error(error.message);

  const best = ranked[0];
  const stillFinalizable = plan.status === "finalized" && ranked.some((r) => r.feasible);
  await supabaseAdmin
    .from("plans")
    .update({
      status: plan.status === "finalized" && stillFinalizable ? "finalized" : "voting",
      compatibility_score: best?.score ?? null,
      ...(plan.status === "finalized" && !stillFinalizable ? { selected_recommendation_id: null } : {}),
    })
    .eq("id", planId);

  await supabaseAdmin.from("transport_assignments").delete().eq("plan_id", planId);
  if (best) {
    const named = attending.map((p) => ({
      profileId: p.profile_id,
      name: (p.profiles as { display_name?: string } | null)?.display_name ?? "Member",
      constraints: constraintsFor(p.profile_id),
    }));
    const tp = buildTransportPlan(best.option, named);
    if (tp.cars.length) {
      await supabaseAdmin.from("transport_assignments").insert(
        tp.cars.map((c) => ({
          plan_id: planId,
          car_label: c.label,
          driver_label: c.driver,
          passenger_profile_ids: named
            .filter((n) => c.passengers.includes(n.name))
            .map((n) => n.profileId),
          leg: "both",
        })),
      );
    }
  }

  await supabaseAdmin.from("activity_events").insert({
    plan_id: planId,
    group_id: plan.group_id,
    type: "recommendations_ready",
    message: "Compatible options are ready to review",
  });

  return { count: inserted?.length ?? 0, feasible: ranked.filter((r) => r.feasible).length };
}

/**
 * Adds a parent's condition to that member's PRIVATE constraints. The condition
 * text never becomes group-visible — it only changes what the engine considers
 * feasible.
 */
export async function applyParentCondition(planId: string, profileId: string, condition: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row } = await supabaseAdmin
    .from("plan_constraints")
    .select("payload")
    .eq("plan_id", planId)
    .eq("profile_id", profileId)
    .maybeSingle();

  const payload = ((row?.payload as ConstraintPayload) ?? {}) as ConstraintPayload;
  const existing = payload.parentConditions ?? [];
  if (!existing.includes(condition)) {
    payload.parentConditions = [...existing, condition];
  }
  await supabaseAdmin
    .from("plan_constraints")
    .upsert(
      { plan_id: planId, profile_id: profileId, payload: payload as never },
      { onConflict: "plan_id,profile_id" },
    );
}
