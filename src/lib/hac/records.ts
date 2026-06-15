import type {
  Course,
  HacData,
  ReportCardTerm,
  TranscriptCourse,
  AttendanceLedger,
  AttendanceEntry,
} from "./types";
import { courseForPeriod, type MarkingPeriod } from "./marking";

/** Safe placeholder for missing text values. */
export const SAFE = "--";

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Render any value as a non-empty string, falling back to a safe indicator. */
export function txt(v: string | number | null | undefined, fallback = SAFE): string {
  if (v === null || v === undefined) return fallback;
  const s = String(v).trim();
  return s === "" ? fallback : s;
}

/** Render a numeric grade, or "Not Posted" when it isn't available. */
export function gradeTxt(v: number | null | undefined, decimals = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "Not Posted";
  return v.toFixed(decimals);
}

/** Color ramp for a numeric grade. */
export function gradeColor(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "var(--muted-foreground)";
  if (v >= 90) return "var(--success)";
  if (v >= 80) return "var(--primary)";
  if (v >= 70) return "var(--warning)";
  return "var(--destructive)";
}

/* ----------------------- Report card ----------------------- */

/** Resolve a full 4-quarter + exam matrix for a course, deriving when absent. */
export function reportCardFor(course: Course): ReportCardTerm {
  if (course.reportCard) return course.reportCard;
  const avgOf = (p: MarkingPeriod) => courseForPeriod(course, p).average;
  const mp1 = avgOf("MP1");
  const mp2 = avgOf("MP2");
  const mp3 = avgOf("MP3");
  const mp4 = avgOf("MP4");
  const exam = course.average !== null ? round2(course.average) : null;
  const semester =
    mp3 !== null && mp4 !== null
      ? round2(0.4 * mp3 + 0.4 * mp4 + 0.2 * (exam ?? (mp3 + mp4) / 2))
      : null;
  return { mp1, mp2, mp3, mp4, exam, semester };
}

/** Pull a single marking-period grade off a report-card term. */
export function termGrade(term: ReportCardTerm, period: MarkingPeriod): number | null {
  switch (period) {
    case "MP1":
      return term.mp1;
    case "MP2":
      return term.mp2;
    case "MP3":
      return term.mp3;
    case "MP4":
      return term.mp4;
  }
}

/* ----------------------- Transcript ----------------------- */

export interface TranscriptYear {
  year: string;
  grade: string;
  building: string | null;
  courses: TranscriptCourse[];
  credits: number;
}

/** Group transcript rows into chronological year blocks with credit totals. */
export function transcriptByYear(transcript: TranscriptCourse[]): TranscriptYear[] {
  const map = new Map<string, TranscriptYear>();
  for (const row of transcript) {
    const key = `${row.year || "Unknown"}|${row.building || ""}`;
    let block = map.get(key);
    if (!block) {
      block = {
        year: row.year || "Unknown",
        grade: row.grade || SAFE,
        building: row.building || null,
        courses: [],
        credits: 0,
      };
      map.set(key, block);
    }
    block.courses.push(row);
    const c = parseFloat(row.credits ?? "");
    if (Number.isFinite(c)) block.credits += c;
  }
  return Array.from(map.values()).sort((a, b) => (a.year < b.year ? 1 : -1));
}

/** Total credits earned across the whole transcript. */
export function totalCredits(transcript: TranscriptCourse[]): number {
  return round2(
    transcript.reduce((sum, r) => {
      const c = parseFloat(r.credits ?? "");
      return sum + (Number.isFinite(c) ? c : 0);
    }, 0),
  );
}

/* ----------------------- Attendance ----------------------- */

/** Resolve an attendance ledger, deriving a minimal one from absent flags. */
export function attendanceFor(data: HacData): AttendanceLedger {
  if (data.attendance) return data.attendance;
  const log: AttendanceEntry[] = [];
  for (const c of data.courses) {
    for (const a of c.assignments) {
      if (a.absent && a.dueDate) {
        log.push({ date: a.dueDate, code: "ABS", course: c.name, note: a.name });
      }
    }
  }
  return {
    log,
    tardies: 0,
    excusedAbsences: log.length,
    unexcusedAbsences: 0,
    totalAbsences: log.length,
  };
}

/** Map attendance log to a YYYY-MM-DD → entries lookup. */
export function attendanceByDate(ledger: AttendanceLedger): Map<string, AttendanceEntry[]> {
  const map = new Map<string, AttendanceEntry[]>();
  for (const e of ledger.log) {
    const arr = map.get(e.date) ?? [];
    arr.push(e);
    map.set(e.date, arr);
  }
  return map;
}

const CODE_META: Record<string, { label: string; color: string }> = {
  ABS: { label: "Absent", color: "var(--destructive)" },
  UNX: { label: "Unexcused", color: "var(--destructive)" },
  EXC: { label: "Excused", color: "var(--warning)" },
  TLY: { label: "Tardy", color: "var(--chart-2)" },
};

export function attendanceMeta(code: string): { label: string; color: string } {
  return CODE_META[code] ?? { label: code, color: "var(--muted-foreground)" };
}
