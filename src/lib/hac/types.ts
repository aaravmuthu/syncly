export type DistrictId = "frisco" | "prosper";

export interface District {
  id: DistrictId;
  name: string;
  base: string;
}

export const DISTRICTS: District[] = [
  { id: "frisco", name: "Frisco ISD", base: "https://hac.friscoisd.org" },
  { id: "prosper", name: "Prosper ISD", base: "https://hac.prosperisd.org" },
];

export type AssignmentCategory =
  | "Summative"
  | "Formative"
  | "Assessment"
  | "Progress Check"
  | "Other";

export interface Assignment {
  name: string;
  category: AssignmentCategory;
  dueDate: string | null; // ISO YYYY-MM-DD
  score: number | null;
  totalPoints: number | null;
  percent: number | null;
  missing: boolean;
  absent: boolean;
}

/** Full 4-quarter + exam matrix used by the Report Card module. */
export interface ReportCardTerm {
  mp1: number | null;
  mp2: number | null;
  mp3: number | null;
  mp4: number | null;
  /** Semester final exam score. */
  exam: number | null;
  /** Calculated final semester grade. */
  semester: number | null;
}

export interface Course {
  id: string;
  name: string;
  code: string | null;
  teacher: string | null;
  period: string | null;
  average: number | null;
  assignments: Assignment[];
  categoryAverages: { category: AssignmentCategory; weight: number | null; average: number | null }[];
  /** Schedule engine: physical room location for this block. */
  room?: string | null;
  /** Schedule engine: teacher contact email. */
  teacherEmail?: string | null;
  /** Report card: explicit per-marking-period matrix (optional; derived if absent). */
  reportCard?: ReportCardTerm;
  /** Real per-marking-period classwork pulled directly from HAC (keyed "MP1".."MP4"). */
  periodData?: Record<string, { average: number | null; assignments: Assignment[]; categoryAverages: Course["categoryAverages"] }>;
}

export interface TranscriptCourse {
  year: string;
  grade: string;
  course: string;
  sem1: string | null;
  sem2: string | null;
  credits: string | null;
}

/** Attendance status codes mapped to specific calendar dates. */
export type AttendanceCode = "ABS" | "TLY" | "EXC" | "UNX";

export interface AttendanceEntry {
  date: string; // YYYY-MM-DD
  code: AttendanceCode;
  course?: string | null;
  note?: string | null;
}

export interface AttendanceLedger {
  totalAbsences: number;
  excusedAbsences: number;
  unexcusedAbsences: number;
  tardies: number;
  log: AttendanceEntry[];
}

/** An event pulled directly from the HAC Home/Calendar page. */
export interface CalendarActivity {
  date: string; // YYYY-MM-DD
  title: string;
  course: string | null;
  /** Raw category/type label from HAC, e.g. "Assignment", "Holiday". */
  kind: string | null;
}

/** Official GPA/rank figures pulled directly from the HAC transcript page. */
export interface OfficialGpa {
  weighted: number | null;
  unweighted: number | null;
  rank: number | null;
  classSize: number | null;
}

export interface HacData {
  student: { name: string; grade: string | null; school: string | null; studentId?: string | null };
  courses: Course[];
  transcript: TranscriptCourse[];
  markingPeriodGPAs: { mp: string; gpa: number }[];
  /** Official GPA + class rank straight from HAC's transcript page. */
  officialGpa?: OfficialGpa;
  /** Attendance ledger (optional; absent assignments are used as a fallback). */
  attendance?: AttendanceLedger;
  /** Activities pulled from the HAC Home/Calendar page. */
  calendar?: CalendarActivity[];
  syncedAt: string; // ISO
  districtId: DistrictId;
  username: string;
  /** Diagnostics from the last sync (per-marking-period scraping). */
  debug?: Record<string, unknown>;
}

/** Per-course visual customization (alias, emoji, color gradient). */
export interface CourseCustom {
  alias?: string;
  emoji?: string;
  /** Gradient preset id from GRADIENT_PRESETS, or null for the default. */
  gradient?: string | null;
}

/** A single period block within a bell-schedule day type. */
export interface BellPeriod {
  id: string;
  label: string;
  start: string; // "08:25"
  end: string; // "09:15"
  /** Optional classroom/room number for the Smart Room Locator. */
  room?: string;
}

/** A custom weekly bell schedule with rotating day types (e.g. A/B days). */
export interface BellRotation {
  enabled: boolean;
  /** Ordered list of day-type names, e.g. ["A Day", "B Day"]. */
  dayTypes: string[];
  /** Period blocks for each day type, keyed by day-type name. */
  periods: Record<string, BellPeriod[]>;
  /** Weekday (1=Mon … 5=Fri) → day-type name, or "" for none. */
  weekMap: Record<number, string>;
}

/** A homework / exam item the student manually adds to the calendar. */
export interface UserEvent {
  id: string;
  title: string;
  type: "homework" | "exam";
  course: string | null;
  date: string; // YYYY-MM-DD
  /** Minutes needed to finish the homework, or to study for the exam. */
  minutes: number;
  /** ISO datetime for the reminder, or null if no reminder. */
  reminderAt: string | null;
  /** Whether a reminder has already fired (so we don't re-notify). */
  reminded?: boolean;
}