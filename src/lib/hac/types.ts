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

export type AssignmentCategory = "Summative" | "Formative" | "Other";

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

export interface Course {
  id: string;
  name: string;
  teacher: string | null;
  period: string | null;
  average: number | null;
  assignments: Assignment[];
  categoryAverages: { category: AssignmentCategory; weight: number | null; average: number | null }[];
}

export interface TranscriptCourse {
  year: string;
  grade: string;
  course: string;
  sem1: string | null;
  sem2: string | null;
  credits: string | null;
}

export interface HacData {
  student: { name: string; grade: string | null; school: string | null };
  courses: Course[];
  transcript: TranscriptCourse[];
  markingPeriodGPAs: { mp: string; gpa: number }[];
  syncedAt: string; // ISO
  districtId: DistrictId;
  username: string;
}