import type { Course, PastCourse, Tier } from "./types";

export function letterFromPercent(p: number): string {
  if (p >= 90) return "A";
  if (p >= 80) return "B";
  if (p >= 70) return "C";
  if (p >= 60) return "D";
  return "F";
}

export function unweightedPoints(percent: number): number {
  if (percent >= 90) return 4;
  if (percent >= 80) return 3;
  if (percent >= 70) return 2;
  if (percent >= 60) return 1;
  return 0;
}

export function weightedPoints(percent: number, tier: Tier): number {
  const base = unweightedPoints(percent);
  if (base === 0) return 0;
  if (tier === "Honors") return base + 0.5;
  if (tier === "AP") return base + 1;
  return base;
}

export function courseAverage(course: Course, overrides: Record<string, number> = {}): number {
  const byCat = new Map<string, { earned: number; total: number }>();
  for (const a of course.assignments) {
    const cat = byCat.get(a.category) ?? { earned: 0, total: 0 };
    const pct = overrides[a.id] ?? (a.outOf > 0 ? (a.score / a.outOf) * 100 : 0);
    cat.earned += pct;
    cat.total += 100;
    byCat.set(a.category, cat);
  }
  let avg = 0;
  let weightSum = 0;
  for (const c of course.categories) {
    const v = byCat.get(c.name);
    if (!v || v.total === 0) continue;
    avg += (v.earned / v.total) * 100 * c.weight;
    weightSum += c.weight;
  }
  if (weightSum === 0) return 0;
  return avg / weightSum;
}

export interface GpaResult {
  unweighted: number;
  weighted: number;
  totalCredits: number;
}

export function semesterGpaFromCourses(
  rows: Array<{ percent: number; tier: Tier; credits: number }>,
): GpaResult {
  let uw = 0;
  let w = 0;
  let credits = 0;
  for (const r of rows) {
    uw += unweightedPoints(r.percent) * r.credits;
    w += weightedPoints(r.percent, r.tier) * r.credits;
    credits += r.credits;
  }
  if (credits === 0) return { unweighted: 0, weighted: 0, totalCredits: 0 };
  return { unweighted: uw / credits, weighted: w / credits, totalCredits: credits };
}

export function cumulativeGpa(
  past: PastCourse[],
  current: Array<{ percent: number; tier: Tier; credits: number }>,
): GpaResult {
  const pastRows = past.map((p) => ({ percent: p.finalGrade, tier: p.tier, credits: p.credits }));
  return semesterGpaFromCourses([...pastRows, ...current]);
}