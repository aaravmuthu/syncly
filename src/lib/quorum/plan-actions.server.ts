import { dbError } from "@/lib/db-error";
import { assertPlanOpen } from "./plan-lifecycle.server";
import { buildTransportPlan, scoreOption } from "./engine";
import { isOpenDuring } from "./hardfilter";
import { readItinerary } from "./itinerary";
import { isValidTimeZone, zonedDateKey, zonedToInstant } from "./plan-time";
import {
  itineraryCandidates,
  itineraryHoursFit,
  itineraryMemberTravel,
  scoreWholeItinerary,
} from "./planning-candidates";
import type { ConstraintPayload, OptionSeed, ScoreBreakdown } from "./types";

/** Callers authorize membership/host access before invoking this shared mutation. */
export async function lockPlanSelection(planId: string, recommendationId: string) {
  await assertPlanOpen(planId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rec, error } = await supabaseAdmin
    .from("recommendations")
    .select("*")
    .eq("id", recommendationId)
    .eq("plan_id", planId)
    .maybeSingle();
  if (error) throw dbError(error, "lockPlanSelection");
  if (!rec?.feasible) throw new Error("Choose an available option that works for everyone");
  const [{ data: parts, error: partsError }, { data: answers, error: answersError }] =
    await Promise.all([
      supabaseAdmin
        .from("plan_participants")
        .select("profile_id, attending, profiles(display_name)")
        .eq("plan_id", planId),
      supabaseAdmin.from("plan_constraints").select("profile_id, payload").eq("plan_id", planId),
    ]);
  if (partsError || answersError) throw dbError((partsError ?? answersError)!, "lockPlanSelection");
  const members = (parts ?? [])
    .filter((p) => p.attending !== false)
    .map((p) => ({
      profileId: p.profile_id,
      name: p.profile_id,
      constraints: (answers ?? []).find((a) => a.profile_id === p.profile_id)?.payload as
        ConstraintPayload | undefined,
    }));
  if (!members.length || members.some((m) => !m.constraints))
    throw new Error("Wait until everyone attending has submitted their private answers");
  let ready = members.map((m) => ({ ...m, constraints: m.constraints! }));
  const breakdown = rec.breakdown as unknown as ScoreBreakdown;
  let option: OptionSeed | undefined = breakdown.optionSeed;
  if (!option) throw new Error("Refresh the options before locking in this plan.");
  const { data: currentPlan, error: currentError } = await supabaseAdmin
    .from("plans")
    .select("group_id, window_start, window_end, time_zone, search_radius_miles, category")
    .eq("id", planId)
    .single();
  if (currentError) throw dbError(currentError, "lockPlanSelection");
  const { loadMemberBases, drivesTo, curfewWarnings } = await import("./fairpoint.server");
  const memberIds = new Set(ready.map((m) => m.profileId));
  const currentBases = (await loadMemberBases(currentPlan.group_id)).filter((b) =>
    memberIds.has(b.profileId),
  );
  const it = readItinerary(breakdown.itinerary);
  if (!it) {
    const routes = drivesTo(currentBases, option);
    ready = ready.map((m) => {
      const route = routes.find((d) => d.profileId === m.profileId);
      return {
        ...m,
        ...(route ? { travelMinutes: route.minutes, returnTravelMinutes: route.minutes } : {}),
      };
    });
    const distanceOk = routes.every((d) => {
      const cap =
        ready.find((m) => m.profileId === d.profileId)?.constraints.maxDistanceMiles ??
        currentPlan.search_radius_miles;
      return cap == null || d.miles <= cap;
    });
    if (
      !scoreOption(option, ready).feasible ||
      !distanceOk ||
      curfewWarnings(currentBases, option.end, routes, option.start, option.durationMinutes)
        .length ||
      !isOpenDuring(
        option.openHours,
        option.start,
        option.end,
        currentPlan.category,
        currentPlan.window_start
          ? zonedDateKey(currentPlan.window_start, currentPlan.time_zone ?? "UTC")
          : undefined,
      )
    ) {
      throw new Error("This option no longer meets every requirement. Refresh the options.");
    }
  }
  if (it) {
    const { data: plan, error: planError } = await supabaseAdmin
      .from("plans")
      .select("group_id, window_start, window_end, time_zone, search_radius_miles")
      .eq("id", planId)
      .single();
    if (planError) throw dbError(planError, "lockPlanSelection");
    const { loadMemberBases } = await import("./fairpoint.server");
    const bases = await loadMemberBases(plan.group_id);
    const candidate = itineraryCandidates(it, plan).find(
      (c) => c.itinerary.stops[c.itinerary.anchor].pick === it.stops[it.anchor].pick,
    );
    if (
      !candidate ||
      !itineraryHoursFit(candidate.itinerary) ||
      !scoreWholeItinerary(
        candidate.option,
        candidate.itinerary,
        ready,
        bases,
        plan.search_radius_miles,
      ).feasible
    ) {
      throw new Error("The full outing no longer meets every requirement. Refresh the options.");
    }
    option = candidate.option;
    ready = ready.map((m) => {
      const base = bases.find((b) => b.profileId === m.profileId);
      return { ...m, ...(base ? itineraryMemberTravel(candidate.itinerary, base) : {}) };
    });
  }
  const rides = buildTransportPlan(option, ready);
  if (rides.unseated.length) throw new Error("There are not enough seats for everyone");
  const displayName = (id: string) =>
    (parts ?? []).find((p) => p.profile_id === id)?.profiles as { display_name?: string } | null;
  const transport = rides.cars.map((c) => ({
    label: c.label,
    driver: displayName(c.driver)?.display_name ?? "Driver",
    passengers: c.passengers,
  }));
  const { error: writeError } = await supabaseAdmin.rpc("lock_checked_plan", {
    _plan_id: planId,
    _recommendation_id: recommendationId,
    _transport: transport,
  });
  if (writeError) throw dbError(writeError, "lockPlanSelection");
}

