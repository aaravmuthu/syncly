import {
  DEFAULT_CUSTOM,
  type ConversionMode,
  type CustomScale,
  type GpaCourse,
  type GpaSettings,
  type ScaleId,
  type TierId,
} from "./types";

/* ------------------------------------------------------------------ */
/* Grade normalization                                                 */
/* ------------------------------------------------------------------ */

/** Representative numeric value for a letter grade (midpoint-ish, HAC style). */
const LETTER_NUMERIC: Record<string, number> = {
  "A+": 98,
  A: 95,
  "A-": 91,
  "B+": 88,
  B: 85,
  "B-": 81,
  "C+": 78,
  C: 75,
  "C-": 71,
  "D+": 68,
  D: 65,
  "D-": 61,
  F: 50,
};

/** Parse a grade cell into a 0-100 numeric value. Returns null when unusable. */
export function toNumericGrade(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const s = String(raw).trim().toUpperCase();
  if (!s) return null;
  if (/^(P|PASS|CR|NG|I|W|EX)$/.test(s)) return null;
  const n = Number(s.replace("%", ""));
  if (Number.isFinite(n) && n >= 0 && n <= 120) return Math.min(100, n);
  const letter = s.replace(/\s+/g, "");
  if (letter in LETTER_NUMERIC) return LETTER_NUMERIC[letter];
  return null;
}

/** Letter bucket used for the distribution chart and discrete conversion. */
export function letterFor(numeric: number): "A" | "B" | "C" | "D" | "F" {
  if (numeric >= 90) return "A";
  if (numeric >= 80) return "B";
  if (numeric >= 70) return "C";
  if (numeric >= 60) return "D";
  return "F";
}

/* ------------------------------------------------------------------ */
/* Scales                                                              */
/* ------------------------------------------------------------------ */

export interface ResolvedScale {
  id: ScaleId;
  label: string;
  mode: ConversionMode;
  boosts: Record<TierId, number>;
  tops: Record<TierId, number>;
  maxPoints: number;
}

export function resolveScale(scale: ScaleId, custom: CustomScale): ResolvedScale {
  switch (scale) {
    case "unweighted4":
      return {
        id: scale,
        label: "Standard 4.0 (Unweighted)",
        mode: "discrete",
        boosts: { ap: 0, dual: 0, honors: 0, regular: 0 },
        tops: { ap: 4, dual: 4, honors: 4, regular: 4 },
        maxPoints: 4,
      };
    case "weighted5":
      return {
        id: scale,
        label: "Standard 5.0 (Weighted)",
        mode: "discrete",
        boosts: { ap: 1, dual: 1, honors: 0.5, regular: 0 },
        tops: { ap: 5, dual: 5, honors: 4.5, regular: 4 },
        maxPoints: 5,
      };
    case "tiered6":
      return {
        id: scale,
        label: "Tiered 6.0 (Texas, 100-point)",
        mode: "continuous",
        boosts: { ap: 1, dual: 1, honors: 0.5, regular: 0 },
        tops: { ap: 6, dual: 6, honors: 5.5, regular: 5 },
        maxPoints: 6,
      };
    default: {
      const c = custom ?? DEFAULT_CUSTOM;
      const maxPoints =
        c.mode === "discrete"
          ? 4 + Math.max(...Object.values(c.boosts))
          : Math.max(...Object.values(c.tops));
      return {
        id: "custom",
        label: "Custom scale",
        mode: c.mode,
        boosts: c.boosts,
        tops: c.tops,
        maxPoints,
      };
    }
  }
}

/**
 * Grade points for a numeric grade under a resolved scale.
 * Discrete: A=4, B=3, C=2, F=0, plus the tier boost (never boosts a failure).
 * Continuous: linear 0.1 point per percentage point, anchored so 100 = tier top
 * and 70 = tier top - 3. Anything under 70 is a 0.
 */
export function gradePoints(numeric: number, tier: TierId, scale: ResolvedScale): number {
  if (scale.mode === "continuous") {
    if (numeric < 70) return 0;
    const top = scale.tops[tier] ?? scale.tops.regular;
    return round3(top - (100 - Math.min(100, numeric)) * 0.1);
  }
  const letter = letterFor(numeric);
  const base = letter === "A" ? 4 : letter === "B" ? 3 : letter === "C" ? 2 : 0;
  if (base === 0) return 0;
  return round3(base + (scale.boosts[tier] ?? 0));
}

/** Unweighted points, always on the plain 4.0 base of the active conversion mode. */
export function unweightedPoints(numeric: number, scale: ResolvedScale): number {
  if (scale.mode === "continuous") {
    if (numeric < 70) return 0;
    return round3(4 - (100 - Math.min(100, numeric)) * 0.1);
  }
  const letter = letterFor(numeric);
  return letter === "A" ? 4 : letter === "B" ? 3 : letter === "C" ? 2 : 0;
}

