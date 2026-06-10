import type { HacData, Course, Assignment, AssignmentCategory } from "./types";

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

const english2: Course = {
  id: "ela1200b-3",
  name: "English 2 Adv S2",
  code: "ELA1200B - 3",
  teacher: "Mr. Donovan",
  period: "3",
  average: 91.40,
  categoryAverages: [
    { category: "Assessment", weight: 70, average: 91.40 },
    { category: "Progress Check", weight: 30, average: 87.50 },
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
  period: string,
  average: number,
  assignments: Assignment[],
): Course {
  return {
    id,
    name,
    code,
    teacher,
    period,
    average,
    categoryAverages: [
      { category: "Assessment", weight: 70, average },
      { category: "Progress Check", weight: 30, average: Math.max(70, average - 3) },
    ],
    assignments,
  };
}

const courses: Course[] = [
  english2,
  simpleCourse("mth1300b-1", "Geometry Adv S2", "MTH1300B - 1", "Mrs. Calderon", "1", 93.15, [
    a("Circles Unit Test", "Assessment", "05/18/2026", 94.0),
    a("Right Triangles Quiz", "Progress Check", "05/06/2026", 90.0),
    a("Coordinate Proofs", "Assessment", "04/22/2026", 96.0),
    a("Surface Area HW", "Progress Check", "04/12/2026", 91.0),
  ]),
  simpleCourse("sci1300b-4", "Chemistry Adv S2", "SCI1300B - 4", "Dr. Okafor", "4", 90.80, [
    a("Stoichiometry Unit Exam", "Assessment", "05/17/2026", 92.0),
    a("Titration Lab", "Progress Check", "05/03/2026", 88.0),
    a("Gas Laws FRQ", "Assessment", "04/21/2026", 91.0),
  ]),
  simpleCourse("sst1200b-6", "AP World History S2", "SST1200B - 6", "Mr. Halvorsen", "6", 89.33, [
    a("Industrial Revolution DBQ", "Assessment", "05/13/2026", 90.0),
    a("Imperialism Quiz", "Progress Check", "04/30/2026", 86.0),
    a("World Wars Essay", "Assessment", "04/17/2026", 92.0),
  ]),
  simpleCourse("flg1200b-7", "Spanish 2 S2", "FLG1200B - 7", "Sra. Vega", "7", 96.00, [
    a("Preterite vs Imperfect Exam", "Assessment", "05/12/2026", 97.0),
    a("Vocabulary Unit 6", "Progress Check", "04/28/2026", 94.0),
    a("Oral Presentation", "Assessment", "04/15/2026", 97.0),
  ]),
  simpleCourse("tec2200b-5", "Computer Science 2 Adv S2", "TEC2200B - 5", "Ms. Park", "5", 98.60, [
    a("Data Structures Project", "Assessment", "05/16/2026", 99.0),
    a("Sorting Algorithms Quiz", "Progress Check", "05/02/2026", 97.0),
    a("Inheritance PBA", "Assessment", "04/18/2026", 100.0),
  ]),
  simpleCourse("fna1100b-2", "Art 2 S2", "FNA1100B - 2", "Ms. Whitmore", "2", 99.00, [
    a("Portfolio Review", "Assessment", "05/14/2026", 100.0),
    a("Color Theory Study", "Progress Check", "05/01/2026", 98.0),
    a("Mixed Media Piece", "Assessment", "04/19/2026", 99.0),
  ]),
  simpleCourse("pelf1002b-8", "Lifetime Fitness Wellness S2", "PELF1002B - 8", "Coach Bryant", "8", 99.00, [
    a("Fitness Log Submission", "Assessment", "05/10/2026", 99.0),
    a("Nutrition Quiz", "Progress Check", "04/27/2026", 99.0),
  ]),
];

export function getFallbackData(): HacData {
  return {
    student: { name: "Demo Student", grade: "10", school: "Lone Star High School" },
    courses,
    transcript: [
      { year: "2024-2025", grade: "9", course: "Algebra I", sem1: "93", sem2: "94", credits: "1.0" },
      { year: "2024-2025", grade: "9", course: "English 9 Adv", sem1: "90", sem2: "92", credits: "1.0" },
      { year: "2024-2025", grade: "9", course: "Biology", sem1: "95", sem2: "96", credits: "1.0" },
    ],
    markingPeriodGPAs: [
      { mp: "MP1", gpa: 4.18 },
      { mp: "MP2", gpa: 4.25 },
      { mp: "MP3", gpa: 4.31 },
      { mp: "MP4", gpa: 4.36 },
    ],
    syncedAt: new Date().toISOString(),
    districtId: "frisco",
    username: "demo",
  };
}
