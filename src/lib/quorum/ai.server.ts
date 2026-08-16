// Server-only AI helpers. Every function degrades gracefully: if the gateway
// is unavailable or the model returns something unusable, callers still get a
// deterministic, non-AI result instead of an error.
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { z } from "zod";
import { lovableAiModel } from "@/lib/ai-gateway.server";
import { CATEGORIES, type PlanCategory, type ScoreBreakdown } from "./types";
import type { Forecast } from "./weather";

const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as [PlanCategory, ...PlanCategory[]];

/* ------------------------------------------------------------------ */
/* 1. Magic plan parsing                                               */
/* ------------------------------------------------------------------ */

export type MagicDraft = {
  title: string;
  category: PlanCategory;
  date: string | null; // YYYY-MM-DD
  time: string | null; // HH:MM (24h)
  budgetTier: "low" | "medium" | "high" | null;
  maxSpendPerPerson: number | null;
  searchRadiusMiles: number | null;
  targetCityOrZip: string | null;
};

const DraftSchema = z.object({
  title: z.string(),
  category: z.enum(CATEGORY_IDS),
  date: z.string().nullable(),
  time: z.string().nullable(),
  budget_tier: z.enum(["low", "medium", "high"]).nullable(),
  max_spend_per_person: z.number().nullable(),
  search_radius_miles: z.number().nullable(),
  target_city_zip: z.string().nullable(),
});

/** Deterministic fallback when AI is unavailable. */
function heuristicDraft(prompt: string): MagicDraft {
  const text = prompt.toLowerCase();
  const category =
    (CATEGORIES.find((c) => text.includes(c.id))?.id ??
      (text.includes("eat") || text.includes("dinner") || text.includes("food")
        ? "dinner"
        : text.includes("movie")
          ? "movie"
          : text.includes("concert") || text.includes("show")
            ? "concert"
            : "hangout")) as PlanCategory;
  const money = text.match(/\$\s?(\d{1,4})/);
  const zip = text.match(/\b(\d{5})\b/);
  const miles = text.match(/(\d{1,3})\s?(?:mi|mile)/);
  return {
    title: prompt.trim().slice(0, 60) || "New plan",
    category,
    date: null,
    time: null,
    budgetTier: null,
    maxSpendPerPerson: money ? Number(money[1]) : null,
    searchRadiusMiles: miles ? Number(miles[1]) : null,
    targetCityOrZip: zip ? zip[1]! : null,
  };
}

