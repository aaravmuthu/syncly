import type { Course, TranscriptCourse } from "./types";

function letterToPoints(letter: string, weighted: boolean): number | null {
  const l = letter.trim().toUpperCase();
  const map: Record<string, number> = { A: 4, B: 3, C: 2, D: 1, F: 0 };
  const m = l.match(/^([A-F])([+-]?)$/);
  if (m) {
    let p = map[m[1]];
    if (m[2] === "+") p += 0.3;
    if (m[2] === "-") p -= 0.3;
    if (weighted && p >= 3) p += 1;
    return p;
  }
  const n = Number(l);
  if (Number.isFinite(n)) return numericToPoints(n, weighted);
  return null;
}

export function numericToPoints(avg: number, weighted: boolean): number {
  let p: number;
  if (avg >= 90) p = 4;
  else if (avg >= 80) p = 3;
  else if (avg >= 75) p = 2;
  else if (avg >= 70) p = 1;
  else p = 0;
  if (weighted && avg >= 80) p += 1;
  return p;
}

export function currentYearGPA(courses: Course[], weighted: boolean): number {
  const vals = courses
    .map((c) => (c.average !== null ? numericToPoints(c.average, weighted) : null))
    .filter((v): v is number => v !== null);
  if (!vals.length) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export function cumulativeGPA(transcript: TranscriptCourse[], weighted: boolean): number {
  const pts: number[] = [];
  for (const r of transcript) {
    const s1 = r.sem1 ? letterToPoints(r.sem1, weighted) : null;
    const s2 = r.sem2 ? letterToPoints(r.sem2, weighted) : null;
    if (s1 !== null) pts.push(s1);
    if (s2 !== null) pts.push(s2);
  }
  if (!pts.length) return 0;
  return pts.reduce((a, b) => a + b, 0) / pts.length;
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
