import type { HacData, Course, Assignment, AssignmentCategory, ReportCardTerm, AttendanceLedger } from "./types";

/** Build an assignment whose grade is expressed directly as a percent. */
function a(
  name: string,
  category: AssignmentCategory,
  dueDate: string, // MM/DD/YYYY
  percent: number,
  opts: { missing?: boolean; absent?: boolean } = {},
): Assignment {
  return {
    name,
    category,
    dueDate,
    score: percent,
    totalPoints: 100,
    percent,
    missing: opts.missing ?? false,
    absent: opts.absent ?? false,
  };
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Build a realistic 4-quarter + exam matrix anchored on the final S2 average. */
function rc(avg: number): ReportCardTerm {
  const mp1 = round2(Math.max(0, Math.min(100, avg - 4.5)));
  const mp2 = round2(Math.max(0, Math.min(100, avg - 2)));
  const mp3 = round2(Math.max(0, Math.min(100, avg - 1)));
  const mp4 = round2(Math.max(0, Math.min(100, avg)));
  const exam = round2(Math.max(0, Math.min(100, avg - 3)));
  const semester = round2(0.4 * mp3 + 0.4 * mp4 + 0.2 * exam);
  return { mp1, mp2, mp3, mp4, exam, semester };
}

const english2: Course = {
  id: "ela1200b-3",
  name: "English 2 Adv S2",
  code: "ELA1200B - 3",
  teacher: "Mr. Donovan",
  teacherEmail: "p.donovan@lonestarhs.edu",
  room: "B214",
  period: "3",
  average: 91.4,
  reportCard: rc(91.4),
  categoryAverages: [
    { category: "Assessment", weight: 70, average: 91.4 },
    { category: "Progress Check", weight: 30, average: 87.5 },
  ],
  assignments: [
    a("Animal Farm Reflective Assessment", "Assessment", "05/19/2026", 95.0),
    a("PBA 4: Socratic Seminar", "Assessment", "05/15/2026", 88.0),
    a("Rhetorical Analysis Essay", "Assessment", "05/11/2026", 86.0),
    a("Argument Leveled Questions", "Progress Check", "04/29/2026", 82.0),
    a("Seminar Prep 1", "Assessment", "04/20/2026", 94.0),
    a("Allegory Leveled Questions", "Assessment", "04/16/2026", 93.0),
    a("Theme & Symbolism Crest", "Progress Check", "04/14/2026", 90.0),
  ],
};

/** A lighter-weight course definition for the remaining classes. */
function simpleCourse(
  id: string,
  name: string,
  code: string,
  teacher: string,
  teacherEmail: string,
  room: string,
  period: string,
  average: number,
  assignments: Assignment[],
): Course {
  return {
    id,
    name,
    code,
    teacher,
    teacherEmail,
    room,
    period,
    average,
    reportCard: rc(average),
    categoryAverages: [
      { category: "Assessment", weight: 70, average },
      { category: "Progress Check", weight: 30, average: Math.max(70, average - 3) },
    ],
    assignments,
  };
}

const courses: Course[] = [
  english2,
  simpleCourse("mth1300b-1", "Geometry Adv S2", "MTH1300B - 1", "Mrs. Calderon", "m.calderon@lonestarhs.edu", "A108", "1", 93.15, [
    a("Circles Unit Test", "Assessment", "05/18/2026", 94.0),
    a("Right Triangles Quiz", "Progress Check", "05/06/2026", 90.0),
    a("Coordinate Proofs", "Assessment", "04/22/2026", 96.0),
    a("Surface Area HW", "Progress Check", "04/12/2026", 91.0),
  ]),
  simpleCourse("sci1300b-4", "Chemistry Adv S2", "SCI1300B - 4", "Dr. Okafor", "d.okafor@lonestarhs.edu", "S301", "4", 90.8, [
    a("Stoichiometry Unit Exam", "Assessment", "05/17/2026", 92.0),
    a("Titration Lab", "Progress Check", "05/03/2026", 88.0),
    a("Gas Laws FRQ", "Assessment", "04/21/2026", 91.0),
  ]),
  simpleCourse("sst1200b-6", "AP World History S2", "SST1200B - 6", "Mr. Halvorsen", "j.halvorsen@lonestarhs.edu", "C217", "6", 89.33, [
    a("Industrial Revolution DBQ", "Assessment", "05/13/2026", 90.0),
    a("Imperialism Quiz", "Progress Check", "04/30/2026", 86.0),
    a("World Wars Essay", "Assessment", "04/17/2026", 92.0),
  ]),
  simpleCourse("flg1200b-7", "Spanish 2 S2", "FLG1200B - 7", "Sra. Vega", "l.vega@lonestarhs.edu", "B120", "7", 96.0, [
    a("Preterite vs Imperfect Exam", "Assessment", "05/12/2026", 97.0),
    a("Vocabulary Unit 6", "Progress Check", "04/28/2026", 94.0),
    a("Oral Presentation", "Assessment", "04/15/2026", 97.0),
  ]),
  simpleCourse("tec2200b-5", "Computer Science 2 Adv S2", "TEC2200B - 5", "Ms. Park", "s.park@lonestarhs.edu", "T105", "5", 98.6, [
    a("Data Structures Project", "Assessment", "05/16/2026", 99.0),
    a("Sorting Algorithms Quiz", "Progress Check", "05/02/2026", 97.0),
    a("Inheritance PBA", "Assessment", "04/18/2026", 100.0),
  ]),
  simpleCourse("fna1100b-2", "Art 2 S2", "FNA1100B - 2", "Ms. Whitmore", "k.whitmore@lonestarhs.edu", "F102", "2", 99.0, [
    a("Portfolio Review", "Assessment", "05/14/2026", 100.0),
    a("Color Theory Study", "Progress Check", "05/01/2026", 98.0),
    a("Mixed Media Piece", "Assessment", "04/19/2026", 99.0),
  ]),
  simpleCourse("pelf1002b-8", "Lifetime Fitness Wellness S2", "PELF1002B - 8", "Coach Bryant", "r.bryant@lonestarhs.edu", "GYM", "8", 99.0, [
    a("Fitness Log Submission", "Assessment", "05/10/2026", 99.0),
    a("Nutrition Quiz", "Progress Check", "04/27/2026", 99.0),
  ]),
];

/** Rich multi-year attendance ledger for the demo profile. */
function mockAttendance(): AttendanceLedger {
  const log = [
    { date: "2026-05-08", code: "TLY" as const, course: "Geometry Adv S2", note: "Late bus" },
    { date: "2026-04-23", code: "EXC" as const, course: "Chemistry Adv S2", note: "Doctor's appointment" },
    { date: "2026-04-09", code: "TLY" as const, course: "English 2 Adv S2", note: "Tardy to 3rd period" },
    { date: "2026-03-19", code: "ABS" as const, course: "AP World History S2", note: "Excused absence" },
    { date: "2026-03-04", code: "UNX" as const, course: "Spanish 2 S2", note: "Unexcused" },
    { date: "2026-02-12", code: "EXC" as const, course: null, note: "Family emergency" },
    { date: "2026-01-27", code: "TLY" as const, course: "Art 2 S2", note: "Tardy" },
  ];
  const tardies = log.filter((l) => l.code === "TLY").length;
  const excusedAbsences = log.filter((l) => l.code === "EXC" || l.code === "ABS").length;
  const unexcusedAbsences = log.filter((l) => l.code === "UNX").length;
  return {
    log,
    tardies,
    excusedAbsences,
    unexcusedAbsences,
    totalAbsences: excusedAbsences + unexcusedAbsences,
  };
}

/** Demo activities mirroring the HAC Home/Calendar feed. */
function mockCalendar(): CalendarActivity[] {
  return [
    { date: "2026-05-25", title: "Memorial Day - No School", course: null, kind: "Holiday" },
    { date: "2026-05-14", title: "Chemistry Unit 7 Exam", course: "Chemistry Adv S2", kind: "Assessment" },
    { date: "2026-05-11", title: "AP World History DBQ", course: "AP World History S2", kind: "Assignment" },
    { date: "2026-05-06", title: "Geometry Quiz - Circles", course: "Geometry Adv S2", kind: "Assignment" },
    { date: "2026-04-30", title: "Spanish 2 Oral Presentation", course: "Spanish 2 S2", kind: "Assignment" },
    { date: "2026-04-17", title: "Early Release Day", course: null, kind: "Event" },
  ];
}


export function getFallbackData(): HacData {
  return {
    student: { name: "Demo Student", grade: "10", school: "Lone Star High School", studentId: "1048372" },
    courses,
    transcript: [
      // Freshman year (9th grade)
      { year: "2024-2025", grade: "9", course: "Algebra I Adv", sem1: "93", sem2: "94", credits: "1.0" },
      { year: "2024-2025", grade: "9", course: "English 1 Adv", sem1: "90", sem2: "92", credits: "1.0" },
      { year: "2024-2025", grade: "9", course: "Biology Adv", sem1: "95", sem2: "96", credits: "1.0" },
      { year: "2024-2025", grade: "9", course: "World Geography", sem1: "88", sem2: "91", credits: "1.0" },
      { year: "2024-2025", grade: "9", course: "Spanish 1", sem1: "97", sem2: "98", credits: "1.0" },
      { year: "2024-2025", grade: "9", course: "Computer Science 1 Adv", sem1: "99", sem2: "100", credits: "1.0" },
      { year: "2024-2025", grade: "9", course: "Art 1", sem1: "98", sem2: "99", credits: "0.5" },
      // Sophomore year (10th grade) — semester 1 posted, semester 2 in progress
      { year: "2025-2026", grade: "10", course: "Geometry Adv", sem1: "92", sem2: null, credits: "0.5" },
      { year: "2025-2026", grade: "10", course: "English 2 Adv", sem1: "89", sem2: null, credits: "0.5" },
      { year: "2025-2026", grade: "10", course: "Chemistry Adv", sem1: "90", sem2: null, credits: "0.5" },
      { year: "2025-2026", grade: "10", course: "AP World History", sem1: "88", sem2: null, credits: "0.5" },
      { year: "2025-2026", grade: "10", course: "Spanish 2", sem1: "95", sem2: null, credits: "0.5" },
      { year: "2025-2026", grade: "10", course: "Computer Science 2 Adv", sem1: "98", sem2: null, credits: "0.5" },
    ],
    markingPeriodGPAs: [
      { mp: "MP1", gpa: 4.18 },
      { mp: "MP2", gpa: 4.25 },
      { mp: "MP3", gpa: 4.31 },
      { mp: "MP4", gpa: 4.36 },
    ],
    attendance: mockAttendance(),
    calendar: mockCalendar(),
    syncedAt: new Date().toISOString(),
    districtId: "frisco",
    username: "demo",
  };
}
