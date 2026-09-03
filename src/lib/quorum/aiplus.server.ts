// Server-only AI helpers for the "AI everywhere" surfaces: plan concierge chat,
// squad digest, vibe search ranking and guardian summaries.
// Every helper degrades to a deterministic result when the model is unavailable.
import { generateText } from "ai";
import { lovableAiModel } from "@/lib/ai-gateway.server";

/** One chat turn exchanged with the concierge. */
export type ConciergeTurn = { role: "user" | "assistant"; content: string };

async function ask(system: string, user: string, fallback: string): Promise<string> {
  try {
    const { text } = await generateText({
      model: lovableAiModel(),
      system,
      prompt: user,
    });
    const out = text?.trim();
    return out && out.length > 1 ? out : fallback;
  } catch {
    return fallback;
  }
}

/** Pull the first JSON value out of a model reply. */
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

/* ------------------------------------------------------------------ */
/* 1. Plan concierge chat                                              */
/* ------------------------------------------------------------------ */

const CONCIERGE_SYSTEM = [
  "You are the Syncly plan concierge: a warm, concise group-hangout assistant.",
  "You help a group decide where to go, when to meet, what it costs and how to get there.",
  "Only use the plan facts you are given. Never invent venues, prices, phone numbers or addresses.",
  "Never name what an individual person privately answered; talk in group terms only.",
  "Answer in at most 120 words. Use short markdown bullets when listing options.",
  "No emoji. If a fact is missing, say what the host should add instead of guessing.",
].join(" ");

export async function conciergeReply(
  facts: unknown,
  history: ConciergeTurn[],
  question: string,
): Promise<string> {
  const transcript = history
    .slice(-8)
    .map((t) => `${t.role === "user" ? "Member" : "Concierge"}: ${t.content}`)
    .join("\n");
  const prompt = [
    "PLAN FACTS (JSON):",
    JSON.stringify(facts).slice(0, 8000),
    transcript ? `\nCONVERSATION SO FAR:\n${transcript}` : "",
    `\nNEW QUESTION:\n${question}`,
  ].join("\n");
  return ask(
    CONCIERGE_SYSTEM,
    prompt,
    "I can't reach the AI service right now. The plan details are on this page — the vote counts and travel times are up to date.",
  );
}

/* ------------------------------------------------------------------ */
/* 2. Smart squad digest                                               */
/* ------------------------------------------------------------------ */

export type SquadDigest = {
  headline: string;
  bullets: string[];
  nextBest: string | null;
  aiGenerated: boolean;
};

export async function writeSquadDigest(facts: {
  needsYou: { title: string; group: string; status: string }[];
  upcoming: { title: string; group: string; when: string | null }[];
  recentlyDone: { title: string; group: string }[];
  stalled: { title: string; group: string; responded: number; total: number }[];
}): Promise<SquadDigest> {
  const fallbackBullets = [
    ...facts.needsYou.slice(0, 2).map((p) => `${p.title} in ${p.group} is waiting on your answer.`),
    ...facts.upcoming.slice(0, 2).map((p) => `${p.title} with ${p.group} is coming up.`),
    ...facts.stalled
      .slice(0, 1)
      .map((p) => `${p.title} has ${p.responded} of ${p.total} answers in.`),
  ].slice(0, 4);

  try {
    const { text } = await generateText({
      model: lovableAiModel(),
      system: [
        "You write a short weekly recap for a group-plans app.",
        "Be specific, warm and factual — only use the given facts, never invent plans or people.",
        "No emoji. Each bullet is one sentence under 110 characters.",
        'Reply with ONLY JSON: {"headline":string,"bullets":[string],"next_best":string}',
        "headline is under 60 characters. Give 2 to 4 bullets.",
        "next_best is one concrete suggestion for the group's next plan, phrased as an invitation.",
      ].join(" "),
      prompt: JSON.stringify(facts).slice(0, 6000),
    });
    const parsed = extractJson(text) as
      | { headline?: string; bullets?: unknown; next_best?: string }
      | null;
    const bullets = Array.isArray(parsed?.bullets)
      ? parsed!.bullets.filter((b): b is string => typeof b === "string").slice(0, 4)
      : [];
    if (parsed?.headline && bullets.length) {
      return {
        headline: parsed.headline.slice(0, 80),
        bullets: bullets.map((b) => b.slice(0, 160)),
        nextBest: parsed.next_best?.slice(0, 180) ?? null,
        aiGenerated: true,
      };
    }
  } catch {
    /* fall through */
  }

  return {
    headline: fallbackBullets.length ? "Here's your week" : "Nothing needs you right now",
    bullets: fallbackBullets.length
      ? fallbackBullets
      : ["No open plans — start one and your squad gets a nudge."],
    nextBest: null,
    aiGenerated: false,
  };
}

