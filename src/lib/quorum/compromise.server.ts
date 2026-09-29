// Server-only. Reads private constraints with elevated access and reduces them
// to group-safe aggregates before anything touches the AI layer or the client.
import { isOutdoorOption } from "./weather";
import { normalizeZip } from "./location";
import type { CompromiseFacts } from "./ai.server";
import type { ConstraintPayload, ScoreBreakdown } from "./types";
import type { PlanBSuggestion } from "./ai.functions";

async function loadPlanContext(planId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: plan } = await supabaseAdmin
    .from("plans")
    .select("id, title, category, location_area, window_start, selected_recommendation_id")
    .eq("id", planId)
    .maybeSingle();
  const { data: recs } = await supabaseAdmin
    .from("recommendations")
    .select("*")
    .eq("plan_id", planId)
    .order("rank", { ascending: true });
  const { data: participants } = await supabaseAdmin
    .from("plan_participants")
    .select("profile_id, attending")
    .eq("plan_id", planId);
  const { data: constraintRows } = await supabaseAdmin
    .from("plan_constraints")
    .select("profile_id, payload")
    .eq("plan_id", planId);

  const attending = (participants ?? []).filter((p) => p.attending !== false);
  const payloads = attending
    .map(
      (p) =>
        (constraintRows ?? []).find((c) => c.profile_id === p.profile_id)?.payload as
          ConstraintPayload | undefined,
    )
    .filter((p): p is ConstraintPayload => Boolean(p));

  const nums = (vals: (number | null | undefined)[]) => vals.filter((v): v is number => v != null);
  const budgets = nums(payloads.map((p) => p.maxSpend ?? p.maxTicketPrice));
  const travel = nums(payloads.map((p) => p.maxTravelMinutes));
  const dietary = [...new Set(payloads.flatMap((p) => p.dietary ?? []))];

  return {
    plan,
    recs: recs ?? [],
    memberCount: attending.length,
    tightestBudget: budgets.length ? Math.min(...budgets) : null,
    tightestTravelMinutes: travel.length ? Math.min(...travel) : null,
    dietaryNeeds: dietary,
  };
}

/** Top options reduced to shareable numbers — never per-person answers. */
export async function buildCompromiseFacts(planId: string): Promise<CompromiseFacts[]> {
  const ctx = await loadPlanContext(planId);
  return ctx.recs.slice(0, 4).map((r) => {
    const breakdown = (r.breakdown ?? {}) as unknown as ScoreBreakdown;
    return {
      id: r.id,
      title: r.title,
      score: r.score ?? 0,
      feasible: Boolean(r.feasible),
      costMin: r.cost_min ?? 0,
      costMax: r.cost_max ?? 0,
      travelMinutes: r.travel_minutes ?? 0,
      distanceMiles: breakdown.venue?.distanceMiles ?? null,
      breakdown,
      tightestBudget: ctx.tightestBudget,
      tightestTravelMinutes: ctx.tightestTravelMinutes,
      blockedCount: breakdown.hardFailures ?? 0,
      memberCount: ctx.memberCount,
      dietaryNeeds: ctx.dietaryNeeds,
    };
  });
}

/** `userId` is charged one AI call, only when a pitch is actually written. */
export async function buildPlanBSuggestion(
  planId: string,
  userId: string,
): Promise<PlanBSuggestion> {
  const none: PlanBSuggestion = { needed: false, pitch: null, swapToId: null, swapToTitle: null };
  const ctx = await loadPlanContext(planId);
  if (!ctx.plan || ctx.recs.length === 0) return none;

  const current =
    ctx.recs.find((r) => r.id === ctx.plan!.selected_recommendation_id) ?? ctx.recs[0]!;
  const outdoor = isOutdoorOption({
    title: current.title,
    tags: (current.tags as string[] | null) ?? [],
  });
  if (!outdoor) return none;

  const zip = normalizeZip(ctx.plan.location_area);
  if (!zip) return none;
  const { geocodeZipServer } = await import("./location.server");
  const origin = await geocodeZipServer(zip);
  if (!origin) return none;
  const { fetchForecast } = await import("./weather.server");
  const forecast = await fetchForecast(origin.lat, origin.lon, ctx.plan.window_start);
  if (!forecast?.alert) return none;

  const indoor =
    ctx.recs.find(
      (r) =>
        r.id !== current.id &&
        r.feasible &&
        !isOutdoorOption({ title: r.title, tags: (r.tags as string[] | null) ?? [] }),
    ) ??
    ctx.recs.find(
      (r) =>
        r.id !== current.id &&
        !isOutdoorOption({ title: r.title, tags: (r.tags as string[] | null) ?? [] }),
    ) ??
    null;

  const { assertAiQuota } = await import("@/lib/ai-quota.server");
  await assertAiQuota(userId, "plan_b_pitch");
  const { writePlanBPitch } = await import("./ai.server");
  const pitch = await writePlanBPitch({
    forecast,
    outdoorTitle: current.title,
    indoorTitle: indoor?.title ?? null,
    indoorScore: indoor?.score ?? null,
  });

  return {
    needed: true,
    pitch,
    swapToId: indoor?.id ?? null,
    swapToTitle: indoor?.title ?? null,
  };
}

