import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as v from "./schemas";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { MagicDraft } from "./ai.server";
import type { PlanCategory } from "./types";

export type MagicPlanResult = MagicDraft & {
  /** Resolved 5-digit ZIP for the plan, when the prompt gave a usable place. */
  zip: string | null;
  areaLabel: string | null;
  /** Live venue candidates found for the parsed parameters. */
  candidates: {
    title: string;
    subtitle: string;
    costMin: number;
    costMax: number;
    distanceMiles: number | null;
  }[];
};

/**
 * Turns a free-text prompt into plan fields, then immediately probes live
 * venue services (Mapbox geocoding + Geoapify places) with those parameters so
 * the host can see what the plan would surface before creating it.
 */
export const magicPlanDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ prompt: v.reqText(2000), fallbackZip: v.optText(10) }))
  .handler(async ({ data, context }): Promise<MagicPlanResult> => {
    const prompt = data.prompt.trim();
    if (!prompt) throw new Error("Describe the plan first");

    const { assertAiQuota } = await import("@/lib/ai-quota.server");
    await assertAiQuota(context.userId, "magic_plan_draft");
    const { parseMagicPrompt } = await import("./ai.server");
    const today = new Date().toISOString().slice(0, 10);
    const draft = await parseMagicPrompt(prompt, today);

    const { normalizeZip } = await import("./location");
    const { geocodeZipServer } = await import("./location.server");
    const { searchVenuesGeoapify, suggestPlacesServer, reverseZipServer } =
      await import("./places.server");

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
      const seeds = live;
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
  .inputValidator(z.object({ planId: v.id }))
  .handler(async ({ data, context }): Promise<Record<string, string>> => {
    const { data: allowed } = await context.supabase.rpc("can_see_plan", { _plan_id: data.planId });
    if (!allowed) throw new Error("Forbidden");

    const { buildCompromiseFacts } = await import("./compromise.server");
    const facts = await buildCompromiseFacts(data.planId);
    if (!facts.length) return {};
    const { assertAiQuota } = await import("@/lib/ai-quota.server");
    await assertAiQuota(context.userId, "compromise_summaries");
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
  .inputValidator(z.object({ planId: v.id }))
  .handler(async ({ data, context }): Promise<PlanBSuggestion> => {
    const { data: allowed } = await context.supabase.rpc("can_see_plan", { _plan_id: data.planId });
    if (!allowed) throw new Error("Forbidden");
    const { buildPlanBSuggestion } = await import("./compromise.server");
    return buildPlanBSuggestion(data.planId, context.userId);
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
  .inputValidator(z.object({ planId: v.id }))
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
    const { assertAiQuota } = await import("@/lib/ai-quota.server");
    await assertAiQuota(context.userId, "ai_compromise");
    const { writeCompromise } = await import("./ai.server");
    return writeCompromise(facts);
  });

/** Host-only actions use the same finalization guards as the manual flow. */
export const applyAiCompromise = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      planId: v.id,
      startTime: z
        .string()
        .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
        .nullish(),
      recommendationId: v.optId,
      timeZone: v.timeZone.optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { data: isOwner } = await context.supabase.rpc("is_plan_owner", {
      _plan_id: data.planId,
    });
    if (!isOwner) throw new Error("Only the host can apply a compromise");
    if (!data.startTime && !data.recommendationId) throw new Error("Choose a change first");
    const { lockPlanSelection, retimePlan } = await import("./plan-actions.server");
    let optionsReady = true;
    if (data.startTime) {
      // A retime replaces the shortlist; never finalize an id from the old window.
      optionsReady = (await retimePlan(data.planId, data.startTime, data.timeZone)).optionsReady;
    } else if (data.recommendationId) {
      await lockPlanSelection(data.planId, data.recommendationId);
    }
    const { notifyPlanParticipants } = await import("./notify.server");
    await notifyPlanParticipants(data.planId, {
      type: "compromise_applied",
      title: data.startTime ? "The plan time changed" : "The plan is locked in",
      body: data.startTime
        ? "Review the updated options before voting again."
        : "Check the plan hub for details.",
    });
    return { ok: true, optionsReady, requiresNewVote: Boolean(data.startTime) };
  });
