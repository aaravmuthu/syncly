// Server-only. Reads private constraints with elevated access, aggregates them,
// and writes back only group-safe results (scores, generic reasons, transport).
import { optionsForCategory } from "./catalog";
import { normalizeZip, queryVenuesNear } from "./location";
import { geocodeZipServer } from "./location.server";
import { buildTransportPlan, rankOptions, type MemberInput } from "./engine";
import { isOutdoorOption, weatherPenalty, type Forecast } from "./weather";
import { notifyPlanParticipants } from "./notify.server";
import type { ConstraintPayload, PlanCategory, ScoreBreakdown } from "./types";
import { dbError } from "@/lib/db-error";

export async function regenerateRecommendations(planId: string, shuffle = 0) {
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
    ((constraintRows ?? []).find((c) => c.profile_id === profileId)
      ?.payload as ConstraintPayload) ?? {};

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
    .in(
      "id",
      attending.length
        ? attending.map((p) => p.profile_id)
        : ["00000000-0000-0000-0000-000000000000"],
    );

  const memberZip = (profileRows ?? []).map((r) => normalizeZip(r.zip_code)).find(Boolean) ?? null;
  const constraintZip =
    members.map((m) => normalizeZip(m.constraints.zipCode)).find(Boolean) ?? null;
  const zip = normalizeZip(plan.location_area) ?? constraintZip ?? memberZip;

  const numbers = (vals: (number | null | undefined)[]) =>
    vals.filter((v): v is number => v != null);
  const radii = numbers(members.map((m) => m.constraints.maxDistanceMiles));
  const budgets = numbers(
    members.map((m) => m.constraints.maxSpend ?? m.constraints.maxTicketPrice),
  );

  // Fair-Point: geographic midpoint of every attending member's saved home.
  // Falls back to the plan/host ZIP centroid when nobody has coordinates.
  const { loadMemberBases, fairPointFor, drivesTo, curfewWarnings } =
    await import("./fairpoint.server");
  const allBases = await loadMemberBases(plan.group_id);
  const attendingIds = new Set(attending.map((p) => p.profile_id));
  const bases = allBases.filter((b) => attendingIds.has(b.profileId));
  const memberBases = bases.length ? bases : allBases;
  const fairPoint = await fairPointFor(memberBases, zip);
  const zipOrigin = zip ? await geocodeZipServer(zip) : null;
  const origin = fairPoint ?? zipOrigin;
  // The host's chosen search radius caps the group's tightest personal radius.
  const hostRadius = plan.search_radius_miles ?? null;
  if (hostRadius != null) radii.push(hostRadius);
  const venueQuery = {
    category: plan.category as PlanCategory,
    vibe: plan.food_vibe ?? null,
    maxRadiusMiles: radii.length ? Math.min(...radii) : null,
    maxBudget: budgets.length ? Math.min(...budgets) : null,
  };

  // Live venues from Geoapify when available; otherwise the ZIP-anchored
  // local layer; otherwise the seeded catalog. Never throws.
  let options = optionsForCategory(plan.category as PlanCategory);
  if (origin) {
    const { searchVenuesGeoapify } = await import("./places.server");
    const live = await searchVenuesGeoapify({ origin, ...venueQuery });
    options = live.length ? live : queryVenuesNear({ origin, ...venueQuery });
  }

  // ---- Live weather (keyless, Open-Meteo) ---------------------------------
  let forecast: Forecast | null = null;
  if (origin) {
    const { fetchForecast } = await import("./weather.server");
    forecast = await fetchForecast(origin.lat, origin.lon, plan.window_start);
  }

  const scored = rankOptions(options, members).map((r) => {
    const outdoor = isOutdoorOption({
      style: r.option.style,
      tags: r.option.tags,
      title: r.option.title,
    });
    const { multiplier, caution } = weatherPenalty(forecast, outdoor);
    if (multiplier === 1 && !caution) return r;
    const breakdown: ScoreBreakdown = {
      ...r.breakdown,
      cautions: caution ? [...r.breakdown.cautions, caution] : r.breakdown.cautions,
    };
    return { ...r, score: Math.round(r.score * multiplier), breakdown };
  });

  const { isOpenDuring, fairnessScore, OPTION_LABELS } = await import("./hardfilter");

  // Per-member limits come from each person's PRIVATE answers; they are only
  // ever used as a pass/fail gate here and never surfaced per person.
  const limitFor = (profileId: string) =>
    members.find((m) => m.profileId === profileId)?.constraints.maxDistanceMiles ?? null;

  // Attach fair-point drive math to EVERY scored option before filtering.
  const enriched = scored.map((r) => {
    const drives = drivesTo(memberBases, { lat: r.option.lat, lon: r.option.lon });
    const warnings = curfewWarnings(memberBases, r.option.end, drives);
    const mins = drives.map((d) => d.minutes);
    const avgMinutes = mins.length ? Math.round(mins.reduce((a, b) => a + b, 0) / mins.length) : 0;
    const spreadMinutes = mins.length ? Math.max(...mins) - Math.min(...mins) : 0;
    const fairness = fairnessScore(mins);

    // (a) Distance: no member may exceed their own max travel miles.
    const distanceOk = drives.every((d) => {
      const cap = limitFor(d.profileId) ?? hostRadius;
      return cap == null || d.miles <= cap;
    });
    // (b) Curfew: round-trip travel + hangout must clear every curfew.
    const curfewOk = warnings.length === 0;
    // (c) Operating hours during the planned window.
    const hoursOk = isOpenDuring(
      r.option.openHours,
      r.option.start,
      r.option.end,
      plan.category as string,
    );

    const breakdown: ScoreBreakdown = {
      ...r.breakdown,
      fair: {
        avgMinutes,
        spreadMinutes,
        midpointLabel: fairPoint?.label ?? null,
        drives: drives.map((d) => ({ name: d.name, miles: d.miles, minutes: d.minutes })),
        curfewOk,
        curfewNote: warnings.length
          ? `Wraps at ${warnings[0]!.wrapsAt}, past ${warnings[0]!.name}'s ${warnings[0]!.curfew} curfew`
          : null,
      },
    };
    const maxMinutes = mins.length ? Math.max(...mins) : 0;
    return { ...r, breakdown, fairness, avgMinutes, maxMinutes, distanceOk, curfewOk, hoursOk };
  });

  // Hard filter: only venues that satisfy every member's constraints.
  const strict = enriched.filter((r) => r.distanceOk && r.curfewOk && r.hoursOk && r.feasible);
  // Never leave the group empty-handed: relax to the best-scoring set only when
  // nothing clears the strict gate.
  const pool = (strict.length ? strict : enriched).sort((a, b) => {
    if (b.fairness !== a.fairness) return b.fairness - a.fairness;
    return b.score - a.score;
  });

  // Shuffle rotates through the pool in batches of three.
  const batch = 3;
  const offset =
    pool.length > batch ? ((shuffle % Math.ceil(pool.length / batch)) * batch) % pool.length : 0;
  const rotated = [...pool.slice(offset), ...pool.slice(0, offset)];

  // Option A = fairest midpoint, B = highest rated / most popular,
  // C = quickest trip home (best curfew headroom). Never more than three.
  const picked: typeof rotated = [];
  const take = (candidate: (typeof rotated)[number] | undefined) => {
    if (candidate && !picked.includes(candidate)) picked.push(candidate);
  };
  take(rotated[0]);
  take(
    [...rotated]
      .filter((r) => !picked.includes(r))
      .sort(
        (a, b) =>
          (b.breakdown.venue?.rating ?? 0) - (a.breakdown.venue?.rating ?? 0) || b.score - a.score,
      )[0],
  );
  take(
    [...rotated]
      .filter((r) => !picked.includes(r))
      .sort((a, b) => a.maxMinutes - b.maxMinutes || a.avgMinutes - b.avgMinutes)[0],
  );
  for (const r of rotated) {
    if (picked.length >= batch) break;
    take(r);
  }

  const keys: ("A" | "B" | "C")[] = ["A", "B", "C"];
  const withFair = picked.slice(0, batch).map((r, i) => {
    const key = keys[i]!;
    const breakdown: ScoreBreakdown = {
      ...r.breakdown,
      optionLabel: { key, ...OPTION_LABELS[key] },
    };
    return { ...r, breakdown };
  });
  const ranked = withFair;

  await supabaseAdmin.from("recommendations").delete().eq("plan_id", planId);
  const { data: inserted, error } = await supabaseAdmin
    .from("recommendations")
    .insert(
      withFair.map((r, i) => ({
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
        lat: r.option.lat ?? null,
        lon: r.option.lon ?? null,
        address: r.option.address ?? null,
        tags: r.option.tags,
        score: r.score,
        feasible: r.feasible,
        breakdown: r.breakdown as never,
      })),
    )
    .select("id, feasible");
  if (error) throw dbError(error, "regenerateRecommendations");

  const best = ranked[0];
  const stillFinalizable = plan.status === "finalized" && ranked.some((r) => r.feasible);
  await supabaseAdmin
    .from("plans")
    .update({
      status: plan.status === "finalized" && stillFinalizable ? "finalized" : "voting",
      compatibility_score: best?.score ?? null,
      ...(plan.status === "finalized" && !stillFinalizable
        ? { selected_recommendation_id: null }
        : {}),
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

  await notifyPlanParticipants(planId, {
    type: "recommendations_ready",
    title: `Options are ready for ${plan.title}`,
    body: forecast?.alert
      ? `${forecast.alertText} — indoor picks rank higher.`
      : "Vote on the options that work for everyone.",
  });

  return {
    count: inserted?.length ?? 0,
    feasible: ranked.filter((r) => r.feasible).length,
    weatherAlert: forecast?.alertText ?? null,
  };
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
