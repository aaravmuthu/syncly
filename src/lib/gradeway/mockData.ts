import type { Course, Semester } from "./types";

const today = new Date();
const daysAgo = (n: number) => new Date(today.getTime() - n * 86400000).toISOString();

const defaultCats = [
  { name: "Summative", weight: 0.6 },
  { name: "Formative", weight: 0.4 },
];

export const mockCourses: Course[] = [
  {
    id: "c1",
    name: "AP Calculus BC",
    teacher: "Dr. Patel",
    room: "204",
    period: 1,
    tier: "AP",
    credits: 1,
    categories: defaultCats,
    assignments: [
      { id: "a1", name: "Limits Quiz", category: "Formative", score: 19, outOf: 20, date: daysAgo(18) },
      { id: "a2", name: "Derivatives Test", category: "Summative", score: 92, outOf: 100, date: daysAgo(12) },
      { id: "a3", name: "Related Rates HW", category: "Formative", score: 10, outOf: 10, date: daysAgo(8) },
      { id: "a4", name: "Integration Project", category: "Summative", score: 98, outOf: 100, date: daysAgo(3) },
      { id: "a5", name: "Series Worksheet", category: "Formative", score: 0, outOf: 25, date: daysAgo(1), missing: true },
    ],
  },
  {
    id: "c2",
    name: "AP English Literature",
    teacher: "Ms. Ríos",
    room: "112",
    period: 2,
    tier: "AP",
    credits: 1,
    categories: defaultCats,
    assignments: [
      { id: "b1", name: "Hamlet Essay", category: "Summative", score: 88, outOf: 100, date: daysAgo(20) },
      { id: "b2", name: "Sonnet Analysis", category: "Formative", score: 18, outOf: 20, date: daysAgo(14) },
      { id: "b3", name: "Beloved Discussion", category: "Formative", score: 10, outOf: 10, date: daysAgo(7) },
      { id: "b4", name: "Midterm Essay", category: "Summative", score: 94, outOf: 100, date: daysAgo(2) },
    ],
  },
  {
    id: "c3",
    name: "Honors Physics",
    teacher: "Mr. Okafor",
    room: "Lab 3",
    period: 3,
    tier: "Honors",
    credits: 1,
    categories: [
      { name: "Summative", weight: 0.5 },
      { name: "Formative", weight: 0.3 },
      { name: "Labs", weight: 0.2 },
    ],
    assignments: [
      { id: "p1", name: "Kinematics Test", category: "Summative", score: 85, outOf: 100, date: daysAgo(22) },
      { id: "p2", name: "Newton Lab", category: "Labs", score: 47, outOf: 50, date: daysAgo(16) },
      { id: "p3", name: "Momentum Quiz", category: "Formative", score: 17, outOf: 20, date: daysAgo(9) },
      { id: "p4", name: "Energy Test", category: "Summative", score: 91, outOf: 100, date: daysAgo(4) },
    ],
  },
  {
    id: "c4",
    name: "AP US History",
    teacher: "Mr. Lindgren",
    room: "308",
    period: 4,
    tier: "AP",
    credits: 1,
    categories: defaultCats,
    assignments: [
      { id: "u1", name: "DBQ Essay", category: "Summative", score: 7, outOf: 10, date: daysAgo(19) },
      { id: "u2", name: "Reading Notes", category: "Formative", score: 24, outOf: 25, date: daysAgo(11) },
      { id: "u3", name: "Unit 4 Test", category: "Summative", score: 89, outOf: 100, date: daysAgo(5) },
      { id: "u4", name: "Primary Source", category: "Formative", score: 0, outOf: 15, date: daysAgo(2), missing: true },
    ],
  },
  {
    id: "c5",
    name: "Spanish IV",
    teacher: "Sra. Hernández",
    room: "120",
    period: 5,
    tier: "Regular",
    credits: 1,
    categories: defaultCats,
    assignments: [
      { id: "s1", name: "Vocab Quiz 7", category: "Formative", score: 20, outOf: 20, date: daysAgo(17) },
      { id: "s2", name: "Oral Exam", category: "Summative", score: 95, outOf: 100, date: daysAgo(10) },
      { id: "s3", name: "Composition", category: "Summative", score: 90, outOf: 100, date: daysAgo(4) },
    ],
  },
  {
    id: "c6",
    name: "Studio Art",
    teacher: "Ms. Choi",
    room: "Art 2",
    period: 6,
    tier: "Regular",
    credits: 0.5,
    categories: [
      { name: "Projects", weight: 0.8 },
      { name: "Sketchbook", weight: 0.2 },
    ],
    assignments: [
      { id: "art1", name: "Self-Portrait", category: "Projects", score: 96, outOf: 100, date: daysAgo(21) },
      { id: "art2", name: "Sketchbook Check", category: "Sketchbook", score: 19, outOf: 20, date: daysAgo(8) },
      { id: "art3", name: "Mixed Media", category: "Projects", score: 92, outOf: 100, date: daysAgo(3) },
    ],
  },
];

