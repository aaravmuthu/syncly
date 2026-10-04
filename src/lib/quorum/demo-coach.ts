import { rankOptions, type MemberInput } from "./engine";
import type { ConstraintPayload, OptionSeed } from "./types";
import type { DemoMember } from "./demo-group";

/*
 * The demo's what-if coach. Everything it says is computed here by the same
 * engine that ranks the plans: it tries one small stretch from one person at a
 * time and reports the smallest one that changes the answer. The AI only
 * rephrases these facts (see demo-coach.server.ts), so a suggestion can never
 * be invented, and the wording stays anonymous -- it says "one person", never
 * whose limit it is, which is the same rule the real plan screen follows.
 */

export type MoveKind = "curfew" | "spend" | "travel";
/** Whose answer a move changes, as the visitor should hear it. */
export type Who = "you" | "friend" | "someone";
export type Situation = "stuck" | "stretch" | "solid";

export type CoachMove = {
  id: string;
  kind: MoveKind;
  /** Whose answer the "Try it" button edits. Never named in the copy. */
  memberId: string;
  who: Who;
  patch: Partial<ConstraintPayload>;
  /** Minutes for curfew and travel, dollars for spend. */
  amount: number;
  targetTitle: string;
  /** How many points the new top pick scores above today's (stretch only). */
  gain: number;
};

export type Coach = {
  situation: Situation;
  topTitle: string | null;
  moves: CoachMove[];
};

/** What the model is allowed to see: enums, small numbers, and option titles. */
export type CoachFacts = {
  situation: Situation;
  topTitle: string | null;
  headcount: number;
  move: { kind: MoveKind; amount: number; targetTitle: string; who: Who } | null;
  /** The visitor's own limits, when they have picked who they are. */
  you: { budget: number | null; curfew: string | null } | null;
};

const STEPS: Record<MoveKind, number[]> = {
  curfew: [30, 60, 90],
  spend: [5, 10, 15],
  travel: [10, 20],
};
const MIN_STRETCH_GAIN = 3;
const MAX_MOVES = 2;

const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};
const fromMinutes = (n: number) => {
  const c = Math.min(n, 23 * 60 + 59);
  return `${String(Math.floor(c / 60)).padStart(2, "0")}:${String(c % 60).padStart(2, "0")}`;
};

function patchFor(
  kind: MoveKind,
  c: ConstraintPayload,
  amount: number,
): Partial<ConstraintPayload> | null {
  if (kind === "curfew") {
    if (!c.latestEnd) return null;
    const next = fromMinutes(toMinutes(c.latestEnd) + amount);
    return next === c.latestEnd ? null : { latestEnd: next };
  }
  if (kind === "spend") return c.maxSpend != null ? { maxSpend: c.maxSpend + amount } : null;
  return c.maxTravelMinutes != null ? { maxTravelMinutes: c.maxTravelMinutes + amount } : null;
}

const toInputs = (members: DemoMember[]): MemberInput[] =>
  members.map((m) => ({
    profileId: m.id,
    constraints: m.constraints,
    sacrificeLoad: m.sacrificeLoad,
  }));

export function analyze(members: DemoMember[], pool: OptionSeed[], youId: string | null): Coach {
  const base = rankOptions(pool, toInputs(members));
  const top = base[0];
  if (!top) return { situation: "stuck", topTitle: null, moves: [] };
  const stuck = !top.feasible;

  const found: { move: CoachMove; step: number }[] = [];
  for (const member of members) {
    for (const kind of Object.keys(STEPS) as MoveKind[]) {
      // The smallest stretch of this kind from this person that does the job.
      for (const [step, amount] of STEPS[kind].entries()) {
        const patch = patchFor(kind, member.constraints, amount);
        if (!patch) break;
        const changed = members.map((m) =>
          m.id === member.id ? { ...m, constraints: { ...m.constraints, ...patch } } : m,
        );
        const next = rankOptions(pool, toInputs(changed))[0];
        if (!next?.feasible) continue;
        const gain = next.score - top.score;
        const works = stuck || (next.option.key !== top.option.key && gain >= MIN_STRETCH_GAIN);
        if (!works) continue;
        found.push({
          step,
          move: {
            id: `${member.id}-${kind}-${amount}`,
            kind,
            memberId: member.id,
            who: !youId ? "someone" : member.id === youId ? "you" : "friend",
            patch,
            amount,
            targetTitle: next.option.title,
            gain,
          },
        });
        break;
      }
    }
  }

  // Smallest ask first, the visitor's own before a friend's, then the best
  // resulting plan; one move per kind so the two suggestions are genuinely
  // different ideas.
  const mine = (w: Who) => (w === "you" ? 0 : 1);
  found.sort(
    (a, b) => a.step - b.step || mine(a.move.who) - mine(b.move.who) || b.move.gain - a.move.gain,
  );
  const moves: CoachMove[] = [];
  for (const { move } of found) {
    if (moves.length >= MAX_MOVES) break;
    if (moves.some((m) => m.kind === move.kind)) continue;
    moves.push(move);
  }

  return {
    situation: stuck ? "stuck" : moves.length ? "stretch" : "solid",
    topTitle: stuck ? null : top.option.title,
    moves,
  };
}

