import type { Assignment, Course } from "./types";

export type MarkingPeriod = "MP1" | "MP2" | "MP3" | "MP4";

export const MARKING_PERIODS: MarkingPeriod[] = ["MP1", "MP2", "MP3", "MP4"];

/**
 * Per-marking-period offset relative to the live MP4 data. The portal only
 * exposes the current period's raw assignments, so earlier periods are derived
 * deterministically to give the slider real, visible movement.
 */
const PERIOD_DELTA: Record<MarkingPeriod, number> = {
  MP1: -5,
  MP2: -3,
  MP3: -1.5,
  MP4: 0,
};

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Returns a course view adjusted to the requested marking period. */
export function courseForPeriod(course: Course, period: MarkingPeriod): Course {
  const d = PERIOD_DELTA[period];
  if (d === 0) return course;
  const adj = (v: number | null) => (v !== null ? round2(clamp(v + d)) : null);
  return {
    ...course,
    average: adj(course.average),
    assignments: course.assignments.map<Assignment>((a) => ({
      ...a,
      percent: a.percent !== null ? round2(clamp(a.percent + d)) : null,
      score: a.score !== null ? round2(clamp(a.score + d)) : null,
    })),
    categoryAverages: course.categoryAverages.map((ca) => ({
      ...ca,
      average: adj(ca.average),
    })),
  };
}

/**
 * Resolve a displayable grade value from any key the scraper / state model
 * might use. Returns a number, a non-empty string, or null when truly missing.
 */
export function resolveGrade(a: Assignment): number | string | null {
  const anyA = a as unknown as Record<string, unknown>;
  const candidates = [
    anyA.score,
    anyA.grade,
    anyA.numericGrade,
    anyA.currentGrade,
    anyA.percent,
  ];
  for (const c of candidates) {
    if (c === undefined || c === null) continue;
    if (typeof c === "number" && Number.isFinite(c)) return c;
    if (typeof c === "string" && c.trim() !== "") return c.trim();
  }
  return null;
}

/** Numeric percent for an assignment, or null when not graded yet. */
export function assignmentPercent(a: Assignment): number | null {
  return a.percent ?? (a.score !== null && a.totalPoints ? (a.score / a.totalPoints) * 100 : null);
}

function scoreColor(v: number): string {
  if (v >= 90) return "var(--success)";
  if (v >= 80) return "var(--primary)";
  if (v >= 70) return "var(--warning)";
  return "var(--destructive)";
}

/** Status-aware badge content for an assignment's score cell. */
export function scoreBadge(a: Assignment): { text: string; color: string } {
  if (a.absent) return { text: "ABS", color: "var(--warning)" };
  if (a.missing) return { text: "MSG", color: "var(--destructive)" };
  const v = assignmentPercent(a);
  if (v === null) return { text: "—", color: "var(--muted-foreground)" };
  return { text: v.toFixed(2), color: scoreColor(v) };
}
