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

/**
 * Non-GPA marks. Pass/fail, credit-only, incomplete, withdrawn and exempt
 * grades never contribute quality points or GPA credits.
 */
const NON_GPA_MARK = /^(P|PASS|F\/P|CR|NC|NG|I|INC|W|WD|EX|EXEMPT|AUD|N\/A|--|-)$/;

export function isNonGpaMark(raw: string | null | undefined): boolean {
  if (raw == null) return false;
  return NON_GPA_MARK.test(String(raw).trim().toUpperCase());
}

/** Parse a grade cell into a 0-100 numeric value. Returns null when unusable. */
export function toNumericGrade(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const s = String(raw).trim().toUpperCase();
  if (!s) return null;
  if (NON_GPA_MARK.test(s)) return null;
  const n = Number(s.replace("%", ""));
  if (Number.isFinite(n) && n >= 0 && n <= 120) return Math.min(100, n);
  const letter = s.replace(/\s+/g, "");
  if (letter in LETTER_NUMERIC) return LETTER_NUMERIC[letter];
  return null;
}

/** Letter bucket used for the distribution chart and banded conversion. */
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
  /**
   * banded     — 90-100 = top, 80-89 = top-1, 70-79 = top-2, below 70 = 0
   * continuous — top - 0.1 per point below 100, floor at 70, below 70 = 0
   * raw        — raw 100-point average plus a difficulty boost
   */
  mode: ScaleMode;
  /** Points awarded for a 90-100 in that tier (banded / continuous). */
  tops: Record<TierId, number>;
  /** Points added on top of the raw average (raw mode) or the 4.0 base (custom discrete). */
  boosts: Record<TierId, number>;
  maxPoints: number;
}

export type ScaleMode = "banded" | "continuous" | "raw";

const TIERS: TierId[] = ["ap", "dual", "honors", "regular"];

function tops(ap: number, honors: number, regular: number): Record<TierId, number> {
  return { ap, dual: ap, honors, regular };
}

function boostsFromTops(t: Record<TierId, number>): Record<TierId, number> {
  const base = t.regular;
  return {
    ap: round3(t.ap - base),
    dual: round3(t.dual - base),
    honors: round3(t.honors - base),
    regular: 0,
  };
}

export function resolveScale(scale: ScaleId, custom: CustomScale): ResolvedScale {
  switch (scale) {
    case "unweighted4": {
      const t = tops(4, 4, 4);
      return {
        id: scale,
        label: "Standard 4.0 (Unweighted)",
        mode: "banded",
        tops: t,
        boosts: boostsFromTops(t),
        maxPoints: 4,
      };
    }
    case "weighted5": {
      const t = tops(5, 4.5, 4);
      return {
        id: scale,
        label: "Weighted 5.0",
        mode: "banded",
        tops: t,
        boosts: boostsFromTops(t),
        maxPoints: 5,
      };
    }
    case "tiered6banded": {
      const t = tops(6, 5.5, 5);
      return {
        id: scale,
        label: "Texas 6.0 Tiered (Banded)",
        mode: "banded",
        tops: t,
        boosts: boostsFromTops(t),
        maxPoints: 6,
      };
    }
    case "tiered6":
    case "tiered6continuous": {
      const t = tops(6, 5.5, 5);
      return {
        id: "tiered6continuous",
        label: "Texas 6.0 Continuous",
        mode: "continuous",
        tops: t,
        boosts: boostsFromTops(t),
        maxPoints: 6,
      };
    }
    case "raw100": {
      const b: Record<TierId, number> = { ap: 10, dual: 10, honors: 5, regular: 0 };
      return {
        id: scale,
        label: "Raw 100-Point Weighted",
        mode: "raw",
        tops: tops(100, 100, 100),
        boosts: b,
        maxPoints: 110,
      };
    }
    default: {
      const c = custom ?? DEFAULT_CUSTOM;
      if (c.mode === "continuous") {
        return {
          id: "custom",
          label: "Custom scale",
          mode: "continuous",
          tops: c.tops,
          boosts: boostsFromTops(c.tops),
          maxPoints: Math.max(...TIERS.map((t) => c.tops[t] ?? 0)),
        };
      }
      const t: Record<TierId, number> = {
        ap: 4 + (c.boosts.ap ?? 0),
        dual: 4 + (c.boosts.dual ?? 0),
        honors: 4 + (c.boosts.honors ?? 0),
        regular: 4 + (c.boosts.regular ?? 0),
      };
      return {
        id: "custom",
        label: "Custom scale",
        mode: "banded",
        tops: t,
        boosts: c.boosts,
        maxPoints: Math.max(...TIERS.map((k) => t[k])),
      };
    }
  }
}

