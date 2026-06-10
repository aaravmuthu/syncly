// Academic streak tracking. A streak counts consecutive days the student
// checked their grades while staying "on track" (GPA at/above a threshold or
// all planner tasks done). Pure helpers; persistence lives in the store.

export interface StreakState {
  /** Current consecutive on-track day count. */
  count: number;
  /** All-time best streak. */
  best: number;
  /** ISO YYYY-MM-DD of the last counted day, or null. */
  lastDate: string | null;
  /** Whether today has been counted yet. */
  todayCounted: boolean;
}

export const STREAK_THRESHOLD = 3.5; // weighted GPA "on track" line

export function emptyStreak(): StreakState {
  return { count: 0, best: 0, lastDate: null, todayCounted: false };
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + "T00:00:00").getTime();
  const db = new Date(b + "T00:00:00").getTime();
  return Math.round((db - da) / 86_400_000);
}

/**
 * Record a check-in for today. `onTrack` decides whether the day counts toward
 * the streak. Returns the next state plus whether the streak just advanced.
 */
export function recordCheckIn(prev: StreakState, onTrack: boolean): { next: StreakState; advanced: boolean } {
  const today = todayKey();

  // Already handled today: keep as-is.
  if (prev.lastDate === today) {
    return { next: { ...prev, todayCounted: true }, advanced: false };
  }

  if (!onTrack) {
    // Off-track visit doesn't extend the streak, but resets the "today" flag.
    return { next: { ...prev, todayCounted: false }, advanced: false };
  }

  const gap = prev.lastDate ? daysBetween(prev.lastDate, today) : Infinity;
  const count = gap === 1 ? prev.count + 1 : 1; // consecutive vs reset
  const best = Math.max(prev.best, count);
  return {
    next: { count, best, lastDate: today, todayCounted: true },
    advanced: true,
  };
}

/** A short milestone label for celebratory copy. */
export function streakMilestone(count: number): string | null {
  if (count >= 30) return "Unstoppable";
  if (count >= 14) return "On fire";
  if (count >= 7) return "One week strong";
  if (count >= 3) return "Heating up";
  return null;
}
