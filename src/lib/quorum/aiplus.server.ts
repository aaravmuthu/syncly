// Server-only AI helpers for the "AI everywhere" surfaces: plan concierge chat,
// squad digest, vibe search ranking and guardian summaries.
// Every helper degrades to a deterministic result when the model is unavailable.
import { generateText, NoObjectGeneratedError, Output, tool } from "ai";
import { z } from "zod";
import { lovableAiModel } from "@/lib/ai-gateway.server";

/** One chat turn exchanged with the concierge. */
export type ConciergeTurn = { role: "user" | "assistant"; content: string };

/**
 * An action the concierge proposes alongside its text answer. This is intent
 * only — the model never executes anything. The client renders it as a
 * confirm card and, only on an explicit tap, calls the same already-
 * authorized mutation a manual button press would (castVote/applyAiCompromise/
 * sendMessage), so no new trust surface is introduced by the AI layer.
 */
export type ConciergeAction =
  | { type: "cast_vote"; recommendationId: string; recommendationTitle: string }
  | { type: "change_time"; newStartTime: string; reason: string }
  | { type: "select_option"; recommendationId: string; recommendationTitle: string }
  | { type: "send_nudge"; message: string };

const conciergeTools = {
  cast_vote: tool({
    description:
      "Cast the asking member's own vote for one of the plan's listed options. Only use a recommendationId that appears in the plan facts given to you.",
    inputSchema: z.object({
      recommendationId: z.string().describe("Must exactly match an option id from the plan facts"),
      recommendationTitle: z.string(),
    }),
  }),
  change_time: tool({
    description:
      "Propose a new start time for the plan. Only the host can actually apply this — still propose it when a non-host asks, the app tells them to ask their host.",
    inputSchema: z.object({
      newStartTime: z.string().describe("24-hour HH:MM"),
      reason: z.string(),
    }),
  }),
  select_option: tool({
    description:
      "Lock in one of the plan's listed options as the group's final choice. Host-only, same rule as change_time.",
    inputSchema: z.object({
      recommendationId: z.string().describe("Must exactly match an option id from the plan facts"),
      recommendationTitle: z.string(),
    }),
  }),
  send_nudge: tool({
    description: "Send a short message to the group's chat on the asking member's behalf.",
    inputSchema: z.object({ message: z.string().max(300) }),
  }),
};

function mapToolCall(call: { toolName: string; input: unknown }): ConciergeAction | undefined {
  const input = call.input as Record<string, unknown>;
  switch (call.toolName) {
    case "cast_vote":
      if (typeof input["recommendationId"] === "string")
        return {
          type: "cast_vote",
          recommendationId: input["recommendationId"],
          recommendationTitle: String(input["recommendationTitle"] ?? "this option"),
        };
      return undefined;
    case "change_time":
      if (typeof input["newStartTime"] === "string")
        return {
          type: "change_time",
          newStartTime: input["newStartTime"],
          reason: String(input["reason"] ?? ""),
        };
      return undefined;
    case "select_option":
      if (typeof input["recommendationId"] === "string")
        return {
          type: "select_option",
          recommendationId: input["recommendationId"],
          recommendationTitle: String(input["recommendationTitle"] ?? "this option"),
        };
      return undefined;
    case "send_nudge":
      if (typeof input["message"] === "string" && input["message"].trim())
        return { type: "send_nudge", message: input["message"].trim().slice(0, 300) };
      return undefined;
    default:
      return undefined;
  }
}

