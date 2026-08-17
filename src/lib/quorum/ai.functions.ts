import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { MagicDraft } from "./ai.server";
import type { PlanCategory } from "./types";

export type MagicPlanResult = MagicDraft & {
  /** Resolved 5-digit ZIP for the plan, when the prompt gave a usable place. */
  zip: string | null;
  areaLabel: string | null;
  /** Live venue candidates found for the parsed parameters. */
  candidates: { title: string; subtitle: string; costMin: number; costMax: number; distanceMiles: number | null }[];
};

/**
 * Turns a free-text prompt into plan fields, then immediately probes live
 * venue services (Mapbox geocoding + Geoapify places) with those parameters so
 * the host can see what the plan would surface before creating it.
 */
export const magicPlanDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { prompt: string; fallbackZip?: string | null }) => d)
  .handler(async ({ data }): Promise<MagicPlanResult> => {
    const prompt = data.prompt.trim();
    if (!prompt) throw new Error("Describe the plan first");

    const { parseMagicPrompt } = await import("./ai.server");
    const today = new Date().toISOString().slice(0, 10);
    const draft = await parseMagicPrompt(prompt, today);

    const { normalizeZip, queryVenuesNear } = await import("./location");
    const { geocodeZipServer } = await import("./location.server");
    const { searchVenuesGeoapify, suggestPlacesServer, reverseZipServer } = await import("./places.server");

    // ZIP resolution: explicit ZIP → geocoded place name → the caller's ZIP.
    let zip = normalizeZip(draft.targetCityOrZip);
    if (!zip && draft.targetCityOrZip) {
      const [hit] = await suggestPlacesServer(draft.targetCityOrZip);
      if (hit) zip = normalizeZip(hit.zip) ?? (await reverseZipServer(hit.lat, hit.lon));
    }
    zip = zip ?? normalizeZip(data.fallbackZip);

    const origin = zip ? await geocodeZipServer(zip) : null;
    let candidates: MagicPlanResult["candidates"] = [];
    if (origin) {
      const query = {
        origin,
        category: draft.category as PlanCategory,
        maxRadiusMiles: draft.searchRadiusMiles,
        maxBudget: draft.maxSpendPerPerson,
        limit: 6,
      };
      const live = await searchVenuesGeoapify(query);
      const seeds = live.length ? live : queryVenuesNear(query);
      candidates = seeds.slice(0, 6).map((v) => ({
        title: v.title,
        subtitle: v.subtitle,
        costMin: v.costMin,
        costMax: v.costMax,
        distanceMiles: v.distanceMiles ?? null,
      }));
    }

    return { ...draft, zip, areaLabel: origin?.label ?? null, candidates };
  });

/**
 * AI "why this works" line for each option. Built from group-safe aggregates
 * only — no member is ever named and no private answer leaves the server.
 */
export const getCompromiseSummaries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { planId: string }) => d)
  .handler(async ({ data, context }): Promise<Record<string, string>> => {
    const { data: allowed } = await context.supabase.rpc("can_see_plan", { _plan_id: data.planId });
    if (!allowed) throw new Error("Forbidden");

    const { buildCompromiseFacts } = await import("./compromise.server");
    const facts = await buildCompromiseFacts(data.planId);
    if (!facts.length) return {};
    const { summarizeCompromises } = await import("./ai.server");
    return summarizeCompromises(facts);
  });

export type PlanBSuggestion = {
  needed: boolean;
  pitch: string | null;
  swapToId: string | null;
  swapToTitle: string | null;
};

/** Weather guardian: outdoor pick + bad forecast → one-click indoor swap. */
export const getPlanBSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { planId: string }) => d)
  .handler(async ({ data, context }): Promise<PlanBSuggestion> => {
    const { data: allowed } = await context.supabase.rpc("can_see_plan", { _plan_id: data.planId });
    if (!allowed) throw new Error("Forbidden");
    const { buildPlanBSuggestion } = await import("./compromise.server");
    return buildPlanBSuggestion(data.planId);
  });

/* ------------------------------------------------------------------ */
/* 4. AI conflict resolution                                           */
/* ------------------------------------------------------------------ */

export type CompromisePlanResult = {
  needed: boolean;
  headline: string;
  detail: string;
  suggestedStart: string | null;
  suggestedRecommendationId: string | null;
  suggestedRecommendationTitle: string | null;
};

/** Reads private constraints server-side and returns one group-safe compromise. */
export const getAiCompromise = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { planId: string }) => d)
  .handler(async ({ data, context }): Promise<CompromisePlanResult> => {
    const { data: allowed } = await context.supabase.rpc("can_see_plan", { _plan_id: data.planId });
    if (!allowed) throw new Error("Forbidden");
    const { buildConflictFacts } = await import("./compromise.server");
    const facts = await buildConflictFacts(data.planId);
    if (!facts) {
      return {
        needed: false,
        headline: "",
        detail: "",
        suggestedStart: null,
        suggestedRecommendationId: null,
        suggestedRecommendationTitle: null,
      };
    }
    const { writeCompromise } = await import("./ai.server");
    return writeCompromise(facts);
  });

/** Host-only: applies the suggested start time and/or option to the plan. */
export const applyAiCompromise = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { planId: string; startTime?: string | null; recommendationId?: string | null }) => d,
  )
  .handler(async ({ data, context }) => {
    const { data: isOwner } = await context.supabase.rpc("is_plan_owner", { _plan_id: data.planId });
    if (!isOwner) throw new Error("Only the host can apply a compromise");

    const { data: plan, error: readError } = await context.supabase
      .from("plans")
      .select("window_start, window_end")
      .eq("id", data.planId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!plan) throw new Error("Plan not found");

    const patch: Record<string, unknown> = {};
    if (data.startTime && plan.window_start) {
      const start = new Date(plan.window_start);
      const original = start.getTime();
      start.setHours(Number(data.startTime.slice(0, 2)), Number(data.startTime.slice(3, 5)), 0, 0);
      patch["window_start"] = start.toISOString();
      // Keep the same duration so the window stays coherent.
      if (plan.window_end) {
        const end = new Date(plan.window_end);
        patch["window_end"] = new Date(
          end.getTime() + (start.getTime() - original),
        ).toISOString();
      }
    }
    if (data.recommendationId) {
      patch["selected_recommendation_id"] = data.recommendationId;
      patch["status"] = "finalized";
    }
    if (Object.keys(patch).length) {
      const { error } = await context.supabase.from("plans").update(patch).eq("id", data.planId);
      if (error) throw new Error(error.message);
    }

    const { notifyPlanParticipants } = await import("./notify.server");
    await notifyPlanParticipants(data.planId, {
      type: "compromise_applied",
      title: "The host applied an AI compromise",
      body: data.startTime
        ? `New start time: ${data.startTime}`
        : "The group's pick was locked in.",
    });
    return { ok: true };
  });
