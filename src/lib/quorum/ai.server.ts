// Server-only AI helpers. Every function degrades gracefully: if the gateway
// is unavailable or the model returns something unusable, callers still get a
// deterministic, non-AI result instead of an error.
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { z } from "zod";
import { aiModel, aiGenerationOptions, recordAiFailure } from "@/lib/ai-gateway.server";
import { CATEGORIES, type PlanCategory, type ScoreBreakdown } from "./types";
import type { Forecast } from "./weather";
import {
  MAX_STOPS,
  STOP_KIND_IDS,
  STOP_KINDS,
  type ItineraryDraft,
  type StopKind,
} from "./itinerary";

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
  const category = (CATEGORIES.find((c) => text.includes(c.id))?.id ??
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
    time: time && /^(?:[01]?\d|2[0-3]):[0-5]\d$/.test(time) ? time.padStart(5, "0") : null,
    budgetTier: tier === "low" || tier === "medium" || tier === "high" ? tier : null,
    maxSpendPerPerson:
      num(
        pick(o, ["max_spend_per_person", "budget_per_person", "maxSpendPerPerson", "max_budget"]),
      ) ?? base.maxSpendPerPerson,
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
      model: aiModel("magic_plan_draft"),
      ...aiGenerationOptions("magic_plan_draft"),
      output: Output.object({ schema: DraftSchema }),
      prompt: instructions,
    });
    return coerceDraft(output, prompt);
  } catch (error) {
    // The model often answers with its own key names; salvage the raw text.
    if (NoObjectGeneratedError.isInstance(error)) {
      return coerceDraft(extractJson(error.text), prompt);
    }
    void recordAiFailure("magic_plan_draft", error);
    return heuristicDraft(prompt);
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
  return f.feasible
    ? `${f.score}% group match — estimated $${f.costMin}–${f.costMax} per person. This option meets everyone's requirements.`
    : `${f.score}% group match — this option does not meet every requirement. Refresh the options or review your own private answers.`;
}