function actionIntro(action: ConciergeAction): string {
  switch (action.type) {
    case "cast_vote":
      return `Sure — want me to vote for ${action.recommendationTitle}?`;
    case "change_time":
      return `Here's a new time to consider: ${action.newStartTime}.`;
    case "select_option":
      return `Want to lock in ${action.recommendationTitle}?`;
    case "send_nudge":
      return "Here's a message you could send the group:";
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
  "You may call at most one tool per reply, and only when the member's message clearly",
  "asks for that action (e.g. 'vote for X', 'change the time to 7', 'tell the group I'm running late').",
  "Never call a tool just because an option exists — most questions need a plain answer, no tool call.",
  "Always still write a short plain-text answer even when you call a tool.",
].join(" ");

const CONCIERGE_FALLBACK =
  "I can't reach the AI service right now. The plan details are on this page — the vote counts and travel times are up to date.";

export async function conciergeReply(
  facts: unknown,
  history: ConciergeTurn[],
  question: string,
): Promise<{ answer: string; action?: ConciergeAction }> {
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

  try {
    const result = await generateText({
      model: lovableAiModel(),
      system: CONCIERGE_SYSTEM,
      prompt,
      tools: conciergeTools,
    });
    const action = result.toolCalls?.[0] ? mapToolCall(result.toolCalls[0]) : undefined;
    const answer = result.text?.trim() || (action ? actionIntro(action) : "");
    if (!answer) return { answer: CONCIERGE_FALLBACK };
    return action ? { answer, action } : { answer };
  } catch {
    return { answer: CONCIERGE_FALLBACK };
  }
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

const SquadDigestSchema = z.object({
  headline: z.string(),
  bullets: z.array(z.string()),
  next_best: z.string(),
});

export async function writeSquadDigest(facts: {
  needsYou: { title: string; group: string; status: string }[];
  /** `when` is a pre-formatted relative label ("in 3 days", "this weekend"), not raw ISO. */
  upcoming: { title: string; group: string; when: string | null }[];
  recentlyDone: { title: string; group: string }[];
  stalled: { title: string; group: string; responded: number; total: number }[];
}): Promise<SquadDigest> {
  const fallbackBullets = [
    ...facts.needsYou.slice(0, 2).map((p) => `${p.title} in ${p.group} is waiting on your answer.`),
    ...facts.upcoming.slice(0, 2).map((p) =>
      p.when ? `${p.title} with ${p.group} is ${p.when}.` : `${p.title} with ${p.group} is locked in.`,
    ),
    ...facts.stalled
      .slice(0, 1)
      .map((p) => `${p.title} has ${p.responded} of ${p.total} answers in.`),
    ...facts.recentlyDone.slice(0, 1).map((p) => `You just wrapped up ${p.title} with ${p.group}.`),
  ].slice(0, 4);

  try {
    const { output } = await generateText({
      model: lovableAiModel(),
      output: Output.object({ schema: SquadDigestSchema }),
      system: [
        "You write a short weekly recap for a group-plans app.",
        "Be specific, warm and factual — only use the given facts, never invent plans or people.",
        "No emoji. Each bullet is one sentence under 110 characters.",
        "headline is under 60 characters. Give 2 to 4 bullets, most time-sensitive first.",
        "Use `recentlyDone` for a warm callback ('nice week — three hangouts this month') when it's there,",
        "not just what's pending. `upcoming` items already have a relative time label — reuse it verbatim,",
        "never invent your own date math.",
        "next_best is one concrete suggestion for the group's next plan, phrased as an invitation.",
      ].join(" "),
      prompt: JSON.stringify(facts).slice(0, 6000),
    });
    const bullets = output.bullets.filter((b) => b.trim()).slice(0, 4);
    if (output.headline.trim() && bullets.length) {
      return {
        headline: output.headline.trim().slice(0, 80),
        bullets: bullets.map((b) => b.slice(0, 160)),
        nextBest: output.next_best?.trim().slice(0, 180) || null,
        aiGenerated: true,
      };
    }
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      const parsed = extractJson(error.text) as
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
    }
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

type VibeSpotInput = {
  key: string;
  title: string;
  subtitle: string;
  cuisine: string | null;
  priceLevel: string;
  costMin: number;
  costMax: number;
  miles: number;
  /** Full street address — was previously stripped before ranking. */
  address: string | null;
  /** Raw OSM-style opening-hours string, when Geoapify has one. */
  openHours: string | null;
};

const VibeRankSchema = z.object({
  ranks: z.array(z.object({ key: z.string(), reason: z.string() })),
});

export async function rankByVibe(
  query: string,
  spots: VibeSpotInput[],
): Promise<{ ranks: VibeRank[]; aiGenerated: boolean }> {
  if (!spots.length) return { ranks: [], aiGenerated: false };
  try {
    const { output } = await generateText({
      model: lovableAiModel(),
      output: Output.object({ schema: VibeRankSchema }),
      system: [
        "You match local venues to a natural-language vibe request for a group hangout.",
        "Pick the best 5 or fewer venues from the given list, best first.",
        "Only use keys from the list. Never invent a venue.",
        "You're given each venue's address and (when known) raw opening hours — use them:",
        "reason about walkability from the address and whether it's plausibly open at a typical hangout time,",
        "not just price and distance.",
        "Each reason is one sentence under 90 characters, concrete. No emoji.",
      ].join(" "),
      prompt: `VIBE REQUEST: ${query}\n\nVENUES:\n${JSON.stringify(spots).slice(0, 8000)}`,
    });
    const valid = new Set(spots.map((s) => s.key));
    const ranks = output.ranks
      .filter((r) => valid.has(r.key))
      .map((r) => ({ key: r.key, reason: r.reason.slice(0, 140) || "Good fit for the group." }))
      .slice(0, 5);
    if (ranks.length) return { ranks, aiGenerated: true };
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      const parsed = extractJson(error.text);
      const valid = new Set(spots.map((s) => s.key));
      const list = Array.isArray(parsed)
        ? parsed
        : Array.isArray((parsed as { ranks?: unknown })?.ranks)
          ? (parsed as { ranks: unknown[] }).ranks
          : [];
      const ranks = (list as { key?: unknown; reason?: unknown }[])
        .filter((r) => typeof r.key === "string" && valid.has(r.key))
        .map((r) => ({
          key: r.key as string,
          reason: typeof r.reason === "string" ? r.reason.slice(0, 140) : "Good fit for the group.",
        }))
        .slice(0, 5);
      if (ranks.length) return { ranks, aiGenerated: true };
    }
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

const GuardianSummarySchema = z.object({
  summary: z.string(),
  watchouts: z.array(z.string()),
});

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
  /** `relatedPlan` is pre-correlated by timestamp against `plans` above, not left for the model to guess. */
  delays: { reason: string; minutes: number; relatedPlan: string | null }[];
  checkins: { status: string; place: string | null; relatedPlan: string | null }[];
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
    const { output } = await generateText({
      model: lovableAiModel(),
      output: Output.object({ schema: GuardianSummarySchema }),
      system: [
        "You write a calm, plain-language evening summary for a parent about their teen's plans.",
        "Be reassuring and factual — only use the given facts, never speculate about safety or invent details.",
        "Each delay/checkin already tells you which plan it belongs to via relatedPlan (or null if unrelated) —",
        "use that link directly, don't guess at a connection yourself.",
        "No emoji, no alarmist language.",
        "summary is 2 short sentences under 240 characters. watchouts is 0 to 3 short action items for the parent.",
      ].join(" "),
      prompt: JSON.stringify(facts).slice(0, 6000),
    });
    if (output.summary.trim()) {
      return {
        summary: output.summary.trim().slice(0, 400),
        watchouts: output.watchouts.filter((w) => w.trim()).slice(0, 3),
        aiGenerated: true,
      };
    }
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      const parsed = extractJson(error.text) as { summary?: string; watchouts?: unknown } | null;
      if (parsed?.summary) {
        return {
          summary: parsed.summary.slice(0, 400),
          watchouts: Array.isArray(parsed.watchouts)
            ? parsed.watchouts.filter((w): w is string => typeof w === "string").slice(0, 3)
            : [],
          aiGenerated: true,
        };
      }
    }
    /* fall through */
  }
  return fallback;
}

/* ------------------------------------------------------------------ */
/* 5. Ask Syncly — site-wide assistant                                 */
/* ------------------------------------------------------------------ */

/** A plan the answer referenced, so the UI can offer a direct "View plan" link. */
export type SynclyPlanRef = { planId: string; title: string };

const SYNCLY_SYSTEM = [
  "You are Ask Syncly: a warm, concise assistant with a bird's-eye view of one member's",
  "groups and plans across the whole app — not just a single plan.",
  "Only use the facts you are given. Never invent a group, plan, date, cost or person.",
  "Never name what an individual member privately answered; talk in group terms only.",
  "You can summarize the week, point out what needs the member's attention, or suggest",
  "what their squad should do next. Answer in at most 130 words, no emoji.",
  "If you reference one specific plan by name, also return its exact id from the facts",
  "in `plan_ref` so the app can link to it; use `plan_ref: null` otherwise.",
].join(" ");

const SynclyReplySchema = z.object({
  answer: z.string(),
  plan_ref: z.object({ plan_id: z.string(), title: z.string() }).nullable(),
});

const SYNCLY_FALLBACK =
  "I can't reach the AI service right now — your groups and plans are all still on the Home and Groups tabs.";

export async function synclyReply(
  facts: unknown,
  history: ConciergeTurn[],
  question: string,
): Promise<{ answer: string; planRef?: SynclyPlanRef }> {
  const transcript = history
    .slice(-8)
    .map((t) => `${t.role === "user" ? "Member" : "Syncly"}: ${t.content}`)
    .join("\n");
  const prompt = [
    "CROSS-GROUP FACTS (JSON):",
    JSON.stringify(facts).slice(0, 8000),
    transcript ? `\nCONVERSATION SO FAR:\n${transcript}` : "",
    `\nNEW QUESTION:\n${question}`,
  ].join("\n");

  try {
    const { output } = await generateText({
      model: lovableAiModel(),
      output: Output.object({ schema: SynclyReplySchema }),
      system: SYNCLY_SYSTEM,
      prompt,
    });
    const answer = output.answer.trim();
    if (!answer) return { answer: SYNCLY_FALLBACK };
    const ref = output.plan_ref;
    return ref?.plan_id ? { answer, planRef: { planId: ref.plan_id, title: ref.title } } : { answer };
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      const parsed = extractJson(error.text) as
        | { answer?: string; plan_ref?: { plan_id?: string; title?: string } | null }
        | null;
      if (parsed?.answer?.trim()) {
        const ref = parsed.plan_ref;
        return ref?.plan_id
          ? { answer: parsed.answer.trim(), planRef: { planId: ref.plan_id, title: ref.title ?? "" } }
          : { answer: parsed.answer.trim() };
      }
    }
    return { answer: SYNCLY_FALLBACK };
  }
}
