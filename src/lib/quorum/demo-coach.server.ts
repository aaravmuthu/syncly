// Server-only. Puts the demo coach's facts into a friendly sentence. This is
// the one AI call reachable without an account, so it is boxed in: the input
// is enums and option titles only (no free text), answers are cached, calls
// are rate limited per visitor and overall, and any hiccup or odd answer
// falls back to the client's own template line.
import { generateText } from "ai";
import { aiModel, recordAiFailure } from "@/lib/ai-gateway.server";
import { DEMO_GROUP } from "./demo-group";
import type { CoachFacts } from "./demo-coach";

const CACHE_TTL_MS = 60 * 60_000;
const CACHE_MAX = 400;
const WINDOW_MS = 10 * 60_000;
const PER_VISITOR_LIMIT = 12;
const GLOBAL_LIMIT = 60;
const MAX_LINE_CHARS = 240;
const CALL_TIMEOUT_MS = 6000;

const cache = new Map<string, { line: string; at: number }>();
const perVisitor = new Map<string, number[]>();
let global: number[] = [];

const recent = (stamps: number[], now: number) => stamps.filter((t) => now - t < WINDOW_MS);

function allowCall(visitor: string): boolean {
  const now = Date.now();
  global = recent(global, now);
  const mine = recent(perVisitor.get(visitor) ?? [], now);
  if (global.length >= GLOBAL_LIMIT || mine.length >= PER_VISITOR_LIMIT) return false;
  global.push(now);
  perVisitor.set(visitor, [...mine, now]);
  if (perVisitor.size > 2000) {
    for (const [k, v] of perVisitor) if (!recent(v, now).length) perVisitor.delete(k);
  }
  return true;
}

const NAMES = DEMO_GROUP.map((m) => m.name.toLowerCase());

/** Accept only a short, plain sentence that names nobody. */
function clean(text: string): string | null {
  const line = text
    .replace(/[\r\n]+/g, " ")
    .replace(/^["'“”\s]+|["'“”\s]+$/g, "")
    .trim();
  if (!line || line.length > MAX_LINE_CHARS) return null;
  if (/https?:|www\.|[<>{}[\]`]/i.test(line)) return null;
  const lower = line.toLowerCase();
  if (NAMES.some((n) => new RegExp(`\\b${n}\\b`).test(lower))) return null;
  return line;
}

function promptFor(f: CoachFacts): string {
  const m = f.move;
  const subject = !m
    ? null
    : m.who === "you"
      ? "you"
      : m.who === "friend"
        ? "one of your friends"
        : "one person";
  const move = !m
    ? null
    : m.kind === "curfew"
      ? `${subject} ${m.who === "you" ? "stayed out" : "stretched their curfew by"} ${m.who === "you" ? `${m.amount} minutes later` : `${m.amount} minutes`}`
      : m.kind === "spend"
        ? `${subject} could spend $${m.amount} more`
        : `${subject} could travel ${m.amount} minutes further`;
  const limits = [
    f.you?.budget != null ? `a $${f.you.budget} spending limit` : null,
    f.you?.curfew ? `a ${f.you.curfew} (24-hour) curfew` : null,
  ].filter(Boolean);
  const fit = limits.length
    ? ` The plan stays within the visitor's own limits: ${limits.join(" and ")}.`
    : "";
  const situation =
    f.situation === "stuck"
      ? `No plan works for all ${f.headcount} of you (the visitor and their friends) right now.` +
        (move
          ? ` If ${move}, "${m!.targetTitle}" would work for everyone.`
          : " It would take more than one small change to fix.")
      : f.situation === "stretch"
        ? `"${f.topTitle}" already works for all ${f.headcount} of you (the visitor and their friends).${fit} If ${move}, "${m!.targetTitle}" would fit the group even better.`
        : `"${f.topTitle}" works for all ${f.headcount} of you (the visitor and their friends) and nothing small would improve it.${fit}`;
  return [
    "You are the friendly companion on Syncly's interactive demo, a tool that finds plans that work for a group of friends without revealing anyone's private limits.",
    'Say the following in ONE warm, plain sentence of at most 30 words. Speak directly to the visitor as "you" and call the others "your friends"; say "all N of you" when counting the whole group. Keep every fact exactly as given; do not add facts, invent names, or say whose limit it is beyond what is stated. Write times in 12-hour style (9:30 pm). No emoji, no quotation marks, no markdown.',
    `Facts: ${situation}`,
  ].join("\n");
}

export async function coachLine(facts: CoachFacts, visitor: string): Promise<string | null> {
  const key = JSON.stringify(facts);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.line;
  if (!allowCall(visitor)) return null;

  try {
    const { text } = await generateText({
      model: aiModel("demo_coach"),
      prompt: promptFor(facts),
      abortSignal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    });
    const line = clean(text);
    if (!line) return null;
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
    cache.set(key, { line, at: Date.now() });
    return line;
  } catch (error) {
    void recordAiFailure("demo_coach", error);
    return null;
  }
}

/** Best-effort visitor id for rate limiting; never stored beyond memory. */
export async function visitorId(): Promise<string> {
  try {
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const raw =
      getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for") ?? "unknown";
    return raw.split(",")[0]!.trim().slice(0, 64);
  } catch {
    return "unknown";
  }
}