const span = (m: number) => (m === 60 ? "an hour" : m === 90 ? "90 minutes" : `${m} minutes`);

/** Short label for the "Try it" chip. */
export function moveLabel(m: Pick<CoachMove, "kind" | "amount" | "who">): string {
  if (m.who === "you") {
    if (m.kind === "curfew") return `Stay out ${span(m.amount)} later`;
    if (m.kind === "spend") return `Spend up to $${m.amount} more`;
    return `Travel ${m.amount} minutes further`;
  }
  const ask = m.who === "friend" ? "Ask a friend to " : "";
  const text =
    m.kind === "curfew"
      ? `stretch a curfew by ${span(m.amount)}`
      : m.kind === "spend"
        ? `allow $${m.amount} more`
        : `allow ${m.amount} more minutes of travel`;
  return ask ? ask + text : text[0]!.toUpperCase() + text.slice(1);
}

const movePhrase = (m: NonNullable<CoachFacts["move"]>) => {
  if (m.who === "you") {
    return m.kind === "curfew"
      ? `you stayed out ${span(m.amount)} later`
      : m.kind === "spend"
        ? `you could spend $${m.amount} more`
        : `you could travel ${m.amount} minutes further`;
  }
  const who = m.who === "friend" ? "one of your friends" : "one person";
  return m.kind === "curfew"
    ? `${who} stretched their curfew by ${span(m.amount)}`
    : m.kind === "spend"
      ? `${who} could spend $${m.amount} more`
      : `${who} could travel ${m.amount} minutes further`;
};

/** "21:30" -> "9:30 pm". */
const clock12 = (t: string) => {
  const [h, m] = t.split(":").map(Number) as [number, number];
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "am" : "pm"}`;
};

/** "your $20 budget and 9:30 pm curfew", or null when nothing is set. */
export function yourLimits(you: CoachFacts["you"]): string | null {
  if (!you) return null;
  const parts = [
    you.budget != null ? `$${you.budget} budget` : null,
    you.curfew ? `${clock12(you.curfew)} curfew` : null,
  ].filter(Boolean);
  return parts.length ? `your ${parts.join(" and ")}` : null;
}

export function factsFor(coach: Coach, members: DemoMember[], youId: string | null): CoachFacts {
  const first = coach.moves[0];
  const me = youId ? members.find((m) => m.id === youId) : undefined;
  return {
    situation: coach.situation,
    topTitle: coach.topTitle,
    headcount: members.length,
    move: first
      ? { kind: first.kind, amount: first.amount, targetTitle: first.targetTitle, who: first.who }
      : null,
    you: me
      ? { budget: me.constraints.maxSpend ?? null, curfew: me.constraints.latestEnd ?? null }
      : null,
  };
}

/**
 * The deterministic line: instant, always correct, and the AI's fallback.
 * `name` is the visitor's typed name; it lives only in the browser, so it can
 * greet here but is never part of what the AI is sent.
 */
export function templateLine(f: CoachFacts, edited: boolean, name?: string): string {
  const fit = yourLimits(f.you);
  if (f.situation === "stuck") {
    return f.move
      ? `Nothing fits all ${f.headcount} of you right now. If ${movePhrase(f.move)}, ${f.move.targetTitle} would work for everyone.`
      : "Nothing fits everyone, and it would take more than one small change. Loosening a couple of limits would help.";
  }
  if (f.situation === "stretch" && f.move) {
    return `${f.topTitle} already works for everyone${fit ? `, and fits ${fit}` : ""}. If ${movePhrase(f.move)}, ${f.move.targetTitle} would fit the group even better.`;
  }
  if (!edited) {
    return f.you
      ? `Hi${name ? ` ${name}` : ""}. ${f.topTitle} works for all ${f.headcount} of you${fit ? ` and fits ${fit}` : ""}. Change anyone's answers and I'll tell you what would help.`
      : "Change anyone's answers and I'll tell you what would help the group.";
  }
  return `${f.topTitle} still works for all ${f.headcount} of you${fit ? `, and fits ${fit}` : ""}. Try making someone stricter and watch the plan adapt.`;
}