/**
 * Grade points for a numeric grade under a resolved scale.
 * Banded:     90-100 = top, 80-89 = top-1, 70-79 = top-2, below 70 = 0.
 * Continuous: top - 0.1 per point below 100, down to 70; below 70 = 0.
 * Raw:        the numeric average plus the tier's difficulty boost.
 */
export function gradePoints(numeric: number, tier: TierId, scale: ResolvedScale): number {
  const g = Math.min(100, numeric);
  if (scale.mode === "raw") {
    return round3(g + (scale.boosts[tier] ?? 0));
  }
  if (g < 70) return 0;
  const top = scale.tops[tier] ?? scale.tops.regular;
  if (scale.mode === "continuous") return round3(Math.max(0, top - (100 - g) * 0.1));
  if (g >= 90) return round3(top);
  if (g >= 80) return round3(Math.max(0, top - 1));
  return round3(Math.max(0, top - 2));
}

/** Unweighted points: always the plain 4.0 band (90/80/70 cutoffs). */
export function unweightedPoints(numeric: number, _scale?: ResolvedScale): number {
  const g = Math.min(100, numeric);
  if (g >= 90) return 4;
  if (g >= 80) return 3;
  if (g >= 70) return 2;
  return 0;
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
 * Exempt / pass-fail / non-GPA courses produce no entries at all, so they
 * never touch quality points or GPA credits.
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
/* Aggregation — total quality points / total GPA credits              */
/* ------------------------------------------------------------------ */

export interface GpaResult {
  weighted: number;
  unweighted: number;
  percent: number;
  /** Total quality points on the active weighted scale. */
  qualityPoints: number;
  credits: number;
  entries: number;
}

export const EMPTY_RESULT: GpaResult = {
  weighted: 0,
  unweighted: 0,
  percent: 0,
  qualityPoints: 0,
  credits: 0,
  entries: 0,
};

/**
 * Cumulative GPA = sum(grade points * credits) / sum(credits).
 * Never an average of averages — works identically for a single term,
 * a full year, or every year on record.
 */
export function computeGpa(courses: GpaCourse[], scale: ResolvedScale): GpaResult {
  let wSum = 0;
  let uSum = 0;
  let pSum = 0;
  let credits = 0;
  let count = 0;

  for (const course of courses) {
    for (const e of entriesForCourse(course)) {
      wSum += gradePoints(e.numeric, e.tier, scale) * e.credits;
      uSum += unweightedPoints(e.numeric) * e.credits;
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
    qualityPoints: round3(wSum),
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
  if (scale.mode === "raw") {
    const g = points - (scale.boosts[tier] ?? 0);
    if (g > 100.0001) return null;
    return round2(Math.max(0, g));
  }
  const top = scale.tops[tier] ?? scale.tops.regular;
  if (scale.mode === "continuous") {
    const g = 100 - (top - points) / 0.1;
    if (g > 100.0001) return null;
    return round2(Math.max(70, g));
  }
  if (points <= top - 2 + 1e-9) return 70;
  if (points <= top - 1 + 1e-9) return 80;
  if (points <= top + 1e-9) return 90;
  return null;
}