export async function retimePlan(planId: string, time: string, viewerZone?: string) {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error("Choose a valid time");
  await assertPlanOpen(planId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: plan, error } = await supabaseAdmin
    .from("plans")
    .select("window_start, window_end, time_zone, itinerary")
    .eq("id", planId)
    .single();
  if (error) throw dbError(error, "retimePlan");
  if (!plan.window_start) throw new Error("Add a date to the plan before changing its time");
  const zone = plan.time_zone
    ? plan.time_zone
    : viewerZone && isValidTimeZone(viewerZone)
      ? viewerZone
      : "UTC";
  const start = zonedToInstant(zonedDateKey(plan.window_start, zone), time, zone);
  const end = plan.window_end
    ? new Date(
        Date.parse(start) + Date.parse(plan.window_end) - Date.parse(plan.window_start),
      ).toISOString()
    : null;
  const it = readItinerary(plan.itinerary);
  const itinerary = it ? { ...it, start: time, date: zonedDateKey(start, zone) } : null;
  const { error: writeError } = await supabaseAdmin.rpc("retime_checked_plan", {
    _plan_id: planId,
    _expected_start: plan.window_start,
    _start: start,
    _end: end,
    _itinerary: itinerary,
    _time_zone: zone,
  });
  if (writeError) throw dbError(writeError, "retimePlan");
  const [{ data: parts }, { data: answers }] = await Promise.all([
    supabaseAdmin.from("plan_participants").select("profile_id, attending").eq("plan_id", planId),
    supabaseAdmin.from("plan_constraints").select("profile_id").eq("plan_id", planId),
  ]);
  const attending = (parts ?? []).filter((p) => p.attending !== false);
  if (
    attending.length &&
    attending.every((p) => answers?.some((a) => a.profile_id === p.profile_id))
  ) {
    try {
      const { regenerateRecommendations } = await import("./recommend.server");
      await regenerateRecommendations(planId);
      return { optionsReady: true };
    } catch (error) {
      console.error("Time saved; recommendation refresh failed", error);
    }
  }
  return { optionsReady: false };
}
