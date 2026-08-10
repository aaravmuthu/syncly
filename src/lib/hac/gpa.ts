import type { Course, TranscriptCourse } from "./types";
import type { TierId } from "@/lib/gpacalc/types";
import {
  gradePoints,
  isNonGpaMark,
  resolveScale,
  toNumericGrade,
  unweightedPoints,
  round3,
} from "@/lib/gpacalc/engine";
import { DEFAULT_CUSTOM } from "@/lib/gpacalc/types";

/* ------------------------------------------------------------------ */
/* Scales used by the HAC dashboard                                    */
/* ------------------------------------------------------------------ */

/** Weighted view uses the Texas 6.0 continuous scale; unweighted is the 4.0 band. */
const WEIGHTED_SCALE = resolveScale("tiered6continuous", DEFAULT_CUSTOM);
const UNWEIGHTED_SCALE = resolveScale("unweighted4", DEFAULT_CUSTOM);

/** Infer the difficulty tier from a course name / code. */
export function tierForCourseName(name: string | null | undefined): TierId {
  const n = (name ?? "").toUpperCase();
  if (/\b(AP|IB|ADV\s*PLACEMENT|ADVANCED PLACEMENT)\b/.test(n)) return "ap";
  if (/\b(DC|DUAL|COLLEGE|ONRAMPS|AAC)\b/.test(n)) return "dual";
  if (/\b(PAP|PRE-?AP|H|HON|HONORS|GT|ADV|ADVANCED|K-?LEVEL)\b/.test(n)) return "honors";
  return "regular";
}

/** Courses that never earn GPA credit (pass/fail-style enrollments). */
function isNonGpaCourse(name: string | null | undefined): boolean {
  const n = (name ?? "").toUpperCase();
  return /\b(PASS\/FAIL|P\/F|OFFICE AIDE|AIDE|LUNCH|HOMEROOM|ADVISORY|STUDY HALL)\b/.test(n);
}