export function round3(n: number): number {
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/* ------------------------------------------------------------------ */
/* Course -> graded entries                                            */
/* ------------------------------------------------------------------ */

export interface GradedEntry {
  courseId: string;
  courseName: string;
  year: string;
  tier: TierId;
  label: string;
  numeric: number;
  credits: number;
}

/**
 * Split a course into credit-bearing graded entries.
 * Both semesters present -> each carries half the course credit.
 * Only a final (or a single semester) -> it carries the whole credit.
 */
export function entriesForCourse(course: GpaCourse): GradedEntry[] {
  if (course.exempt) return [];
  const credits = Number.isFinite(course.credits) ? Math.max(0, course.credits) : 0;
  if (credits <= 0) return [];
  const s1 = toNumericGrade(course.sem1);
  const s2 = toNumericGrade(course.sem2);
  const fin = toNumericGrade(course.final);

  const base = {
    courseId: course.id,
    courseName: course.name,
    year: course.year,
    tier: course.tier,
  };

  if (s1 !== null && s2 !== null) {
    return [
      { ...base, label: "S1", numeric: s1, credits: round3(credits / 2) },
      { ...base, label: "S2", numeric: s2, credits: round3(credits - credits / 2) },
    ];
  }
  if (s1 !== null) return [{ ...base, label: "S1", numeric: s1, credits }];
  if (s2 !== null) return [{ ...base, label: "S2", numeric: s2, credits }];
  if (fin !== null) return [{ ...base, label: "Final", numeric: fin, credits }];
  return [];
}

/* ------------------------------------------------------------------ */
/* Aggregation                                                         */
/* ------------------------------------------------------------------ */

export interface GpaResult {
  weighted: number;
  unweighted: number;
  percent: number;
  credits: number;
  entries: number;
}

export const EMPTY_RESULT: GpaResult = {
  weighted: 0,
  unweighted: 0,
  percent: 0,
  credits: 0,
  entries: 0,
};

export function computeGpa(courses: GpaCourse[], scale: ResolvedScale): GpaResult {
  let wSum = 0;
  let uSum = 0;
  let pSum = 0;
  let credits = 0;
  let count = 0;

  for (const course of courses) {
    for (const e of entriesForCourse(course)) {
      wSum += gradePoints(e.numeric, e.tier, scale) * e.credits;
      uSum += unweightedPoints(e.numeric, scale) * e.credits;
      pSum += e.numeric * e.credits;
      credits += e.credits;
      count += 1;
    }
  }

  if (credits <= 0) return EMPTY_RESULT;
  return {
    weighted: round3(wSum / credits),
    unweighted: round3(uSum / credits),
    percent: round3(pSum / credits),
    credits: round3(credits),
    entries: count,
  };
}

/** Sorted list of distinct school years, most recent last. */
export function yearsOf(courses: GpaCourse[]): string[] {
  return Array.from(new Set(courses.map((c) => c.year).filter(Boolean))).sort();
}

export function activeYearOf(courses: GpaCourse[], settings: GpaSettings): string {
  const years = yearsOf(courses);
  if (settings.activeYear && years.includes(settings.activeYear)) return settings.activeYear;
  return years[years.length - 1] ?? "";
}

export function gradeDistribution(courses: GpaCourse[]) {
  const buckets: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  for (const c of courses) {
    for (const e of entriesForCourse(c)) buckets[letterFor(e.numeric)] += 1;
  }
  return (["A", "B", "C", "D", "F"] as const)
    .map((k) => ({ letter: k, count: buckets[k] }))
    .filter((b) => b.count > 0);
}

export function gpaByYear(courses: GpaCourse[], scale: ResolvedScale) {
  return yearsOf(courses).map((year) => {
    const r = computeGpa(
      courses.filter((c) => c.year === year),
      scale,
    );
    return { year, weighted: r.weighted, unweighted: r.unweighted, percent: r.percent };
  });
}

/* ------------------------------------------------------------------ */
/* What-if / target engine                                             */
/* ------------------------------------------------------------------ */

export interface TargetInput {
  currentPoints: number; // weighted GPA now
  currentCredits: number;
  futureCredits: number;
  target: number;
}

export interface TargetResult {
  /** Average grade points needed across the future credits. */
  neededPoints: number;
  possible: boolean;
  /** True when the target is already met with zero additional effort. */
  alreadyMet: boolean;
}

export function requiredPoints(input: TargetInput, maxPoints: number): TargetResult {
  const { currentPoints, currentCredits, futureCredits, target } = input;
  if (futureCredits <= 0) {
    return {
      neededPoints: 0,
      possible: round3(currentPoints) >= round3(target),
      alreadyMet: round3(currentPoints) >= round3(target),
    };
  }
  const needed =
    (target * (currentCredits + futureCredits) - currentPoints * currentCredits) / futureCredits;
  return {
    neededPoints: round3(needed),
    possible: needed <= maxPoints + 1e-9,
    alreadyMet: needed <= 0,
  };
}

/** Invert grade points back to the minimum numeric grade that achieves them. */
export function pointsToGrade(points: number, tier: TierId, scale: ResolvedScale): number | null {
  if (points <= 0) return 0;
  if (scale.mode === "continuous") {
    const top = scale.tops[tier] ?? scale.tops.regular;
    const g = 100 - (top - points) / 0.1;
    if (g > 100.0001) return null;
    return round2(Math.max(70, g));
  }
  const boost = scale.boosts[tier] ?? 0;
  const base = points - boost;
  if (base <= 2 + 1e-9) return 70;
  if (base <= 3 + 1e-9) return 80;
  if (base <= 4 + 1e-9) return 90;
  return null;
}
