// Smart, friendly grade insights. Turns raw averages into encouraging,
// actionable copy: "You're only 1.2 points away from an A in Algebra!"

import type { Course } from "./types";
import { courseDisplay } from "./customize";
import type { CourseCustom } from "./types";

export interface GradeInsight {
  courseId: string;
  courseName: string;
  emoji: string | null;
  /** Headline copy shown to the student. */
  message: string;
  /** Smaller secondary nudge. */
  hint: string;
  /** Decimal points from the next letter grade (smaller = closer). */
  pointsAway: number;
  /** "A" | "B" | "C" | "D" target letter. */
  targetLetter: string;
  /** Whether this is a positive (climb up) vs warning (don't slip) insight. */
  tone: "climb" | "hold" | "ace";
}

// Texas-style letter thresholds.
const BOUNDARIES: { letter: string; min: number }[] = [
  { letter: "A", min: 90 },
  { letter: "B", min: 80 },
  { letter: "C", min: 75 },
  { letter: "D", min: 70 },
];

function nextLetterUp(avg: number): { letter: string; min: number } | null {
  // Find the lowest boundary strictly above the current average.
  const above = [...BOUNDARIES].sort((a, b) => a.min - b.min).find((b) => b.min > avg);
  return above ?? null;
}

function currentLetter(avg: number): string {
  for (const b of BOUNDARIES) if (avg >= b.min) return b.letter;
  return "F";
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Build a single insight for one course, or null if it has no average. */
export function courseInsight(course: Course, custom?: CourseCustom): GradeInsight | null {
  if (course.average === null) return null;
  const disp = courseDisplay(course, custom);
  const avg = course.average;
  const up = nextLetterUp(avg);

  // Already at the top: celebrate holding the A.
  if (!up) {
    const cushion = round1(avg - 90);
    return {
      courseId: course.id,
      courseName: disp.name,
      emoji: disp.emoji ?? null,
      message: `You're acing ${disp.name} with a ${avg.toFixed(1)} 🎉`,
      hint: cushion > 0 ? `${cushion.toFixed(1)} pts of cushion above an A — keep it locked in.` : "Right on the A line — hold steady.",
      pointsAway: 0,
      targetLetter: "A",
      tone: "ace",
    };
  }

  const pointsAway = round1(up.min - avg);

  // Close to slipping below the current letter?
  const cur = currentLetter(avg);
  const curMin = BOUNDARIES.find((b) => b.letter === cur)?.min ?? 0;
  const slipRisk = avg - curMin <= 1.5 && cur !== "A";

  if (slipRisk) {
    return {
      courseId: course.id,
      courseName: disp.name,
      emoji: disp.emoji ?? null,
      message: `Protect your ${cur} in ${disp.name}`,
      hint: `Only ${round1(avg - curMin).toFixed(1)} pts above a ${cur} — tap to see what keeps you safe.`,
      pointsAway,
      targetLetter: cur,
      tone: "hold",
    };
  }

  return {
    courseId: course.id,
    courseName: disp.name,
    emoji: disp.emoji ?? null,
    message: `Only ${pointsAway.toFixed(1)} points from ${up.letter === "A" ? "an" : "a"} ${up.letter} in ${disp.name}!`,
    hint: "Tap to see exactly which assignment can push you over.",
    pointsAway,
    targetLetter: up.letter,
    tone: "climb",
  };
}

/**
 * Top insights across all courses, sorted by how close/actionable they are.
 * "Climb" insights that are nearly there bubble to the top, then hold-risks.
 */
export function topInsights(
  courses: Course[],
  custom: Record<string, CourseCustom>,
  limit = 4,
): GradeInsight[] {
  const all = courses
    .map((c) => courseInsight(c, custom[c.id]))
    .filter((i): i is GradeInsight => i !== null);

  const rank = (i: GradeInsight) => {
    if (i.tone === "hold") return 0; // urgent first
    if (i.tone === "climb") return 1 + i.pointsAway / 100; // closer = higher
    return 5; // aces last
  };

  return all.sort((a, b) => rank(a) - rank(b)).slice(0, limit);
}
