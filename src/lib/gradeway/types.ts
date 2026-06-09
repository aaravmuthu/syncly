export type Tier = "Regular" | "Honors" | "AP";

export interface Assignment {
  id: string;
  name: string;
  category: string; // e.g. "Summative" | "Formative"
  score: number; // earned points
  outOf: number; // possible points
  date: string; // ISO
  missing?: boolean;
}

export interface CategoryWeight {
  name: string;
  weight: number; // 0..1
}

export interface Course {
  id: string;
  name: string;
  teacher: string;
  room: string;
  period: number;
  tier: Tier;
  credits: number; // 0.5 or 1.0
  categories: CategoryWeight[];
  assignments: Assignment[];
}

export interface PastCourse {
  id: string;
  name: string;
  tier: Tier;
  credits: number;
  finalGrade: number; // numeric 0-100
}

export interface Semester {
  id: string;
  label: string; // "Freshman Year — Sem 1"
  year: number;
  term: 1 | 2;
  courses: PastCourse[];
}