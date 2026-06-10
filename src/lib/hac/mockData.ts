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

const english1: Course = {
  id: "ela1100b-3",
  name: "English 1 Adv S2",
  code: "ELA1100B - 3",
  teacher: "Ms. Harkness",
  period: "3",
  average: 94.83,
  categoryAverages: [
    { category: "Assessment", weight: 70, average: 94.83 },
    { category: "Progress Check", weight: 30, average: 90.25 },
  ],
  assignments: [
    a("R&J Reflective Assessment", "Assessment", "05/19/2026", 100.0),
    a("PBA 4: Harkness Discussion", "Assessment", "05/15/2026", 90.0),
    a("R&J Leveled Questions", "Assessment", "05/11/2026", 90.0),
    a("Leveled Questions Act 4", "Progress Check", "04/29/2026", 85.0),
    a("Harkness 1", "Assessment", "04/20/2026", 100.0),
    a("Act 1-3 Leveled Questions", "Assessment", "04/16/2026", 99.0),
    a("Identity & Culture Crest", "Progress Check", "04/14/2026", 96.0),
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
  english1,
  simpleCourse("mth1200b-3", "Algebra 2 Adv S2", "MTH1200B - 3", "Mr. Euler", "1", 97.67, [
    a("Logarithms Unit Test", "Assessment", "05/18/2026", 98.0),
    a("Exponential Models Quiz", "Progress Check", "05/06/2026", 95.0),
    a("Polynomial Long Division", "Assessment", "04/22/2026", 100.0),
    a("Rational Functions HW", "Progress Check", "04/12/2026", 96.0),
  ]),
  simpleCourse("mth2300b-1", "dominos", "MTH2300B - 1", "Mr. Pizza", "2", 81.2, [
    a("Topping Optimization", "Assessment", "05/14/2026", 84.0),
    a("Delivery Routes Quiz", "Progress Check", "05/01/2026", 78.0),
    a("Crust Geometry Lab", "Assessment", "04/19/2026", 82.0),
  ]),
  simpleCourse("sci1200b-12", "Biology Adv S2", "SCI1200B - 12", "Dr. Mendel", "4", 97.6, [
    a("Genetics Unit Exam", "Assessment", "05/17/2026", 98.0),
    a("Cell Respiration Lab", "Progress Check", "05/03/2026", 96.0),
    a("Ecology FRQ", "Assessment", "04/21/2026", 99.0),
  ]),
  simpleCourse("tec2100b-1", "Computer Science 1 Adv S2", "TEC2100B - 1", "Ms. Lovelace", "5", 100.0, [
    a("Recursion Project", "Assessment", "05/16/2026", 100.0),
    a("Arrays & Loops Quiz", "Progress Check", "05/02/2026", 100.0),
    a("Object Oriented PBA", "Assessment", "04/18/2026", 100.0),
  ]),
  simpleCourse("sst1100b-9", "World Geography S2", "SST1100B - 9", "Mr. Mercator", "6", 98.67, [
    a("Climate Regions Test", "Assessment", "05/13/2026", 99.0),
    a("Population Maps Quiz", "Progress Check", "04/30/2026", 97.0),
    a("Cultural Geography Essay", "Assessment", "04/17/2026", 100.0),
  ]),
  simpleCourse("flg1100b-1", "French 1 S2", "FLG1100B - 1", "Mme Dubois", "7", 100.0, [
    a("Passé Composé Exam", "Assessment", "05/12/2026", 100.0),
    a("Vocabulary Unit 6", "Progress Check", "04/28/2026", 100.0),
    a("Oral Presentation", "Assessment", "04/15/2026", 100.0),
  ]),
  simpleCourse("pelf1001b-2", "Lifetime Fitness Wellness S2", "PELF1001B - 2", "Coach Reed", "8", 100.0, [
    a("Fitness Log Submission", "Assessment", "05/10/2026", 100.0),
    a("Nutrition Quiz", "Progress Check", "04/27/2026", 100.0),
  ]),
];

export function getFallbackData(): HacData {
  return {
    student: { name: "Demo Student", grade: "9", school: "Lone Star High School" },
    courses,
    transcript: [
      { year: "2024-2025", grade: "8", course: "Algebra I", sem1: "96", sem2: "97", credits: "1.0" },
      { year: "2024-2025", grade: "8", course: "English 8 Adv", sem1: "94", sem2: "95", credits: "1.0" },
      { year: "2024-2025", grade: "8", course: "Texas History", sem1: "98", sem2: "99", credits: "1.0" },
    ],
    markingPeriodGPAs: [
      { mp: "MP1", gpa: 4.55 },
      { mp: "MP2", gpa: 4.62 },
      { mp: "MP3", gpa: 4.7 },
      { mp: "MP4", gpa: 4.74 },
    ],
    syncedAt: new Date().toISOString(),
    districtId: "frisco",
    username: "demo",
  };
}