export const mockSemesters: Semester[] = [
  {
    id: "fr1",
    label: "Freshman Year — Semester 1",
    year: 9,
    term: 1,
    courses: [
      { id: "f1a", name: "Algebra I", tier: "Regular", credits: 0.5, finalGrade: 94 },
      { id: "f1b", name: "English 9 Honors", tier: "Honors", credits: 0.5, finalGrade: 91 },
      { id: "f1c", name: "Biology", tier: "Regular", credits: 0.5, finalGrade: 88 },
      { id: "f1d", name: "World Geography", tier: "Regular", credits: 0.5, finalGrade: 95 },
    ],
  },
  {
    id: "fr2",
    label: "Freshman Year — Semester 2",
    year: 9,
    term: 2,
    courses: [
      { id: "f2a", name: "Algebra I", tier: "Regular", credits: 0.5, finalGrade: 96 },
      { id: "f2b", name: "English 9 Honors", tier: "Honors", credits: 0.5, finalGrade: 93 },
      { id: "f2c", name: "Biology", tier: "Regular", credits: 0.5, finalGrade: 90 },
      { id: "f2d", name: "World Geography", tier: "Regular", credits: 0.5, finalGrade: 97 },
    ],
  },
  {
    id: "so1",
    label: "Sophomore Year — Semester 1",
    year: 10,
    term: 1,
    courses: [
      { id: "s1a", name: "Geometry Honors", tier: "Honors", credits: 0.5, finalGrade: 92 },
      { id: "s1b", name: "English 10 Honors", tier: "Honors", credits: 0.5, finalGrade: 90 },
      { id: "s1c", name: "Chemistry Honors", tier: "Honors", credits: 0.5, finalGrade: 89 },
      { id: "s1d", name: "AP Human Geo", tier: "AP", credits: 0.5, finalGrade: 94 },
    ],
  },
  {
    id: "so2",
    label: "Sophomore Year — Semester 2",
    year: 10,
    term: 2,
    courses: [
      { id: "s2a", name: "Geometry Honors", tier: "Honors", credits: 0.5, finalGrade: 95 },
      { id: "s2b", name: "English 10 Honors", tier: "Honors", credits: 0.5, finalGrade: 92 },
      { id: "s2c", name: "Chemistry Honors", tier: "Honors", credits: 0.5, finalGrade: 93 },
      { id: "s2d", name: "AP Human Geo", tier: "AP", credits: 0.5, finalGrade: 96 },
    ],
  },
  {
    id: "jr1",
    label: "Junior Year — Semester 1",
    year: 11,
    term: 1,
    courses: [
      { id: "j1a", name: "Pre-Calc Honors", tier: "Honors", credits: 0.5, finalGrade: 94 },
      { id: "j1b", name: "AP Lang", tier: "AP", credits: 0.5, finalGrade: 91 },
      { id: "j1c", name: "AP Bio", tier: "AP", credits: 0.5, finalGrade: 90 },
      { id: "j1d", name: "Spanish III", tier: "Regular", credits: 0.5, finalGrade: 97 },
    ],
  },
  {
    id: "jr2",
    label: "Junior Year — Semester 2",
    year: 11,
    term: 2,
    courses: [
      { id: "j2a", name: "Pre-Calc Honors", tier: "Honors", credits: 0.5, finalGrade: 96 },
      { id: "j2b", name: "AP Lang", tier: "AP", credits: 0.5, finalGrade: 93 },
      { id: "j2c", name: "AP Bio", tier: "AP", credits: 0.5, finalGrade: 92 },
      { id: "j2d", name: "Spanish III", tier: "Regular", credits: 0.5, finalGrade: 98 },
    ],
  },
];

export const mockTrend = [92.1, 93.4, 92.8, 94.0, 94.6, 95.1, 95.4];