/** Pull the first JSON object/array out of a model reply. */
function extractJson(text: string | undefined): unknown {
  if (!text) return null;
  const cleaned = text.replace(/```(?:json)?/gi, "");
  const start = cleaned.search(/[[{]/);
  if (start < 0) return null;
  const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** Models rename fields freely, so accept a few aliases per field. */
function pick(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return null;
}

function coerceDraft(raw: unknown, prompt: string): MagicDraft {
  const base = heuristicDraft(prompt);
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;

  const num = (v: unknown) => {
    const n = typeof v === "string" ? Number(v.replace(/[^\d.]/g, "")) : Number(v);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  };
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

  const cat = str(pick(o, ["category", "plan_category", "type", "activity"]))?.toLowerCase();
  const date = str(pick(o, ["date", "plan_date", "day"]));
  const time = str(pick(o, ["time", "start_time", "startTime", "when"]));
  const tier = str(pick(o, ["budget_tier", "budgetTier", "budget"]))?.toLowerCase();

  return {
    title: str(pick(o, ["title", "name", "plan_title"]))?.slice(0, 80) ?? base.title,
    category: (CATEGORY_IDS as string[]).includes(cat ?? "")
      ? (cat as PlanCategory)
      : base.category,
    date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
    time: time && /^\d{1,2}:\d{2}/.test(time) ? time.slice(0, 5).padStart(5, "0") : null,
    budgetTier: tier === "low" || tier === "medium" || tier === "high" ? tier : null,
    maxSpendPerPerson:
      num(pick(o, ["max_spend_per_person", "budget_per_person", "maxSpendPerPerson", "max_budget"])) ??
      base.maxSpendPerPerson,
    searchRadiusMiles: num(pick(o, ["search_radius_miles", "radius_miles", "radius"])),
    targetCityOrZip:
      str(pick(o, ["target_city_zip", "zip", "zip_code", "city", "location", "area"])) ??
      base.targetCityOrZip,
  };
}

export async function parseMagicPrompt(prompt: string, todayIso: string): Promise<MagicDraft> {
  const instructions = [
    "You turn a casual group-planning sentence into structured JSON.",
    "Reply with ONLY a JSON object using exactly these keys:",
    '{"title":string,"category":string,"date":string|null,"time":string|null,"budget_tier":"low"|"medium"|"high"|null,"max_spend_per_person":number|null,"search_radius_miles":number|null,"target_city_zip":string|null}',
    `Today is ${todayIso}. Resolve relative dates ("this Friday", "tomorrow") to a real YYYY-MM-DD date.`,
    `category must be one of: ${CATEGORY_IDS.join(", ")}.`,
    "time is 24h HH:MM. max_spend_per_person is dollars per person when a cap is implied.",
    "target_city_zip is a US ZIP code when given, otherwise the city/place name, otherwise null.",
    "title is a short friendly plan name (max ~6 words), not the whole sentence.",
    "Unknown fields must be null. Never invent a budget or location that is not implied.",
    "",
    `Request: ${prompt}`,
  ].join("\n");

  try {
    const { output } = await generateText({
      model: lovableAiModel(),
      output: Output.object({ schema: DraftSchema }),
      prompt: instructions,
    });
    return coerceDraft(output, prompt);
  } catch (error) {
    // The model often answers with its own key names; salvage the raw text.
    if (NoObjectGeneratedError.isInstance(error)) {
      return coerceDraft(extractJson(error.text), prompt);
    }
    try {
      const { text } = await generateText({ model: lovableAiModel(), prompt: instructions });
      return coerceDraft(extractJson(text), prompt);
    } catch {
      return heuristicDraft(prompt);
    }
  }
}

/* ------------------------------------------------------------------ */
/* 2. Compromise summaries ("why this works")                          */
/* ------------------------------------------------------------------ */

/**
 * Group-safe aggregate for one option. Deliberately contains NO member names
 * and no per-person answers — only the counts and caps the whole group can see.
 */
export type CompromiseFacts = {
  id: string;
  title: string;
  score: number;
  feasible: boolean;
  costMin: number;
  costMax: number;
  travelMinutes: number;
  distanceMiles: number | null;
  breakdown: ScoreBreakdown;
  tightestBudget: number | null;
  tightestTravelMinutes: number | null;
  blockedCount: number;
  memberCount: number;
  dietaryNeeds: string[];
};

const SummarySchema = z.object({
  items: z.array(z.object({ id: z.string(), summary: z.string() })),
});

function fallbackSummary(f: CompromiseFacts): string {
  const budget = f.tightestBudget != null ? `the group's tightest $${f.tightestBudget} cap` : "everyone's budget";
  const travel = f.tightestTravelMinutes != null ? `${f.tightestTravelMinutes} min` : `${f.travelMinutes} min`;
  return f.feasible
    ? `${f.score}% group match — fits ${budget} at $${f.costMin}–${f.costMax} per person and keeps drive time near ${travel} for everyone.`
    : `${f.score}% group match — ${f.blockedCount} of ${f.memberCount} still have a hard conflict here, usually budget or curfew.`;
}

export async function summarizeCompromises(facts: CompromiseFacts[]): Promise<Record<string, string>> {
  const fallback = Object.fromEntries(facts.map((f) => [f.id, fallbackSummary(f)]));
  if (!facts.length) return fallback;

  try {
    const { output } = await generateText({
      model: lovableAiModel(),
      output: Output.object({ schema: SummarySchema }),
      prompt: [
        "You explain why a group activity option works, for a privacy-first planning app.",
        "Write exactly two short sentences per option, under 240 characters total.",
        "Start with the match percentage, e.g. '94% group match — ...'.",
        "PRIVACY RULE: never name a person and never attribute a constraint to an individual.",
        "Talk about the group as a whole ('the tightest $25 budget in the group', 'everyone stays under 12 minutes of driving').",
        "Be concrete with the numbers provided. If the option is not feasible, say plainly what still blocks it.",
        'Reply with ONLY JSON: {"items":[{"id":string,"summary":string}]} — one entry per option below.',
        "",
        JSON.stringify(
          facts.map((f) => ({
            id: f.id,
            title: f.title,
            score: f.score,
            feasible: f.feasible,
            per_person_cost: [f.costMin, f.costMax],
            drive_minutes: f.travelMinutes,
            distance_miles: f.distanceMiles,
            group_size: f.memberCount,
            members_blocked: f.blockedCount,
            tightest_budget_cap: f.tightestBudget,
            tightest_travel_limit_minutes: f.tightestTravelMinutes,
            dietary_needs_in_group: f.dietaryNeeds,
            fit_scores: {
              budget: f.breakdown.budgetFit,
              schedule: f.breakdown.scheduleFit,
              travel: f.breakdown.travelFit,
              dietary: f.breakdown.dietaryFit,
              preference: f.breakdown.preferenceFit,
              fairness: f.breakdown.fairness,
            },
            cautions: f.breakdown.cautions,
          })),
        ),
      ].join("\n"),
    });

    return mergeSummaries(fallback, output.items);
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      const raw = extractJson(error.text) as { items?: unknown } | unknown[] | null;
      const items = Array.isArray(raw) ? raw : (raw?.items ?? null);
      if (Array.isArray(items)) return mergeSummaries(fallback, items);
    }
    return fallback;
  }
}

