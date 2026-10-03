import {
  buildTransportPlan,
  rankOptions,
  scoreOption,
  type MemberInput,
  type ScoredOption,
} from "@/lib/quorum/engine";
import { estimateCost } from "@/lib/quorum/cost";
import type { DemoMember } from "@/lib/quorum/demo-group";
import type { OptionSeed } from "@/lib/quorum/types";

/*
 * The /demo "AI" is simulated on purpose. The real assistants (aiplus.*, ai.*)
 * sit behind sign-in and a per-user call cap, so an anonymous page can't use
 * them. Everything here is computed from the same deterministic engine the
 * product uses, over the visitor's own squad, and the UI labels it as a
 * sample. Like the real thing it only ever speaks in aggregates: it can say
 * that a limit ruled something out, never whose limit it was.
 */

export const inputsOf = (members: DemoMember[]): MemberInput[] =>
  members.map((m) => ({
    profileId: m.id,
    constraints: m.constraints,
    sacrificeLoad: m.sacrificeLoad,
  }));

export type Blocker = "budget" | "curfew" | "travel" | "food" | "rides";

export const BLOCKER_LABEL: Record<Blocker, string> = {
  budget: "Budget",
  curfew: "Home by",
  travel: "Distance",
  food: "Food needs",
  rides: "Rides",
};

/** Which kinds of limit ruled an option out. Never which person. */
export function blockersOf(s: ScoredOption): Blocker[] {
  const b = s.breakdown;
  const out: Blocker[] = [];
  if (b.budgetFit < 100) out.push("budget");
  if (b.scheduleFit < 100) out.push("curfew");
  if (b.travelFit < 100) out.push("travel");
  if (b.dietaryFit < 100) out.push("food");
  if (b.transportFit < 100) out.push("rides");
  return out;
}

