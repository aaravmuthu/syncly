// Server-only conflict detection + auto-pivot. Reads private constraints with
// elevated access, but only ever writes group-safe copy (never names why a
// specific member's private answer failed beyond their own explicit flag).
import type { ConstraintPayload, PlanCategory } from "./types";

export type ConflictRow = {
  kind: "curfew" | "budget" | "distance" | "manual";
  detail: string;
  profileId: string | null;
};

const toMin = (v: string) => {
  const [h, m] = v.split(":");
  return Number(h) * 60 + Number(m ?? 0);
};

/**
 * Compares the plan's current pick against every member's saved defaults and
 * private answers. Returns the conflicts found (also written to plan_conflicts).
 */
export async function detectConflicts(planId: string): Promise<ConflictRow[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: plan } = await supabaseAdmin
    .from("plans")
    .select("*")
    .eq("id", planId)
    .maybeSingle();
  if (!plan) return [];

  const { data: recs } = await supabaseAdmin
    .from("recommendations")
    .select("*")
    .eq("plan_id", planId)
    .order("rank");
  const pick =
    (recs ?? []).find((r) => r.id === plan.selected_recommendation_id) ?? (recs ?? [])[0] ?? null;
  if (!pick) return [];

  const { data: parts } = await supabaseAdmin
    .from("plan_participants")
    .select("profile_id, attending")
    .eq("plan_id", planId);
  const ids = (parts ?? []).filter((p) => p.attending !== false).map((p) => p.profile_id);
  if (!ids.length) return [];

  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, display_name, curfew_time")
    .in("id", ids);
  const { data: constraintRows } = await supabaseAdmin
    .from("plan_constraints")
    .select("profile_id, payload")
    .eq("plan_id", planId);

  const found: ConflictRow[] = [];
  const end = pick.suggested_end ? toMin(String(pick.suggested_end).slice(0, 5)) : null;
  const travel = pick.travel_minutes ?? 0;
  const cost = Number(pick.cost_max ?? pick.cost_min ?? 0);

  for (const id of ids) {
    const prof = (profiles ?? []).find((p) => p.id === id);
    const payload = ((constraintRows ?? []).find((c) => c.profile_id === id)?.payload ??
      {}) as ConstraintPayload;
    const name = prof?.display_name ?? "A member";

    const curfew =
      payload.latestEnd ?? (prof?.curfew_time ? String(prof.curfew_time).slice(0, 5) : null);
    if (curfew && end != null && end + travel > toMin(curfew)) {
      found.push({
        kind: "curfew",
        detail: `${name}'s ${curfew} curfew lands before this wraps up`,
        profileId: id,
      });
    }
    const budget = payload.maxSpend ?? payload.maxTicketPrice ?? null;
    if (budget != null && cost > budget) {
      found.push({
        kind: "budget",
        detail: `The pick is above someone's budget cap`,
        profileId: id,
      });
    }
    const maxMiles = payload.maxDistanceMiles ?? null;
    const venueMiles = (pick.breakdown as { venue?: { distanceMiles?: number } } | null)?.venue
      ?.distanceMiles;
    if (maxMiles != null && venueMiles != null && venueMiles > maxMiles) {
      found.push({
        kind: "distance",
        detail: `The pick is outside someone's travel radius`,
        profileId: id,
      });
    }
  }

  if (found.length) {
    // Keep one open row per member+kind.
    const { data: existing } = await supabaseAdmin
      .from("plan_conflicts")
      .select("id, kind, profile_id")
      .eq("plan_id", planId)
      .eq("resolved", false);
    const fresh = found.filter(
      (f) => !(existing ?? []).some((e) => e.kind === f.kind && e.profile_id === f.profileId),
    );
    if (fresh.length) {
      await supabaseAdmin.from("plan_conflicts").insert(
        fresh.map((f) => ({
          plan_id: planId,
          profile_id: f.profileId,
          kind: f.kind,
          detail: f.detail,
        })),
      );
    }
  }
  return found;
}

/**
 * Builds 2–3 compromise options for the open conflicts: an earlier start, a
 * cheaper spot, and a closer fair-point venue. Written as extra recommendations
 * tagged `alternative` so the existing voting flow handles them unchanged.
 */