/* ------------------------------------------------------------------ */
/* 3. Vibe search ranking                                              */
/* ------------------------------------------------------------------ */

export type VibeRank = { key: string; reason: string };

export async function rankByVibe(
  query: string,
  spots: { key: string; title: string; subtitle: string; cuisine: string | null; priceLevel: string; costMin: number; costMax: number; miles: number }[],
): Promise<{ ranks: VibeRank[]; aiGenerated: boolean }> {
  if (!spots.length) return { ranks: [], aiGenerated: false };
  try {
    const { text } = await generateText({
      model: lovableAiModel(),
      system: [
        "You match local venues to a natural-language vibe request for a group hangout.",
        "Pick the best 5 or fewer venues from the given list, best first.",
        "Only use keys from the list. Never invent a venue.",
        "Each reason is one sentence under 90 characters, concrete, referencing price, distance or cuisine. No emoji.",
        'Reply with ONLY JSON: [{"key":string,"reason":string}]',
      ].join(" "),
      prompt: `VIBE REQUEST: ${query}\n\nVENUES:\n${JSON.stringify(spots).slice(0, 8000)}`,
    });
    const parsed = extractJson(text);
    const valid = new Set(spots.map((s) => s.key));
    const ranks = Array.isArray(parsed)
      ? (parsed as { key?: unknown; reason?: unknown }[])
          .filter((r) => typeof r.key === "string" && valid.has(r.key))
          .map((r) => ({
            key: r.key as string,
            reason: typeof r.reason === "string" ? r.reason.slice(0, 140) : "Good fit for the group.",
          }))
          .slice(0, 5)
      : [];
    if (ranks.length) return { ranks, aiGenerated: true };
  } catch {
    /* fall through */
  }
  return {
    ranks: spots
      .slice(0, 5)
      .map((s) => ({ key: s.key, reason: `${s.miles} mi away · about $${s.costMin}–${s.costMax} each.` })),
    aiGenerated: false,
  };
}

/* ------------------------------------------------------------------ */
/* 4. Guardian summary                                                 */
/* ------------------------------------------------------------------ */

export type GuardianAiSummary = {
  summary: string;
  watchouts: string[];
  aiGenerated: boolean;
};

export async function writeGuardianSummary(facts: {
  teen: string;
  status: string;
  curfew: string | null;
  sharing: boolean;
  plans: {
    title: string;
    when: string | null;
    venue: string | null;
    supervised: boolean;
    approval: string | null;
    rides: { car: string; driver: string; departed: boolean }[];
  }[];
  delays: { reason: string; minutes: number }[];
  checkins: { status: string; place: string | null }[];
}): Promise<GuardianAiSummary> {
  const fallback: GuardianAiSummary = {
    summary: `${facts.teen} is ${facts.status.toLowerCase()}. ${
      facts.plans.length
        ? `${facts.plans.length} plan${facts.plans.length === 1 ? "" : "s"} on the calendar.`
        : "No plans scheduled right now."
    }`,
    watchouts: [
      ...facts.plans
        .filter((p) => p.approval === "pending")
        .slice(0, 2)
        .map((p) => `${p.title} is waiting on your approval.`),
      ...(facts.sharing ? [] : ["Location sharing is off right now."]),
    ],
    aiGenerated: false,
  };

  try {
    const { text } = await generateText({
      model: lovableAiModel(),
      system: [
        "You write a calm, plain-language evening summary for a parent about their teen's plans.",
        "Be reassuring and factual — only use the given facts, never speculate about safety or invent details.",
        "No emoji, no alarmist language.",
        'Reply with ONLY JSON: {"summary":string,"watchouts":[string]}',
        "summary is 2 short sentences under 240 characters. watchouts is 0 to 3 short action items for the parent.",
      ].join(" "),
      prompt: JSON.stringify(facts).slice(0, 6000),
    });
    const parsed = extractJson(text) as { summary?: string; watchouts?: unknown } | null;
    if (parsed?.summary) {
      return {
        summary: parsed.summary.slice(0, 400),
        watchouts: Array.isArray(parsed.watchouts)
          ? parsed.watchouts.filter((w): w is string => typeof w === "string").slice(0, 3)
          : [],
        aiGenerated: true,
      };
    }
  } catch {
    /* fall through */
  }
  return fallback;
}