export async function summarizeCompromises(
  facts: CompromiseFacts[],
): Promise<Record<string, string>> {
  const fallback = Object.fromEntries(facts.map((f) => [f.id, fallbackSummary(f)]));
  if (!facts.length) return fallback;

  try {
    const { output } = await generateText({
      model: aiModel("compromise_summaries"),
      ...aiGenerationOptions("compromise_summaries"),
      output: Output.object({ schema: SummarySchema }),
      prompt: [
        "You explain why a group activity option works, for a privacy-first planning app.",
        "Write exactly two short sentences per option, under 240 characters total.",
        "Start with the match percentage, e.g. '94% group match — ...'.",
        "PRIVACY RULE: never name a person and never attribute a constraint to an individual.",
        "Use only public option facts and pass/fail outcomes. Never reveal a private budget cap, curfew, dietary answer, or travel limit.",
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
    void recordAiFailure("compromise_summaries", error);
    return fallback;
  }
}

function mergeSummaries(
  fallback: Record<string, string>,
  items: unknown[],
): Record<string, string> {
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
      model: aiModel("plan_b_pitch"),
      ...aiGenerationOptions("plan_b_pitch"),
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
  } catch (error) {
    void recordAiFailure("plan_b_pitch", error);
    return fallback;
  }
}

/* ------------------------------------------------------------------ */
/* 4. Group conflict resolution                                        */
/* ------------------------------------------------------------------ */

export type ConflictFacts = {
  planTitle: string;
  category: string;
  memberCount: number;
  startTime: string | null;
  endTime: string | null;
  earliestCurfew: string | null;
  curfewBreachCount: number;
  tightestBudget: number | null;
  topCostMin: number | null;
  topCostMax: number | null;
  voteSplit: {
    title: string;
    votes: number;
    id: string;
    costMin: number | null;
    costMax: number | null;
    feasible: boolean;
  }[];
  /** Forecast for the top option's location/date, when available. */
  weather: { summary: string; precipProbability: number | null; alert: boolean } | null;
  dietaryNeeds: string[];
  longestDriveMinutes: number | null;
  travelLimitMinutes: number | null;
};

export type CompromisePlan = {
  needed: boolean;
  headline: string;
  detail: string;
  suggestedStart: string | null;
  suggestedRecommendationId: string | null;
  suggestedRecommendationTitle: string | null;
};

const CompromiseSchema = z.object({
  headline: z.string(),
  detail: z.string(),
});

/** Deterministic compromise used when AI is unavailable or unusable. */
export function heuristicCompromise(f: ConflictFacts): CompromisePlan {
  const leader = [...f.voteSplit].sort((a, b) => b.votes - a.votes)[0];
  const tie = Boolean(
    leader?.votes && f.voteSplit.filter((v) => v.votes === leader.votes).length > 1,
  );
  const overBudget =
    f.tightestBudget != null && f.topCostMax != null && f.topCostMax > f.tightestBudget;
  const timingConflict = f.curfewBreachCount > 0;
  const needed = tie || overBudget || timingConflict;
  const safe = f.voteSplit
    .filter(
      (v) => v.feasible && (!overBudget || (v.costMax != null && v.costMax <= f.tightestBudget!)),
    )
    .sort((a, b) => b.votes - a.votes || (a.costMax ?? Infinity) - (b.costMax ?? Infinity))[0];
  const proposed = !timingConflict && (tie || overBudget) ? safe : null;
  return {
    needed,
    headline: !needed
      ? "This plan meets the current requirements"
      : proposed
        ? `Consider ${proposed.title}`
        : "This outing needs another look",
    detail: proposed
      ? "This available option meets the group’s requirements."
      : needed
        ? "Refresh the options or review your own private answers. A change must be checked before the plan is locked in."
        : "No timing or budget conflict was found in the current options.",
    suggestedStart: null,
    suggestedRecommendationId: proposed?.id ?? null,
    suggestedRecommendationTitle: proposed?.title ?? null,
  };
}

/** Gemini Flash compromise: group-safe aggregates only, never names a person. */
export async function writeCompromise(f: ConflictFacts): Promise<CompromisePlan> {
  const fallback = heuristicCompromise(f);
  if (!fallback.needed) return fallback;
  try {
    const { output } = await generateText({
      model: aiModel("ai_compromise"),
      ...aiGenerationOptions("ai_compromise"),
      output: Output.object({ schema: CompromiseSchema }),
      prompt: [
        "Explain this already checked proposal in plain language. Do not propose a different time or venue.",
        "Never reveal an individual's budget, curfew, diet, or travel limit. Never claim all constraints pass when no validated proposal exists.",
        "headline: under 90 characters. detail: one short sentence.",
        JSON.stringify({
          plan: f.planTitle,
          proposed_option: fallback.suggestedRecommendationTitle,
          needs_new_options: !fallback.suggestedRecommendationId,
          explanation: fallback.detail,
        }),
      ].join("\n"),
    });
    return {
      ...fallback,
      headline: output.headline.trim() || fallback.headline,
      detail: output.detail.trim() || fallback.detail,
    };
  } catch (error) {
    void recordAiFailure("ai_compromise", error);
    return fallback;
  }
}

/* ------------------------------------------------------------------ */
/* 5. Itinerary drafting (Magic AI plan)                               */
/* ------------------------------------------------------------------ */

const ItinerarySchema = z.object({
  title: z.string(),
  vibe: z.string(),
  date: z.string().nullable(),
  start_time: z.string().nullable(),
  budget_per_person: z.number().nullable(),
  area: z.string().nullable(),
  search_radius_miles: z.number().nullable(),
  stops: z.array(
    z.object({
      kind: z.enum(STOP_KIND_IDS),
      label: z.string(),
      minutes: z.number(),
      why: z.string(),
    }),
  ),
  anchor_index: z.number(),
  invite_message: z.string(),
  rescout_stop_ids: z.array(z.string()),
});

/** Stop kinds a prompt plainly names, in the order it names them. */
function heuristicStops(text: string): StopKind[] {
  const hits: [number, StopKind][] = [];
  const words: [RegExp, StopKind][] = [
    [/\b(dinner|lunch|eat|food|restaurant|pho|sushi|tacos?|pizza)\b/, "restaurant"],
    [/\b(burgers?|fast food|wings)\b/, "fast_food"],
    [/\b(coffee|cafe|study)\b/, "cafe"],
    [/\b(boba|bubble tea)\b/, "boba"],
    [/\b(dessert|ice cream|froyo|gelato)\b/, "dessert"],
    [/\bbowl(ing)?\b/, "bowling"],
    [/\b(movie|film|cinema)\b/, "cinema"],
    [/\barcade\b/, "arcade"],
    [/\b(mini ?golf|putt)\b/, "mini_golf"],
    [/\bescape room\b/, "escape_room"],
    [/\btrampoline\b/, "trampoline"],
    [/\b(skating|ice rink)\b/, "ice_skating"],
    [/\bmuseum\b/, "museum"],
    [/\b(show|play|musical|concert)\b/, "theater"],
    [/\b(theme park|water park|six flags)\b/, "theme_park"],
    [/\b(park|picnic)\b/, "park"],
    [/\b(lake|beach)\b/, "lake"],
    [/\b(mall|shopping)\b/, "mall"],
  ];
  for (const [re, kind] of words) {
    const m = re.exec(text);
    if (m && !hits.some(([, k]) => k === kind)) hits.push([m.index, kind]);
  }
  return hits
    .sort((a, b) => a[0] - b[0])
    .map(([, k]) => k)
    .slice(0, MAX_STOPS);
}

/** Deterministic itinerary when AI is unavailable: the stops the prompt names, in order. */
function heuristicItinerary(prompt: string, todayIso: string): ItineraryDraft {
  const base = heuristicDraft(prompt);
  const kinds = heuristicStops(prompt.toLowerCase());
  const stops = (kinds.length ? kinds : (["restaurant"] as StopKind[])).map((kind, i) => ({
    id: `s${i + 1}`,
    kind,
    label: STOP_KINDS[kind].label,
    why: "",
    minutes: STOP_KINDS[kind].minutes,
  }));
  return {
    version: 1,
    title: base.title,
    vibe: "",
    date: base.date,
    start: base.time ?? "18:30",
    budgetPerPerson: base.maxSpendPerPerson,
    anchor: 0,
    stops,
    invite: `${base.title} — answer privately and vote on spots in Syncly.`,
    area: base.targetCityOrZip,
    searchRadiusMiles: base.searchRadiusMiles,
  };
}

function coerceItinerary(
  raw: z.infer<typeof ItinerarySchema>,
  prompt: string,
  todayIso: string,
): ItineraryDraft {
  const base = heuristicItinerary(prompt, todayIso);
  const stops = raw.stops
    .filter((s) => (STOP_KIND_IDS as string[]).includes(s.kind))
    .slice(0, MAX_STOPS)
    .map((s, i) => {
      const def = STOP_KINDS[s.kind];
      const minutes = Number.isFinite(s.minutes) ? Math.round(s.minutes) : def.minutes;
      return {
        id: `s${i + 1}`,
        kind: s.kind,
        label: (s.label.trim() || def.label).slice(0, 40),
        why: s.why.trim().slice(0, 160),
        minutes: Math.min(Math.max(minutes, 15), 600),
      };
    });
  if (!stops.length) return base;
  const time = raw.start_time?.trim() ?? "";
  const date = raw.date?.trim() ?? "";
  const anchor = Math.round(raw.anchor_index);
  const budget = raw.budget_per_person;
  const radius = raw.search_radius_miles;
  return {
    version: 1,
    title: raw.title.trim().slice(0, 80) || base.title,
    vibe: raw.vibe.trim().slice(0, 200),
    date: /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= todayIso ? date : base.date,
    start: /^(?:[01]?\d|2[0-3]):[0-5]\d$/.test(time) ? time.padStart(5, "0") : base.start,
    budgetPerPerson: budget != null && budget >= 0 ? Math.round(budget) : base.budgetPerPerson,
    anchor: anchor >= 0 && anchor < stops.length ? anchor : 0,
    stops,
    invite: raw.invite_message.trim().slice(0, 280) || base.invite,
    area: raw.area?.trim() || base.area,
    searchRadiusMiles: radius != null && radius > 0 ? Math.round(radius) : base.searchRadiusMiles,
  };
}

/**
 * Turns a casual request into a multi-stop night: which kinds of places, in
 * what order, how long each, when it starts, and a ready invite line. Venues
 * are looked up afterwards from real place data -- the model never names one.
 */
export async function draftItinerary(
  prompt: string,
  todayIso: string,
  current?: import("./itinerary").Itinerary,
): Promise<ItineraryDraft> {
  const kinds = STOP_KIND_IDS.map((k) => `${k} (${STOP_KINDS[k].label})`).join(", ");
  try {
    const { output } = await generateText({
      model: aiModel("itinerary_draft"),
      ...aiGenerationOptions("itinerary_draft"),
      output: Output.object({ schema: ItinerarySchema }),
      system: [
        "You plan real hangouts for a group-planning app used mostly by high schoolers and their friends.",
        "Turn the request into an ordered itinerary of 1-4 stops that flow naturally (e.g. food, then an activity, then dessert).",
        "Only add stops the request asks for or clearly implies, plus at most one natural add-on (like dessert after dinner). Keep it doable in one outing.",
        `Each stop's kind must be one of: ${kinds}.`,
        'label is a short name for that stop ("Dinner", "Bowling", "Boba run"). minutes is a realistic stay.',
        "why is one short, specific sentence on why that stop fits this group's night. No venue names -- real venues are looked up later.",
        `Today is ${todayIso}. Resolve relative dates to YYYY-MM-DD; null if no day is implied. start_time is 24h HH:MM for the first stop, null if not implied.`,
        "budget_per_person is the per-person dollar cap only when one is stated or implied. area is the US ZIP or city named, else null.",
        "rescout_stop_ids is an empty array for a new itinerary. For revisions, list current stop ids whose venues should be replaced. Preserve the other stops and all accepted edits.",
        "anchor_index is the stop the night is built around (the one the group should vote on).",
        "title is a short friendly name (max ~6 words). vibe is one upbeat sentence describing the night.",
        "invite_message is a casual text to the group (under 200 characters) saying what the plan is and asking them to answer privately and vote in Syncly. At most one emoji.",
        "Never invent a person, a venue, or a budget that isn't implied.",
      ].join(" "),
      prompt: current
        ? JSON.stringify({
            current_itinerary: current,
            requested_change: prompt,
            rules:
              "Revise the current itinerary, retaining all previous edits and unaffected stops. rescout_stop_ids lists the current stop ids whose venue must change; empty for timing-only edits. Never revert an earlier change.",
          })
        : `Request: ${prompt}`,
    });
    const draft = coerceItinerary(output, prompt, todayIso);
    const used = new Set<string>();
    if (current)
      draft.stops = draft.stops.map((stop) => {
        const existing = current.stops.find((s) => s.kind === stop.kind && !used.has(s.id));
        const id = existing?.id ?? `new-${stop.id}`;
        used.add(id);
        return { ...stop, id };
      });
    return { ...draft, aiGenerated: true, rescoutStopIds: output.rescout_stop_ids };
  } catch (error) {
    void recordAiFailure("itinerary_draft", error);
    return current
      ? {
          ...current,
          stops: current.stops.map(({ options: _options, pick: _pick, ...stop }) => stop),
          area: current.zip ?? current.areaLabel,
          searchRadiusMiles: null,
          aiGenerated: false,
          rescoutStopIds: [],
        }
      : { ...heuristicItinerary(prompt, todayIso), aiGenerated: false, rescoutStopIds: [] };
  }
}