export const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
};
export const toHHMM = (n: number) =>
  `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

/* ---------------------------- AI compromise ---------------------------- */

export type Compromise = {
  option: OptionSeed;
  shifted: OptionSeed;
  shiftMinutes: number;
};

/**
 * When nothing works, the only lever that changes the plan rather than
 * someone's answers is timing: try each option a little earlier and keep the
 * smallest move that makes it work for everyone. Returns null when no timing
 * change helps, which is the honest answer when a budget or distance limit is
 * what rules everything out.
 */
export function findCompromise(pool: OptionSeed[], members: DemoMember[]): Compromise | null {
  const inputs = inputsOf(members);
  let best: { c: Compromise; score: number } | null = null;
  for (const option of pool) {
    // Only options that fail as written are worth moving; a shift on one that
    // already works is noise, not a compromise.
    if (scoreOption(option, inputs).feasible) continue;
    for (const shift of [30, 60, 90, 120]) {
      const start = toMin(option.start) - shift;
      if (start < 12 * 60) break;
      const shifted = { ...option, start: toHHMM(start), end: toHHMM(toMin(option.end) - shift) };
      const scored = scoreOption(shifted, inputs);
      if (!scored.feasible) continue;
      const score = scored.score - shift * 0.15;
      if (!best || score > best.score)
        best = { c: { option, shifted, shiftMinutes: shift }, score };
      break;
    }
  }
  return best?.c ?? null;
}

/* ------------------------------ Ask Syncly ------------------------------ */

export type Answer = {
  text: string;
  pick?: ScoredOption;
  followUps: string[];
};

const money = (a: number, b: number) => (a === b ? `$${a}` : `$${a}–${b}`);

function clock(t: string) {
  const [h, m] = t.split(":").map(Number);
  const h12 = h % 12 || 12;
  return `${h12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "am" : "pm"}`;
}

export const ASK_STARTERS = [
  "What should we do tonight?",
  "Who's driving?",
  "What's the cheapest thing that works?",
  "What if we leave earlier?",
];

export function answerQuestion(
  question: string,
  members: DemoMember[],
  pool: OptionSeed[],
): Answer {
  const q = question.toLowerCase();
  const ranked = rankOptions(pool, inputsOf(members));
  const works = ranked.filter((r) => r.feasible);
  const top = works[0];
  const names = members.map((m) => m.name);

  if (!top) {
    return {
      text: "Right now nothing works for all of you. At least one limit rules out every option, and I won't say whose. If you want, I can look for a timing change that gets you back to a plan, or you can loosen a budget, a distance or a curfew and I'll re-check.",
      followUps: ["What if we leave earlier?", "What's blocking us?"],
    };
  }

  const cost = estimateCost({
    costMin: top.option.costMin,
    costMax: top.option.costMax,
    travelMinutes: top.option.travelMinutes,
    category: "hangout",
    headcount: members.length,
    requiresDriving: top.option.requiresDriving,
  });

  if (/(drive|driving|ride|car|seat|get there|pick)/.test(q)) {
    if (!top.option.requiresDriving) {
      return {
        text: `${top.option.title} is close enough that nobody needs a ride, so there's no car plan to sort out.`,
        pick: top,
        followUps: ["What's the cheapest thing that works?"],
      };
    }
    const plan = buildTransportPlan(
      top.option,
      members.map((m) => ({ profileId: m.id, name: m.name, constraints: m.constraints })),
    );
    const cars = plan.cars
      .map(
        (c) => `${c.driver} drives${c.passengers.length ? ` ${c.passengers.join(" and ")}` : ""}`,
      )
      .join(". ");
    return {
      text: `For ${top.option.title}: ${cars}.${plan.unseated.length ? ` ${plan.unseated.join(" and ")} still need a seat.` : " Everyone who needs a ride has one, both ways."}`,
      pick: top,
      followUps: ["What should we do tonight?", "What if we leave earlier?"],
    };
  }

  if (/(cheap|cost|budget|money|afford|spend|price|\$)/.test(q)) {
    const cheapest = [...works].sort((a, b) => a.option.costMin - b.option.costMin)[0]!;
    return {
      text:
        cheapest.option.key === top.option.key
          ? `Good news: the top pick is also the cheapest that works for everyone. ${top.option.title} comes to about ${money(cost.perPersonMin, cost.perPersonMax)} each.`
          : `${cheapest.option.title} is the cheapest that works for all ${names.length} of you, at ${money(cheapest.option.costMin, cheapest.option.costMax)} before extras. The top pick, ${top.option.title}, runs about ${money(cost.perPersonMin, cost.perPersonMax)} each.`,
      pick: cheapest,
      followUps: ["Who's driving?", "What should we do tonight?"],
    };
  }

  if (/(early|earlier|late|later|curfew|home by|when|time|end)/.test(q)) {
    const lastCall = Math.min(
      ...members.map((m) => (m.constraints.latestEnd ? toMin(m.constraints.latestEnd) : 24 * 60)),
    );
    const hasCurfew = lastCall < 24 * 60;
    const compromise = findCompromise(pool, members);
    const text = hasCurfew
      ? `${top.option.title} runs ${clock(top.option.start)}–${clock(top.option.end)}. The earliest anyone has to be home is ${clock(toHHMM(lastCall))}, so that's the line I'm planning around.`
      : `${top.option.title} runs ${clock(top.option.start)}–${clock(top.option.end)}, and nobody has a hard stop that cuts it short.`;
    return {
      text:
        text +
        (compromise && compromise.option.key !== top.option.key
          ? ` Starting ${compromise.shiftMinutes} min earlier would also open up ${compromise.option.title}.`
          : ""),
      pick: top,
      followUps: ["What's the cheapest thing that works?", "Who's driving?"],
    };
  }

  if (/(food|eat|diet|vegetarian|vegan|gluten|halal|allerg|hungry)/.test(q)) {
    const needs = new Set(members.flatMap((m) => m.constraints.dietary ?? []));
    return {
      text: needs.size
        ? `Food needs in the group are covered by ${top.option.title}: ${[...needs].join(", ")} all work there. I don't say who needs what.`
        : `Nobody has food needs on file, so food didn't narrow anything down. ${top.option.title} is a safe bet either way.`,
      pick: top,
      followUps: ["Who's driving?", "What's the cheapest thing that works?"],
    };
  }

  if (/(other|else|backup|plan b|alternative|second)/.test(q)) {
    const next = works[1];
    return {
      text: next
        ? `Backup: ${next.option.title}, ${money(next.option.costMin, next.option.costMax)} and about ${next.option.travelMinutes} min away. It also works for everyone, it just fits what people like a little less.`
        : `${top.option.title} is the only option that works for all of you right now, so there's no backup yet.`,
      pick: next ?? top,
      followUps: ["What should we do tonight?"],
    };
  }

  if (/(block|why not|rule|wrong|nothing)/.test(q)) {
    const out = ranked.filter((r) => !r.feasible);
    const kinds = [...new Set(out.flatMap(blockersOf))].map((k) => BLOCKER_LABEL[k].toLowerCase());
    return {
      text: out.length
        ? `${out.length} option${out.length === 1 ? "" : "s"} didn't make it. They were ruled out by ${kinds.join(", ") || "a group limit"}. I can tell you the kind of limit, never the person behind it.`
        : "Nothing is blocked right now: every option on the list works for all of you.",
      followUps: ["What should we do tonight?"],
    };
  }

  const fair = top.breakdown.fairness;
  return {
    text: `I'd go with ${top.option.title}. It works for all ${names.length} of you at about ${money(cost.perPersonMin, cost.perPersonMax)} each, ${clock(top.option.start)}–${clock(top.option.end)}, and it scores ${fair}% on fairness, meaning it isn't the same person giving ground again.${works.length > 1 ? ` ${works.length - 1} more also work if you want a backup.` : ""}`,
    pick: top,
    followUps: [
      "Who's driving?",
      "What's the cheapest thing that works?",
      "What are the other options?",
    ],
  };
}

