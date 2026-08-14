export type SubjectId =
  | "chemistry"
  | "mathematics"
  | "physics"
  | "biology"
  | "cs"
  | "english"
  | "history";

export interface Subject {
  id: SubjectId;
  name: string;
  tagline: string;
  glyph: string;
  courses: string[];
  available: boolean;
}

export interface Unit {
  id: string;
  name: string;
  order: number;
}

export type QuestionType =
  | "multiple-choice"
  | "multiple-select"
  | "numeric"
  | "true-false"
  | "short-answer";

export interface Question {
  id: string;
  conceptId: string;
  type: QuestionType;
  difficulty: 1 | 2 | 3 | 4 | 5;
  prompt: string;
  choices?: string[];
  /** indices into choices, or accepted strings/numbers */
  answer: number[] | string | number;
  tolerance?: number;
  explanation: string;
  misconception: string;
}

export interface Concept {
  id: string;
  name: string;
  subjectId: SubjectId;
  courseId: string;
  unitId: string;
  summary: string;
  /** 1 (approachable) – 5 (hard) */
  difficulty: 1 | 2 | 3 | 4 | 5;
  /** exam weight / importance 1–5 */
  importance: 1 | 2 | 3 | 4 | 5;
  estMinutes: number;
  prerequisites: string[];
  keyIdeas: string[];
  worked: { title: string; body: string };
  resources: { title: string; kind: "lesson" | "video" | "article" | "practice"; url?: string }[];
}

export interface Course {
  id: string;
  name: string;
  subjectId: SubjectId;
  examDate?: string;
  units: Unit[];
  custom?: boolean;
}

export interface MasteryRecord {
  conceptId: string;
  /** 0–1 estimated mastery */
  mastery: number;
  /** 0–1 self/model confidence */
  confidence: number;
  lastReviewed: string | null;
  reviewCount: number;
  attempts: number;
  correct: number;
  avgResponseMs: number;
  history: { at: string; mastery: number }[];
}

export interface Attempt {
  id: string;
  questionId: string;
  conceptId: string;
  correct: boolean;
  guessed: boolean;
  responseMs: number;
  at: string;
  chosen?: string;
}

export interface Mistake {
  id: string;
  questionId: string;
  conceptId: string;
  at: string;
  misconception: string;
  resolved: boolean;
}

export interface StudySession {
  id: string;
  conceptId: string;
  kind: "lesson" | "practice" | "review" | "flashcards";
  minutes: number;
  at: string;
  masteryBefore: number;
  masteryAfter: number;
}

export interface Note {
  id: string;
  conceptId: string | null;
  title: string;
  body: string;
  tags: string[];
  updatedAt: string;
}

export interface Flashcard {
  id: string;
  conceptId: string;
  front: string;
  back: string;
  /** spaced repetition */
  ease: number;
  intervalDays: number;
  dueAt: string;
  reviews: number;
  source: "ai" | "manual";
}

export interface PlanItem {
  id: string;
  conceptId: string | null;
  label: string;
  kind: "lesson" | "practice" | "review" | "flashcards" | "break";
  minutes: number;
  done: boolean;
}

export interface StudyPlan {
  id: string;
  date: string;
  minutes: number;
  items: PlanItem[];
}

export interface Goal {
  id: string;
  courseId: string;
  targetMastery: number;
  label: string;
  examDate?: string;
}

export interface Achievement {
  id: string;
  name: string;
  detail: string;
  unlockedAt: string | null;
}

export interface Profile {
  name: string;
  level: string;
  subjects: SubjectId[];
  courseId: string;
  goals: string;
  weeklyMinutes: number;
  style: "visual" | "practice" | "conceptual" | "mixed";
  targetMastery: number;
  onboarded: boolean;
  theme: "dark" | "light" | "system";
  notifications: {
    reviews: boolean;
    study: boolean;
    exams: boolean;
    milestones: boolean;
  };
}

export interface AppState {
  profile: Profile;
  mastery: Record<string, MasteryRecord>;
  attempts: Attempt[];
  mistakes: Mistake[];
  sessions: StudySession[];
  notes: Note[];
  flashcards: Flashcard[];
  plans: StudyPlan[];
  goals: Goal[];
  achievements: Achievement[];
  savedResources: string[];
  streak: { current: number; longest: number; lastDay: string | null };
}

export type ConceptStatus =
  | "mastered"
  | "strong"
  | "developing"
  | "weak"
  | "locked"
  | "unassessed";

export interface Recommendation {
  conceptId: string;
  score: number;
  minutes: number;
  reasons: string[];
  headline: string;
  unlocks: number;
  impact: number;
}