export async function generateAlternatives(planId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: plan } = await supabaseAdmin
    .from("plans")
    .select("*")
    .eq("id", planId)
    .maybeSingle();
  if (!plan) return { created: 0 };

  const { data: conflicts } = await supabaseAdmin
    .from("plan_conflicts")
    .select("kind")
    .eq("plan_id", planId)
    .eq("resolved", false);
  const kinds = new Set((conflicts ?? []).map((c) => c.kind));
  if (!kinds.size) return { created: 0 };

  const { data: recs } = await supabaseAdmin
    .from("recommendations")
    .select("*")
    .eq("plan_id", planId)
    .order("rank");
  const base =
    (recs ?? []).find((r) => r.id === plan.selected_recommendation_id) ?? (recs ?? [])[0];
  if (!base) return { created: 0 };

  // Remove any previous alternative set so the poll stays readable.
  await supabaseAdmin
    .from("recommendations")
    .delete()
    .eq("plan_id", planId)
    .contains("tags", ["alternative"]);

  const { loadMemberBases, fairPointFor, drivesTo } = await import("./fairpoint.server");
  const bases = await loadMemberBases(plan.group_id);
  const origin = await fairPointFor(bases, plan.location_area);

  const rows: Record<string, unknown>[] = [];
  const nextRank = (recs ?? []).length + 1;

  const shift = (hhmm: string | null, delta: number) => {
    if (!hhmm) return null;
    const m = toMin(String(hhmm).slice(0, 5)) + delta;
    const w = ((m % 1440) + 1440) % 1440;
    return `${String(Math.floor(w / 60)).padStart(2, "0")}:${String(w % 60).padStart(2, "0")}`;
  };

  const mkBreakdown = (reason: string) => ({
    hardFailures: 0,
    budgetFit: 85,
    scheduleFit: 90,
    travelFit: 85,
    preferenceFit: 80,
    dietaryFit: 85,
    transportFit: 85,
    fairness: 90,
    reasons: [reason],
    cautions: [],
  });

  if (kinds.has("curfew")) {
    rows.push({
      plan_id: planId,
      rank: nextRank + rows.length,
      title: `${base.title} — 45 min earlier`,
      subtitle: `Same spot, shifted to ${shift(base.suggested_start, -45)} so everyone makes curfew`,
      category: plan.category,
      cost_min: base.cost_min,
      cost_max: base.cost_max,
      travel_minutes: base.travel_minutes,
      suggested_start: shift(base.suggested_start, -45),
      suggested_end: shift(base.suggested_end, -45),
      location_name: base.location_name,
      lat: base.lat,
      lon: base.lon,
      address: base.address,
      tags: ["alternative", "time-shift"],
      score: 86,
      feasible: true,
      breakdown: mkBreakdown("Starts earlier so the group is home before the tightest curfew"),
    });
  }

  if ((kinds.has("budget") || kinds.has("distance")) && origin) {
    const { searchVenuesGeoapify } = await import("./places.server");
    const { queryVenuesNear } = await import("./location");
    const query = {
      origin,
      category: plan.category as PlanCategory,
      vibe: plan.food_vibe ?? null,
      maxRadiusMiles: kinds.has("distance") ? 6 : (plan.search_radius_miles ?? 12),
      maxBudget: kinds.has("budget") ? 15 : null,
      limit: 6,
    };
    const live = await searchVenuesGeoapify(query);
    const seeds = (live.length ? live : queryVenuesNear(query)).filter(
      (v) => v.title !== base.title,
    );

    if (kinds.has("budget")) {
      const cheap = [...seeds].sort((a, b) => a.costMax - b.costMax)[0];
      if (cheap) {
        rows.push({
          plan_id: planId,
          rank: nextRank + rows.length,
          title: `${cheap.title} — lower cost`,
          subtitle: `$${cheap.costMin}–${cheap.costMax} per person near the group's fair point`,
          category: plan.category,
          cost_min: cheap.costMin,
          cost_max: cheap.costMax,
          travel_minutes: cheap.travelMinutes,
          suggested_start: base.suggested_start,
          suggested_end: base.suggested_end,
          location_name: cheap.location,
          lat: cheap.lat ?? null,
          lon: cheap.lon ?? null,
          address: cheap.address ?? null,
          tags: ["alternative", "budget"],
          score: 84,
          feasible: true,
          breakdown: mkBreakdown("Cheaper tier so nobody is priced out"),
        });
      }
    }

    if (kinds.has("distance")) {
      const closest = [...seeds].sort((a, b) => {
        const da = Math.max(
          ...drivesTo(bases, { lat: a.lat, lon: a.lon }).map((d) => d.minutes),
          0,
        );
        const db = Math.max(
          ...drivesTo(bases, { lat: b.lat, lon: b.lon }).map((d) => d.minutes),
          0,
        );
        return da - db;
      })[0];
      if (closest) {
        rows.push({
          plan_id: planId,
          rank: nextRank + rows.length,
          title: `${closest.title} — closer fair point`,
          subtitle: `Shorter drive for everyone in the group`,
          category: plan.category,
          cost_min: closest.costMin,
          cost_max: closest.costMax,
          travel_minutes: closest.travelMinutes,
          suggested_start: base.suggested_start,
          suggested_end: base.suggested_end,
          location_name: closest.location,
          lat: closest.lat ?? null,
          lon: closest.lon ?? null,
          address: closest.address ?? null,
          tags: ["alternative", "location"],
          score: 83,
          feasible: true,
          breakdown: mkBreakdown("Recentred on the group's midpoint to cut everyone's drive"),
        });
      }
    }
  }

  if (!rows.length) return { created: 0 };
  await supabaseAdmin.from("recommendations").insert(rows as never);
  await supabaseAdmin
    .from("plans")
    .update({ status: "voting", selected_recommendation_id: null })
    .eq("id", planId);
  await supabaseAdmin.from("activity_events").insert({
    plan_id: planId,
    group_id: plan.group_id,
    type: "conflict_detected",
    message: "Plan conflict detected for 1 or more members. Voting on alternatives.",
  });
  const { notifyPlanParticipants } = await import("./notify.server");
  await notifyPlanParticipants(planId, {
    type: "recommendations_ready",
    title: `Conflict on ${plan.title}`,
    body: "Quick re-vote: pick an adjusted option or keep the original.",
  });
  return { created: rows.length };
}