/**
 * Group-safe conflict aggregates: vote split, tightest budget/curfew, and the
 * longest drive across the group. No per-person answer ever leaves here.
 */
export async function buildConflictFacts(planId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const ctx = await loadPlanContext(planId);
  if (!ctx.plan) return null;

  const top0 = ctx.recs[0] as { lat?: number | null; lon?: number | null } | undefined;
  let weather: { summary: string; precipProbability: number | null; alert: boolean } | null = null;
  if (typeof top0?.lat === "number" && typeof top0?.lon === "number") {
    const { fetchForecast } = await import("./weather.server");
    const forecast = await fetchForecast(top0.lat, top0.lon, ctx.plan.window_start);
    if (forecast) {
      weather = {
        summary: `${forecast.label}, ${forecast.tempMaxF}°/${forecast.tempMinF}°F`,
        precipProbability: forecast.precipProbability,
        alert: forecast.alert,
      };
    }
  }

  const { data: votes } = await supabaseAdmin
    .from("votes")
    .select("recommendation_id")
    .eq("plan_id", planId);
  const { data: parts } = await supabaseAdmin
    .from("plan_participants")
    .select("profile_id, attending, profiles(curfew_time)")
    .eq("plan_id", planId);

  const attending = (parts ?? []).filter((p) => p.attending !== false);
  const curfews = attending
    .map((p) =>
      ((p.profiles as { curfew_time?: string | null } | null)?.curfew_time ?? null)?.slice(0, 5),
    )
    .filter((c): c is string => Boolean(c))
    .sort();

  const top = ctx.recs[0] ?? null;
  const topBreakdown = (top?.breakdown ?? {}) as unknown as ScoreBreakdown;
  const drives = topBreakdown.fair?.drives ?? [];
  const longestDrive = drives.length ? Math.max(...drives.map((d) => d.minutes)) : null;

  const toMin = (t: string | null | undefined) =>
    t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) : null;
  const endMin = toMin(top?.suggested_end ?? null);
  const curfewBreachCount = curfews.filter((c) => {
    const cm = toMin(c);
    return endMin != null && cm != null && endMin + (longestDrive ?? 0) > cm;
  }).length;

  return {
    planTitle: ctx.plan.title,
    category: ctx.plan.category,
    memberCount: ctx.memberCount,
    startTime: top?.suggested_start?.slice(0, 5) ?? null,
    endTime: top?.suggested_end?.slice(0, 5) ?? null,
    earliestCurfew: curfews[0] ?? null,
    curfewBreachCount,
    tightestBudget: ctx.tightestBudget,
    topCostMin: top?.cost_min ?? null,
    topCostMax: top?.cost_max ?? null,
    voteSplit: ctx.recs.map((r) => ({
      id: r.id,
      title: r.title,
      votes: (votes ?? []).filter((v) => v.recommendation_id === r.id).length,
      costMin: (r as { cost_min?: number | null }).cost_min ?? null,
      costMax: (r as { cost_max?: number | null }).cost_max ?? null,
    })),
    weather,
    dietaryNeeds: ctx.dietaryNeeds,
    longestDriveMinutes: longestDrive,
    travelLimitMinutes: ctx.tightestTravelMinutes,
  };
}