/** Parse a credit column ("1.0", "0.5", "") into a usable credit value. */
export function parseCredits(raw: string | number | null | undefined, fallback = 1): number {
  if (typeof raw === "number") return Number.isFinite(raw) && raw > 0 ? raw : fallback;
  const n = Number(String(raw ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Grade points for a 0-100 average.
 * Weighted uses the Texas 6.0 continuous scale for the given difficulty tier.
 */
export function numericToPoints(avg: number, weighted: boolean, tier: TierId = "regular"): number {
  if (!Number.isFinite(avg)) return 0;
  return weighted ? gradePoints(avg, tier, WEIGHTED_SCALE) : unweightedPoints(avg);
}

/* ------------------------------------------------------------------ */
/* Quality-point aggregation                                           */
/* ------------------------------------------------------------------ */

interface QpEntry {
  points: number;
  credits: number;
}

function aggregate(entries: QpEntry[]): number {
  let qp = 0;
  let credits = 0;
  for (const e of entries) {
    if (e.credits <= 0) continue;
    qp += e.points * e.credits;
    credits += e.credits;
  }
  if (credits <= 0) return 0;
  return round3(qp / credits);
}

/**
 * Term / year GPA = sum(grade points * credits) / sum(credits).
 * Each in-progress course counts as 1.0 credit unless HAC says otherwise.
 */
export function currentYearGPA(courses: Course[], weighted: boolean): number {
  const entries: QpEntry[] = [];
  for (const c of courses) {
    if (c.average === null || !Number.isFinite(c.average)) continue;
    if (isNonGpaCourse(c.name)) continue;
    const tier = tierForCourseName(`${c.name ?? ""} ${c.code ?? ""}`);
    entries.push({ points: numericToPoints(c.average, weighted, tier), credits: 1 });
  }
  return aggregate(entries);
}

/**
 * Cumulative GPA across every transcript year: total quality points over
 * total GPA credits. Semester grades split the course credit; pass/fail and
 * non-GPA marks are excluded from both sides of the ratio.
 */
export function cumulativeGPA(transcript: TranscriptCourse[], weighted: boolean): number {
  const entries: QpEntry[] = [];
  for (const r of transcript) {
    const label = `${r.description ?? ""} ${r.course ?? ""}`;
    if (isNonGpaCourse(label)) continue;
    const tier = tierForCourseName(label);
    const total = parseCredits(r.credits, 1);

    const marks: (string | null | undefined)[] = [r.sem1, r.sem2];
    const graded = marks
      .map((m) => (isNonGpaMark(m) ? null : toNumericGrade(m)))
      .filter((v): v is number => v !== null);

    if (graded.length === 2) {
      const half = total / 2;
      for (const g of graded) {
        entries.push({ points: numericToPoints(g, weighted, tier), credits: half });
      }
      continue;
    }
    if (graded.length === 1) {
      entries.push({ points: numericToPoints(graded[0], weighted, tier), credits: total });
      continue;
    }
    const fin = isNonGpaMark(r.fin) ? null : toNumericGrade(r.fin);
    if (fin !== null) {
      entries.push({ points: numericToPoints(fin, weighted, tier), credits: total });
    }
  }
  return aggregate(entries);
}

/** Total GPA credits earned across the transcript (non-GPA marks excluded). */
export function transcriptCredits(transcript: TranscriptCourse[]): number {
  let credits = 0;
  for (const r of transcript) {
    const label = `${r.description ?? ""} ${r.course ?? ""}`;
    if (isNonGpaCourse(label)) continue;
    const total = parseCredits(r.credits, 1);
    const graded = [r.sem1, r.sem2, r.fin].some((m) => !isNonGpaMark(m) && toNumericGrade(m) !== null);
    if (graded) credits += total;
  }
  return round3(credits);
}

/** Recompute a course average from a list of assignment overrides. */
export function courseAverageFromAssignments(course: Course, overrides: Record<string, number>): number | null {
  // Group by category
  const byCat: Record<string, { earned: number; possible: number }> = {};
  for (const a of course.assignments) {
    const o = overrides[a.name];
    const pct =
      o !== undefined
        ? o
        : a.percent !== null
          ? a.percent
          : a.score !== null && a.totalPoints
            ? (a.score / a.totalPoints) * 100
            : null;
    if (pct === null) continue;
    if (!byCat[a.category]) byCat[a.category] = { earned: 0, possible: 0 };
    byCat[a.category].earned += pct;
    byCat[a.category].possible += 100;
  }
  // Weight by category weights if available
  const weights: Record<string, number> = {};
  let totalW = 0;
  for (const ca of course.categoryAverages) {
    if (ca.weight) {
      weights[ca.category] = ca.weight;
      totalW += ca.weight;
    }
  }
  let total = 0;
  let totalDen = 0;
  for (const cat of Object.keys(byCat)) {
    const { earned, possible } = byCat[cat];
    if (!possible) continue;
    const avg = (earned / possible) * 100;
    const w = totalW > 0 ? (weights[cat] ?? 0) : 1;
    if (totalW > 0 && !w) continue;
    total += avg * w;
    totalDen += w;
  }
  if (!totalDen) return null;
  return total / totalDen;
}
/** Live per-category averages given slider overrides (keyed by assignment name). */
export function categoryAveragesFromAssignments(
  course: Course,
  overrides: Record<string, number>,
): Record<string, number> {
  const byCat: Record<string, { earned: number; count: number }> = {};
  for (const a of course.assignments) {
    const o = overrides[a.name];
    const pct =
      o !== undefined
        ? o
        : a.percent !== null
          ? a.percent
          : a.score !== null && a.totalPoints
            ? (a.score / a.totalPoints) * 100
            : null;
    if (pct === null) continue;
    if (!byCat[a.category]) byCat[a.category] = { earned: 0, count: 0 };
    byCat[a.category].earned += pct;
    byCat[a.category].count += 1;
  }
  const out: Record<string, number> = {};
  for (const cat of Object.keys(byCat)) {
    const { earned, count } = byCat[cat];
    if (count) out[cat] = earned / count;
  }
  return out;
}
