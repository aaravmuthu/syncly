import { CONCEPTS, COURSES, QUESTIONS } from "./curriculum";
import type { AppState, Flashcard, MasteryRecord, Note, StudySession } from "./types";

function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY = 86_400_000;
const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * DAY).toISOString();

/** Seeded demo learner: partially through AP Chemistry with a real prerequisite gap. */
export function createDemoState(): AppState {
  const rand = mulberry(20260214);
  const mastery: Record<string, MasteryRecord> = {};
  const sessions: StudySession[] = [];

  // Hand-tuned so the graph tells a story: strong unit 1-4, cracks at
  // equilibrium, which blocks acids/bases and thermodynamics applications.
  const seeded: Record<string, number> = {
    moles: 0.94,
    "atomic-structure": 0.91,
    "electron-config": 0.86,
    "periodic-trends": 0.82,
    photoelectron: 0.58,
    "empirical-formula": 0.79,
    "bonding-types": 0.81,
    "lewis-vsepr": 0.72,
    hybridization: 0.63,
    imf: 0.66,
    "gas-laws": 0.74,
    solutions: 0.7,
    stoichiometry: 0.88,
    "reaction-types": 0.61,
    redox: 0.44,
    titration: 0.52,
    "rate-laws": 0.47,
    mechanisms: 0.21,
    arrhenius: 0.33,
    enthalpy: 0.68,
    "bond-energy": 0.55,
    entropy: 0.41,
    gibbs: 0.26,
    equilibrium: 0.38,
    "le-chatelier": 0.49,
    "solubility-equilibria": 0.12,
    "acid-base": 0.24,
    buffers: 0.08,
    "titration-curves": 0,
    electrochemistry: 0,
    "thermo-equilibrium-link": 0,
    "linear-equations": 0.95,
    exponents: 0.88,
    quadratics: 0.8,
    functions: 0.71,
    "exp-log": 0.52,
    "trig-ratios": 0.44,
    "trig-identities": 0.18,
    limits: 0.22,
    derivatives: 0.05,
  };

  for (const concept of CONCEPTS) {
    const m = seeded[concept.id] ?? 0;
    if (m <= 0) continue;
    const attempts = Math.max(2, Math.round(4 + m * 10 + rand() * 4));
    const correct = Math.round(attempts * Math.min(0.98, 0.35 + m * 0.6));
    const lastDays = Math.round(1 + (1 - m) * 22 + rand() * 6);
    const history = Array.from({ length: 6 }, (_, i) => ({
      at: iso(lastDays + (5 - i) * 5),
      mastery: Math.max(0.02, m - (5 - i) * 0.055 * (0.6 + rand() * 0.8)),
    }));
    history.push({ at: iso(lastDays), mastery: m });
    mastery[concept.id] = {
      conceptId: concept.id,
      mastery: m,
      confidence: Math.min(0.97, m * 0.85 + rand() * 0.1),
      lastReviewed: iso(lastDays),
      reviewCount: Math.max(1, Math.round(m * 9)),
      attempts,
      correct,
      avgResponseMs: Math.round(18_000 + (1 - m) * 46_000),
      history,
    };
    sessions.push({
      id: `s-${concept.id}`,
      conceptId: concept.id,
      kind: m > 0.7 ? "review" : "practice",
      minutes: Math.round(12 + rand() * 26),
      at: iso(lastDays),
      masteryBefore: Math.max(0, m - 0.09),
      masteryAfter: m,
    });
  }

  const mistakes = [
    { conceptId: "equilibrium", questionId: QUESTIONS.find((q) => q.conceptId === "equilibrium")?.id ?? "", days: 3 },
    { conceptId: "acid-base", questionId: QUESTIONS.find((q) => q.conceptId === "acid-base")?.id ?? "", days: 2 },
    { conceptId: "gibbs", questionId: QUESTIONS.find((q) => q.conceptId === "gibbs")?.id ?? "", days: 6 },
    { conceptId: "rate-laws", questionId: QUESTIONS.find((q) => q.conceptId === "rate-laws")?.id ?? "", days: 8 },
  ].map((m, i) => ({
    id: `mistake-${i}`,
    questionId: m.questionId,
    conceptId: m.conceptId,
    at: iso(m.days),
    misconception:
      QUESTIONS.find((q) => q.id === m.questionId)?.misconception ?? "Concept confusion",
    resolved: false,
  }));

  const notes: Note[] = [
    {
      id: "note-1",
      conceptId: "equilibrium",
      title: "ICE table checklist",
      body: "1) Write balanced equation. 2) Fill Initial. 3) Change in terms of x with coefficients. 4) Equilibrium row. 5) Substitute into K. Only omit pure solids and liquids.",
      tags: ["equilibrium", "method"],
      updatedAt: iso(3),
    },
    {
      id: "note-2",
      conceptId: "buffers",
      title: "Why my buffer answers keep missing",
      body: "I keep inverting the ratio in Henderson–Hasselbalch. It is log(base/acid) — conjugate base on top.",
      tags: ["buffers", "misconception"],
      updatedAt: iso(2),
    },
  ];

  const flashcards: Flashcard[] = [
    fc("moles", "1 mol = ? particles", "6.022 × 10²³", 1),
    fc("gibbs", "ΔG° in terms of K", "ΔG° = −RT ln K", 0),
    fc("buffers", "Henderson–Hasselbalch", "pH = pKa + log([A⁻]/[HA])", 0),
    fc("equilibrium", "Q > K means", "Reaction shifts left toward reactants", 0),
    fc("imf", "Strongest IMF present in CH₃OH", "Hydrogen bonding", 2),
    fc("rate-laws", "First-order linear plot", "ln[A] vs t", 1),
  ];

  return {
    profile: {
      name: "Avery Chen",
      level: "High school — AP",
      subjects: ["chemistry", "mathematics"],
      courseId: "ap-chemistry",
      goals: "Score a 5 on the AP Chemistry exam",
      weeklyMinutes: 300,
      style: "mixed",
      targetMastery: 0.9,
      onboarded: false,
      theme: "dark",
      notifications: { reviews: true, study: true, exams: true, milestones: true },
    },
    mastery,
    attempts: [],
    mistakes,
    sessions,
    notes,
    flashcards,
    plans: [],
    goals: COURSES.map((c) => ({
      id: `goal-${c.id}`,
      courseId: c.id,
      targetMastery: 0.9,
      label: `Reach 90% mastery in ${c.name}`,
      examDate: c.examDate,
    })),
    achievements: [
      { id: "first-session", name: "First light", detail: "Completed your first study session", unlockedAt: iso(28) },
      { id: "unit-1", name: "Atomic", detail: "Mastered every Unit 1 concept", unlockedAt: iso(14) },
      { id: "streak-7", name: "Seven strong", detail: "7 day study streak", unlockedAt: iso(4) },
      { id: "graph-half", name: "Half mapped", detail: "50% of the graph above developing", unlockedAt: null },
      { id: "no-gaps", name: "Gapless", detail: "No weak prerequisites anywhere", unlockedAt: null },
    ],
    savedResources: [],
    streak: { current: 9, longest: 14, lastDay: new Date().toISOString().slice(0, 10) },
  };
}

function fc(conceptId: string, front: string, back: string, dueInDays: number): Flashcard {
  return {
    id: `fc-${conceptId}-${front.length}`,
    conceptId,
    front,
    back,
    ease: 2.5,
    intervalDays: Math.max(1, dueInDays),
    dueAt: iso(-dueInDays),
    reviews: 2,
    source: "ai",
  };
}

export function emptyState(): AppState {
  return {
    profile: {
      name: "",
      level: "High school",
      subjects: ["chemistry"],
      courseId: "ap-chemistry",
      goals: "",
      weeklyMinutes: 240,
      style: "mixed",
      targetMastery: 0.85,
      onboarded: false,
      theme: "dark",
      notifications: { reviews: true, study: true, exams: true, milestones: true },
    },
    mastery: {},
    attempts: [],
    mistakes: [],
    sessions: [],
    notes: [],
    flashcards: [],
    plans: [],
    goals: [],
    achievements: [],
    savedResources: [],
    streak: { current: 0, longest: 0, lastDay: null },
  };
}
