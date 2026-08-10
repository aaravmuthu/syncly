import type { Assignment, Course, HacData } from "./types";
import { MARKING_PERIODS, courseForPeriod, type MarkingPeriod } from "./marking";

/**
 * Structured grade history: Academic Year → Semester (S1/S2) → Marking Period.
 *
 * HAC only ever exposes the *current* view reliably, so every sync merges what
 * it can see into a persistent local ledger. Once a marking period has been
 * left behind it is locked as historical data and never overwritten, which is
 * what keeps MP1–MP3 assignment detail alive after the term rolls over.
 */

export type SemesterId = "S1" | "S2";

export const SEMESTER_OF: Record<MarkingPeriod, SemesterId> = {
  MP1: "S1",
  MP2: "S1",
  MP3: "S2",
  MP4: "S2",
};

export const SEMESTER_PERIODS: Record<SemesterId, MarkingPeriod[]> = {
  S1: ["MP1", "MP2"],
  S2: ["MP3", "MP4"],
};

/** Weights used to compute a semester grade from its marking periods + exam. */
export const SEMESTER_WEIGHTS = { mpA: 0.4, mpB: 0.4, exam: 0.2 } as const;

export interface PeriodRecord {
  average: number | null;
  assignments: Assignment[];
  capturedAt: string;
  /** Locked records are historical and are never overwritten by a later sync. */
  locked: boolean;
}

export interface CourseRecord {
  courseId: string;
  courseName: string;
  periods: Partial<Record<MarkingPeriod, PeriodRecord>>;
  /** Semester exam scores keyed "S1" / "S2". */
  exams: Partial<Record<SemesterId, number | null>>;
}

export interface YearRecord {
  year: string;
  courses: Record<string, CourseRecord>;
}

export interface GradeLedger {
  version: 2;
  years: Record<string, YearRecord>;
  /** The marking period that was active the last time the ledger was written. */
  activePeriod: MarkingPeriod;
}

export function emptyLedger(): GradeLedger {
  return { version: 2, years: {}, activePeriod: "MP1" };
}

/** "2025-2026" style academic-year label for a date (year rolls over in August). */
export function academicYearLabel(iso?: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  const y = Number.isFinite(d.getTime()) ? d.getFullYear() : new Date().getFullYear();
  const start = (Number.isFinite(d.getTime()) ? d.getMonth() : 0) >= 7 ? y : y - 1;
  return `${start}-${start + 1}`;
}

function hasContent(r: { average: number | null; assignments: Assignment[] }): boolean {
  return r.average !== null || r.assignments.length > 0;
}

/**
 * Merge a fresh HAC sync into the ledger. Non-empty data always wins over an
 * empty slot; locked (historical) slots are preserved exactly as captured.
 */
export function mergeSync(
  ledger: GradeLedger,
  data: HacData,
  activePeriod: MarkingPeriod,
): GradeLedger {
  const year = academicYearLabel(data.syncedAt);
  const next: GradeLedger = {
    version: 2,
    activePeriod,
    years: { ...ledger.years, [year]: { year, courses: { ...(ledger.years[year]?.courses ?? {}) } } },
  };
  const bucket = next.years[year].courses;
  const now = new Date().toISOString();

  for (const course of data.courses) {
    const prev = bucket[course.id];
    const record: CourseRecord = {
      courseId: course.id,
      courseName: course.name,
      periods: { ...(prev?.periods ?? {}) },
      exams: { ...(prev?.exams ?? {}) },
    };

    for (const mp of MARKING_PERIODS) {
      const view = courseForPeriod(course, mp);
      const incoming = { average: view.average ?? null, assignments: view.assignments ?? [] };
      const existing = record.periods[mp];
      if (existing?.locked) continue;
      if (!hasContent(incoming) && existing) continue;
      record.periods[mp] = {
        average: incoming.average,
        assignments: incoming.assignments,
        capturedAt: now,
        locked: false,
      };
    }

    // Semester exams come straight from the report card matrix when present.
    if (course.reportCard?.exam != null) {
      const sem: SemesterId = activePeriod === "MP1" || activePeriod === "MP2" ? "S1" : "S2";
      record.exams[sem] = course.reportCard.exam;
    }

    bucket[course.id] = record;
  }

  return lockThrough(next, activePeriod);
}

/**
 * Lock every marking period that comes before the active one. Called on sync
 * and whenever the student switches the active marking-period view, so leaving
 * MP1 for MP2 freezes MP1 instead of letting a later scrape clear it.
 */
export function lockThrough(ledger: GradeLedger, activePeriod: MarkingPeriod): GradeLedger {
  const cutoff = MARKING_PERIODS.indexOf(activePeriod);
  const years: GradeLedger["years"] = {};
  for (const [yk, yv] of Object.entries(ledger.years)) {
    const courses: Record<string, CourseRecord> = {};
    for (const [ck, cv] of Object.entries(yv.courses)) {
      const periods: CourseRecord["periods"] = {};
      for (const mp of MARKING_PERIODS) {
        const rec = cv.periods[mp];
        if (!rec) continue;
        const shouldLock = MARKING_PERIODS.indexOf(mp) < cutoff && hasContent(rec);
        periods[mp] = shouldLock ? { ...rec, locked: true } : rec;
      }
      courses[ck] = { ...cv, periods };
    }
    years[yk] = { year: yv.year, courses };
  }
  return { version: 2, activePeriod, years };
}

/** Historical view of a course for a marking period, ledger first, live second. */
export function ledgerPeriod(
  ledger: GradeLedger,
  year: string,
  courseId: string,
  mp: MarkingPeriod,
): PeriodRecord | null {
  return ledger.years[year]?.courses[courseId]?.periods[mp] ?? null;
}

/** MP1 40% + MP2 40% + exam 20%; falls back to the mean of what exists. */
export function semesterGrade(
  record: CourseRecord | undefined,
  sem: SemesterId,
): { value: number | null; usedExam: boolean } {
  if (!record) return { value: null, usedExam: false };
  const [a, b] = SEMESTER_PERIODS[sem];
  const av = record.periods[a]?.average ?? null;
  const bv = record.periods[b]?.average ?? null;
  const exam = record.exams[sem] ?? null;

  if (av !== null && bv !== null && exam !== null) {
    return {
      value:
        av * SEMESTER_WEIGHTS.mpA + bv * SEMESTER_WEIGHTS.mpB + exam * SEMESTER_WEIGHTS.exam,
      usedExam: true,
    };
  }
  const parts = [av, bv].filter((v): v is number => v !== null);
  if (!parts.length) return { value: null, usedExam: false };
  return { value: parts.reduce((s, v) => s + v, 0) / parts.length, usedExam: false };
}

/** Per-course MP1→MP4 series for the historical comparison chart. */
export function courseHistory(
  ledger: GradeLedger,
  year: string,
  course: Course,
): { mp: MarkingPeriod; average: number | null; locked: boolean }[] {
  return MARKING_PERIODS.map((mp) => {
    const rec = ledgerPeriod(ledger, year, course.id, mp);
    const live = courseForPeriod(course, mp).average ?? null;
    return {
      mp,
      average: rec?.average ?? live,
      locked: !!rec?.locked,
    };
  });
}
