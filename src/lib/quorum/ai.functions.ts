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