function mergeSummaries(fallback: Record<string, string>, items: unknown[]): Record<string, string> {
  const map = { ...fallback };
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = typeof o["id"] === "string" ? o["id"] : null;
    const summary =
      typeof o["summary"] === "string"
        ? o["summary"]
        : typeof o["text"] === "string"
          ? o["text"]
          : null;
    if (id && summary && id in map && summary.trim()) map[id] = summary.trim();
  }
  return map;
}

/* ------------------------------------------------------------------ */
/* 3. Plan B guardian                                                  */
/* ------------------------------------------------------------------ */

const PlanBSchema = z.object({ pitch: z.string() });

export async function writePlanBPitch(input: {
  forecast: Forecast;
  outdoorTitle: string;
  indoorTitle: string | null;
  indoorScore: number | null;
}): Promise<string> {
  const fallback = input.indoorTitle
    ? `${input.forecast.emoji} ${input.forecast.alertText ?? input.forecast.label} on plan day. ${input.indoorTitle} is the strongest indoor option that still works for the group${input.indoorScore != null ? ` at ${input.indoorScore}% match` : ""}.`
    : `${input.forecast.emoji} ${input.forecast.alertText ?? input.forecast.label} on plan day — ${input.outdoorTitle} is outdoors, so consider regenerating options for an indoor backup.`;

  try {
    const { output } = await generateText({
      model: lovableAiModel(),
      output: Output.object({ schema: PlanBSchema }),
      prompt: [
        "Write a two-sentence weather warning for a group plan, friendly and direct.",
        "First sentence: the weather problem for the current outdoor pick.",
        "Second sentence: why the suggested indoor swap still works for the group.",
        "No names, no emoji spam, under 220 characters.",
        "",
        JSON.stringify({
          forecast: {
            label: input.forecast.label,
            rain_chance: input.forecast.precipProbability,
            high_f: Math.round(input.forecast.tempMaxF),
            alert: input.forecast.alertText,
          },
          current_outdoor_pick: input.outdoorTitle,
          suggested_indoor_swap: input.indoorTitle,
          indoor_match_score: input.indoorScore,
        }),
      ].join("\n"),
    });
    return output.pitch.trim() || fallback;
  } catch {
    return fallback;
  }
}
