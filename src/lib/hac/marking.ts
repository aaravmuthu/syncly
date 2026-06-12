import type { Assignment, Course } from "./types";

export type MarkingPeriod = "MP1" | "MP2" | "MP3" | "MP4";

export const MARKING_PERIODS: MarkingPeriod[] = ["MP1", "MP2", "MP3", "MP4"];

/** Returns the closest real HAC-backed course view for the requested marking period. */
export function courseForPeriod(course: Course, period: MarkingPeriod): Course {
  if (period === "MP4") return course;
  const reportAverage =
    period === "MP1"
      ? course.reportCard?.mp1 ?? null
      : period === "MP2"
        ? course.reportCard?.mp2 ?? null
        : course.reportCard?.mp3 ?? null;

  return {
    ...course,
    average: reportAverage,
    assignments: [],
    categoryAverages: [],
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

  // Prefer a clean numeric percent; fall back across every possible grade key.
  const v = assignmentPercent(a);
  if (v !== null && Number.isFinite(v)) return { text: v.toFixed(2), color: scoreColor(v) };

  const raw = resolveGrade(a);
  if (raw !== null) {
    if (typeof raw === "number") return { text: raw.toFixed(2), color: scoreColor(raw) };
    const asNum = parseFloat(raw);
    if (Number.isFinite(asNum)) return { text: raw, color: scoreColor(asNum) };
    return { text: raw, color: "var(--foreground)" }; // letter grade, etc.
  }

  // Genuinely ungraded — render a highly visible lavender placeholder so the
  // text container is always present and aligned, never blank.
  return { text: "--", color: "#c4b5fd" };
}