/* ---------------------------- Describe a night ---------------------------- */

export const MAGIC_EXAMPLES = [
  "Something cozy and indoors, nothing over $20",
  "Active and outside, we want to burn energy",
  "Games and food, home early",
];

export type MagicDraft = {
  understood: string[];
  pick: ScoredOption;
  /** True when the pick works for the whole squad, not just the brief. */
  worksForAll: boolean;
};

const VIBES: { re: RegExp; tag: string; label: string }[] = [
  { re: /(cozy|chill|calm|relax|quiet|low.?key)/, tag: "cozy", label: "Cozy" },
  { re: /(indoor|inside|rain|air.?con)/, tag: "indoor", label: "Indoors" },
  { re: /(outdoor|outside|park|fresh air)/, tag: "outdoor", label: "Outside" },
  { re: /(active|sport|energy|run|move|burn)/, tag: "active", label: "Active" },
  { re: /(game|arcade|compet|bowl|play)/, tag: "games", label: "Games" },
  { re: /(group|everyone|all together|big)/, tag: "group", label: "Whole group" },
  { re: /(late|night owl|stay out)/, tag: "late-night", label: "Late night" },
];

export function draftFromPrompt(
  prompt: string,
  members: DemoMember[],
  pool: OptionSeed[],
): MagicDraft | null {
  const q = prompt.toLowerCase();
  const wanted = VIBES.filter((v) => v.re.test(q));
  const dollars = q.match(/\$\s?(\d{1,3})/);
  const cap = dollars ? Number(dollars[1]) : /(cheap|broke|free|budget)/.test(q) ? 15 : null;
  const early = /(early|home by|not late|short)/.test(q);

  const understood = [
    ...wanted.map((v) => v.label),
    ...(cap ? [`Under $${cap}`] : []),
    ...(early ? ["Home early"] : []),
  ];
  if (!understood.length) return null;

  const ranked = rankOptions(pool, inputsOf(members));
  const scored = ranked.map((r) => {
    const tagHits = wanted.filter((v) => r.option.tags.includes(v.tag)).length;
    const cheap = cap ? (r.option.costMin <= cap ? 1 : -1) : 0;
    const shortNight = early ? (toMin(r.option.end) <= 21 * 60 ? 1 : -0.5) : 0;
    return {
      r,
      fit: (r.feasible ? 40 : 0) + r.score * 0.4 + tagHits * 12 + cheap * 14 + shortNight * 8,
    };
  });
  scored.sort((a, b) => b.fit - a.fit);
  const best = scored[0]!.r;
  return { understood, pick: best, worksForAll: best.feasible };
}
