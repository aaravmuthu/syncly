import type { ConstraintPayload, OptionSeed, ScoreBreakdown } from "./types";

/**
 * Compatibility engine.
 *
 * Ordering of concerns (in priority order, deliberately):
 *   1. HARD CONSTRAINTS  — an option that violates one is not feasible, period.
 *   2. UNIVERSAL FEASIBILITY — works for everyone beats works for most.
 *   3. FAIRNESS — nobody should be the one who compromises every time.
 *   4. GROUP COMPATIBILITY — aggregate soft preference satisfaction.
 *   5. INDIVIDUAL PREFERENCE STRENGTH — tie-breaking.
 *
 * The engine is deterministic and pure. An AI or live-data recommender can
 * produce candidate `OptionSeed`s; scoring and privacy stay here.
 */

export type MemberInput = {
  profileId: string;
  constraints: ConstraintPayload;
  /** How often this member has been the one compromising, 0..1. */
  sacrificeLoad?: number;
  travelMinutes?: number;
  returnTravelMinutes?: number;
};

export type ScoredOption = {
  option: OptionSeed;
  score: number;
  feasible: boolean;
  breakdown: ScoreBreakdown;
};

const toMinutes = (t?: string | null) => {
  if (!t) return null;
  const [h, m] = t.split(":");
  const hh = Number(h);
  const mm = Number(m ?? 0);
  if (Number.isNaN(hh)) return null;
  return hh * 60 + (Number.isNaN(mm) ? 0 : mm);
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

type MemberEval = {
  feasible: boolean;
  hardKinds: string[];
  soft: number; // 0..1 preference satisfaction
};

function evaluateMember(option: OptionSeed, m: MemberInput): MemberEval {
  const c = m.constraints ?? {};
  const travelMinutes = m.travelMinutes ?? option.travelMinutes;
  const returnMinutes = m.returnTravelMinutes ?? Math.round(travelMinutes / 2);
  const hard: string[] = [];
  let softPoints = 0;
  let softMax = 0;

  // ---- HARD: budget -------------------------------------------------------
  const budgetCap = c.maxSpend ?? c.totalBudget ?? null;
  if (budgetCap != null) {
    // Uses the low end: an option is affordable if the cheapest realistic
    // version of it fits. Above the cap by any amount is a hard failure.
    if ((option.costForBudget ?? option.costMin) > budgetCap) hard.push("budget");
  }
  if (c.maxTicketPrice != null && option.style === "venue" && option.costMin > c.maxTicketPrice) {
    hard.push("budget");
  }

  // ---- HARD: dietary safety ----------------------------------------------
  const needs = [...(c.dietary ?? []), ...(c.allergies ?? [])].map((d) => d.toLowerCase().trim());
  if (needs.length && option.style !== "venue" && option.style !== "outdoor") {
    const unmet = needs.filter((n) => !option.dietaryFriendly.includes(n));
    if (unmet.length) hard.push("dietary");
  }

  // ---- HARD: travel distance ---------------------------------------------
  if (c.maxTravelMinutes != null && travelMinutes > c.maxTravelMinutes) {
    // Small overshoot on a soft-ish preference is treated as hard only when
    // it is a stated maximum, which it is here.
    hard.push("travel");
  }

  // ---- HARD: distance radius (miles, from live location data) -------------
  if (
    c.maxDistanceMiles != null &&
    option.distanceMiles != null &&
    option.distanceMiles > c.maxDistanceMiles
  ) {
    hard.push("travel");
  }

  // ---- HARD: schedule ------------------------------------------------------
  const optStart = toMinutes(option.start)!;
  const rawEnd = toMinutes(option.end)!;
  const optEnd =
    option.durationMinutes != null
      ? optStart + option.durationMinutes
      : rawEnd < optStart
        ? rawEnd + 1440
        : rawEnd;
  const deadline = (value: number | null) =>
    value != null && value < 360 && optStart >= 720 ? value + 1440 : value;
  const earliest = toMinutes(c.earliestStart);
  const latest = deadline(toMinutes(c.latestEnd));
  const returnBy = deadline(toMinutes(c.requiredReturnTime));
  if (earliest != null && optStart < earliest) hard.push("schedule");
  if (latest != null && optEnd > latest) hard.push("schedule");
  if (returnBy != null && optEnd + returnMinutes > returnBy) {
    hard.push("curfew");
  }

  // ---- HARD: transportation ----------------------------------------------
  if (c.needsRide && option.requiresDriving && !c.canDrive) {
    // Feasibility of the ride itself is resolved group-wide below; per member
    // this only becomes hard when the group has no capacity (checked later).
    softMax += 1;
  }

  // ---- HARD: parent conditions -------------------------------------------
  for (const cond of c.parentConditions ?? []) {
    const home = deadline(parseHomeBy(cond));
    if (home != null && optEnd + returnMinutes > home) {
      hard.push("condition");
    }
  }

  // ---- SOFT: liked / disliked tags ---------------------------------------
  const liked = (c.likedTags ?? []).map((t) => t.toLowerCase());
  const disliked = (c.dislikedTags ?? []).map((t) => t.toLowerCase());
  const tags = option.tags.map((t) => t.toLowerCase());
  if (liked.length) {
    softMax += 2;
    const hits = liked.filter((t) => tags.includes(t) || option.title.toLowerCase().includes(t));
    softPoints += 2 * clamp01(hits.length / Math.min(2, liked.length));
  }
  if (disliked.length) {
    softMax += 1.5;
    const hits = disliked.filter((t) => tags.includes(t));
    softPoints += hits.length ? 0 : 1.5;
  }

  // ---- SOFT: venue style ---------------------------------------------------
  if (c.venueStyle?.length) {
    softMax += 1.5;
    softPoints += c.venueStyle.map((s) => s.toLowerCase()).includes(option.style) ? 1.5 : 0.3;
  }

  // ---- SOFT: comfortable budget headroom ----------------------------------
  if (budgetCap != null) {
    softMax += 2;
    const mid = (option.costMin + option.costMax) / 2;
    softPoints += 2 * clamp01((budgetCap - mid) / Math.max(budgetCap, 1) + 0.35);
  }

  // ---- SOFT: travel comfort -------------------------------------------------
  if (c.maxTravelMinutes != null) {
    softMax += 1.5;
    softPoints += 1.5 * clamp01(1 - travelMinutes / Math.max(c.maxTravelMinutes, 1));
  }

  // ---- SOFT: trip specifics -------------------------------------------------
  if (c.destinationTypes?.length && option.style === "trip") {
    softMax += 2;
    const hit = c.destinationTypes.some((d) => tags.includes(d.toLowerCase()));
    softPoints += hit ? 2 : 0.4;
  }
  if (c.maxDays != null && option.style === "trip") {
    softMax += 1;
    softPoints += c.maxDays >= 2 ? 1 : 0.3;
  }

  const soft = softMax === 0 ? 0.72 : clamp01(softPoints / softMax);
  return { feasible: hard.length === 0, hardKinds: hard, soft };
}

/** Parses "must be home by 10:00 PM" style conditions into minutes. */
export function parseHomeBy(text: string): number | null {
  const m = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  const ap = m[3]?.toLowerCase();
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  if (!ap && h <= 11) h += 12; // "home by 10" almost always means evening
  return h * 60 + min;
}

function transportFeasible(option: OptionSeed, members: MemberInput[]) {
  if (!option.requiresDriving) return { ok: true, ratio: 1 };
  const riders = members.filter((m) => m.constraints?.needsRide && !m.constraints?.canDrive).length;
  const seats = members.reduce((acc, m) => {
    const c = m.constraints ?? {};
    if (!c.canDrive) return acc;
    if (
      c.maxTravelMinutes != null &&
      (m.travelMinutes ?? option.travelMinutes) > c.maxTravelMinutes
    )
      return acc;
    return acc + Math.max(0, c.seats ?? 3);
  }, 0);
  if (riders === 0) return { ok: true, ratio: 1 };
  return { ok: seats >= riders, ratio: clamp01(seats / Math.max(riders, 1)) };
}

export function scoreOption(option: OptionSeed, members: MemberInput[]): ScoredOption {
  const evals = members.map((m) => evaluateMember(option, m));
  const transport = transportFeasible(option, members);

  const blocked = evals.filter((e) => !e.feasible).length;
  const feasible = blocked === 0 && transport.ok;

  const softs = evals.map((e) => e.soft);
  const avgSoft = softs.length ? softs.reduce((a, b) => a + b, 0) / softs.length : 0.7;
  const minSoft = softs.length ? Math.min(...softs) : 0.7;

  // Fairness: penalise spread between the happiest and least-served member,
  // weighted by how often that member has already compromised.
  const spread = softs.length ? Math.max(...softs) - minSoft : 0;
  const loadWeights = members.map((m, i) => (1 - softs[i]!) * (0.5 + (m.sacrificeLoad ?? 0)));
  const loadPenalty = loadWeights.length
    ? loadWeights.reduce((a, b) => a + b, 0) / loadWeights.length
    : 0;
  const fairness = clamp01(1 - spread * 0.65 - loadPenalty * 0.35);

  // Weighted blend. Universal feasibility dominates; then fairness; then the
  // group's aggregate preference satisfaction.
  const groupFit = avgSoft * 0.55 + minSoft * 0.45;
  const raw = groupFit * 0.62 + fairness * 0.28 + transport.ratio * 0.1;

  let score = Math.round(raw * 100);
  if (!feasible) score = Math.max(12, Math.round(score * 0.45) - blocked * 6);
  score = Math.max(0, Math.min(99, score));

  const reasons: string[] = [];
  const cautions: string[] = [];
  if (feasible) {
    reasons.push("Fits every group member's spending limit");
    reasons.push("Works with everyone's available times");
    if (option.requiresDriving) reasons.push("Transportation covers everyone who needs a ride");
    else reasons.push("No transportation required");
    if (avgSoft > 0.7) reasons.push("Matches most stated preferences");
    if (minSoft < 0.45) cautions.push("One member's preferences are only partly met");
    if (option.travelMinutes > 25)
      cautions.push("Travel time is on the longer side for this group");
    if (option.distanceMiles != null) {
      reasons.push(`Within every member's travel radius — ${option.distanceMiles} miles away`);
    }
  } else {
    cautions.push("This option does not meet every member's requirements");
    if (!transport.ok) cautions.push("There aren't enough seats to get everyone there and back");
  }

  const breakdown: ScoreBreakdown = {
    hardFailures: blocked + (transport.ok ? 0 : 1),
    budgetFit: Math.round(
      clamp01(1 - countKind(evals, "budget") / Math.max(members.length, 1)) * 100,
    ),
    scheduleFit: Math.round(
      clamp01(
        1 -
          (countKind(evals, "schedule") + countKind(evals, "curfew")) / Math.max(members.length, 1),
      ) * 100,
    ),
    travelFit: Math.round(
      clamp01(1 - countKind(evals, "travel") / Math.max(members.length, 1)) * 100,
    ),
    dietaryFit: Math.round(
      clamp01(1 - countKind(evals, "dietary") / Math.max(members.length, 1)) * 100,
    ),
    preferenceFit: Math.round(avgSoft * 100),
    transportFit: Math.round(transport.ratio * 100),
    fairness: Math.round(fairness * 100),
    requiresDriving: option.requiresDriving,
    overallFit: Math.round(groupFit * 100),
    reasons,
    cautions,
    ...(option.address || option.distanceMiles != null
      ? {
          venue: {
            ...(option.address ? { address: option.address } : {}),
            ...(option.distanceMiles != null ? { distanceMiles: option.distanceMiles } : {}),
            ...(option.priceLevel ? { priceLevel: option.priceLevel } : {}),
            ...(option.rating != null ? { rating: option.rating } : {}),
            ...(option.cuisine ? { cuisine: option.cuisine } : {}),
            ...(option.kind ? { kind: option.kind } : {}),
            ...(option.lat != null ? { lat: option.lat } : {}),
            ...(option.lon != null ? { lon: option.lon } : {}),
          },
        }
      : {}),
  };

  return { option, score, feasible, breakdown };
}

function countKind(evals: MemberEval[], kind: string) {
  return evals.filter((e) => e.hardKinds.includes(kind)).length;
}

export function rankOptions(options: OptionSeed[], members: MemberInput[]): ScoredOption[] {
  return options
    .map((o) => scoreOption(o, members))
    .sort((a, b) => {
      if (a.feasible !== b.feasible) return a.feasible ? -1 : 1;
      if (b.score !== a.score) return b.score - a.score;
      return b.breakdown.fairness - a.breakdown.fairness;
    });
}

/** Builds a car-by-car plan that respects seats, distance and return times. */
export function buildTransportPlan(
  option: OptionSeed,
  members: {
    profileId: string;
    name: string;
    constraints: ConstraintPayload;
    travelMinutes?: number;
  }[],
) {
  const drivers = members.filter(
    (m) =>
      m.constraints?.canDrive &&
      (m.constraints.maxTravelMinutes == null ||
        (m.travelMinutes ?? option.travelMinutes) <= m.constraints.maxTravelMinutes),
  );
  const riders = members.filter((m) => m.constraints?.needsRide && !m.constraints?.canDrive);
  const cars: { label: string; driver: string; passengers: string[] }[] = [];
  const queue = [...riders];
  drivers.forEach((d, i) => {
    const seats = Math.max(0, d.constraints.seats ?? 3);
    const passengers = queue.splice(0, seats).map((p) => p.name);
    cars.push({ label: `Car ${i + 1}`, driver: d.name, passengers });
  });
  return { cars, unseated: queue.map((q) => q.name) };
}
