import type { HacData, Course, Assignment, AssignmentCategory } from "./types";

function d(offsetDays: number): string {
  const now = new Date();
  const dt = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function a(
  name: string,
  category: AssignmentCategory,
  dueDate: string | null,
  score: number | null,
  totalPoints: number | null,
  opts: { missing?: boolean; absent?: boolean } = {},
): Assignment {
  const percent = score !== null && totalPoints ? Math.round((score / totalPoints) * 1000) / 10 : null;
  return {
    name,
    category,
    dueDate,
    score,
    totalPoints,
    percent,
    missing: opts.missing ?? false,
    absent: opts.absent ?? false,
  };
}

const courses: Course[] = [
  {
    id: "ap-calc-bc",
    name: "AP Calculus BC",
    teacher: "Ms. Whitfield",
    period: "1",
    average: 96.4,
    categoryAverages: [
      { category: "Summative", weight: 60, average: 95.0 },
      { category: "Formative", weight: 40, average: 98.5 },
    ],
    assignments: [
      a("Limits & Continuity Test", "Summative", d(-12), 94, 100),
      a("Derivative Rules Quiz", "Formative", d(-6), 20, 20),
      a("Related Rates Worksheet", "Formative", d(-2), 15, 15),
      a("Integration Unit Test", "Summative", d(3), null, 100),
      a("Series Convergence HW", "Formative", d(7), null, 20),
    ],
  },
  {
    id: "ap-physics",
    name: "AP Physics C: Mechanics",
    teacher: "Dr. Nguyen",
    period: "2",
    average: 88.1,
    categoryAverages: [
      { category: "Summative", weight: 70, average: 85.0 },
      { category: "Formative", weight: 30, average: 95.2 },
    ],
    assignments: [
      a("Kinematics Lab Report", "Formative", d(-10), 47, 50),
      a("Newton's Laws Test", "Summative", d(-4), 85, 100),
      a("Momentum Problem Set", "Formative", d(-1), null, 25, { missing: true }),
      a("Energy Conservation Test", "Summative", d(5), null, 100),
      a("Rotational Motion Quiz", "Formative", d(9), null, 20),
    ],
  },
  {
    id: "eng-lit",
    name: "AP English Literature",
    teacher: "Mr. Castillo",
    period: "3",
    average: 91.7,
    categoryAverages: [
      { category: "Summative", weight: 55, average: 90.0 },
      { category: "Formative", weight: 45, average: 93.8 },
    ],
    assignments: [
      a("Hamlet Essay", "Summative", d(-8), 88, 100),
      a("Poetry Analysis", "Formative", d(-3), 28, 30),
      a("Reading Journal #4", "Formative", d(1), null, 20),
      a("Timed Writing FRQ", "Summative", d(6), null, 100),
    ],
  },
  {
    id: "us-history",
    name: "AP US History",
    teacher: "Mrs. Alvarado",
    period: "5",
    average: 84.9,
    categoryAverages: [
      { category: "Summative", weight: 65, average: 82.0 },
      { category: "Formative", weight: 35, average: 90.0 },
    ],
    assignments: [
      a("Gilded Age DBQ", "Summative", d(-9), 78, 100),
      a("Progressive Era Quiz", "Formative", d(-5), 18, 20),
      a("WWI Discussion Post", "Formative", d(0), null, 15, { absent: true }),
      a("Unit 7 Exam", "Summative", d(4), null, 100),
      a("Cold War Reading", "Formative", d(8), null, 20),
    ],
  },
  {
    id: "spanish-4",
    name: "Spanish IV Pre-AP",
    teacher: "Señora Reyes",
    period: "6",
    average: 93.2,
    categoryAverages: [
      { category: "Summative", weight: 50, average: 92.0 },
      { category: "Formative", weight: 50, average: 94.5 },
    ],
    assignments: [
      a("Subjunctive Quiz", "Formative", d(-7), 19, 20),
      a("Oral Presentation", "Summative", d(-2), 92, 100),
      a("Vocab Unit 5", "Formative", d(2), null, 25),
      a("Cultural Essay", "Summative", d(10), null, 100),
    ],
  },
];

export function getFallbackData(): HacData {
  return {
    student: { name: "Demo Student", grade: "11", school: "Lone Star High School" },
    courses,
    transcript: [
      { year: "2023-2024", grade: "10", course: "AP World History", sem1: "94", sem2: "96", credits: "1.0" },
      { year: "2023-2024", grade: "10", course: "Pre-AP Chemistry", sem1: "91", sem2: "93", credits: "1.0" },
      { year: "2023-2024", grade: "10", course: "Pre-AP Precalculus", sem1: "97", sem2: "98", credits: "1.0" },
      { year: "2022-2023", grade: "9", course: "Biology", sem1: "95", sem2: "94", credits: "1.0" },
      { year: "2022-2023", grade: "9", course: "Algebra II", sem1: "96", sem2: "97", credits: "1.0" },
    ],
    markingPeriodGPAs: [
      { mp: "MP1", gpa: 4.6 },
      { mp: "MP2", gpa: 4.7 },
      { mp: "MP3", gpa: 4.65 },
    ],
    syncedAt: new Date().toISOString(),
    districtId: "frisco",
    username: "demo",
  };
}
