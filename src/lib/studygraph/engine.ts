import {
  CONCEPTS,
  CONCEPT_BY_ID,
  conceptsForCourse,
  dependentsOf,
} from "./curriculum";
import type {
  AppState,
  Concept,
  ConceptStatus,
  MasteryRecord,
  Question,
  Recommendation,
} from "./types";

export const MASTERY_THRESHOLD = 0.8;
export const PREREQ_READY = 0.6;

export function emptyRecord(conceptId: string): MasteryRecord {
  return {
    conceptId,
    mastery: 0,
    confidence: 0,
    lastReviewed: null,
    reviewCount: 0,
    attempts: 0,
    correct: 0,
    avgResponseMs: 0,
    history: [],
  };
}

export function recordFor(state: AppState, conceptId: string): MasteryRecord {
  return state.mastery[conceptId] ?? emptyRecord(conceptId);
}

const DAY = 86_400_000;

export function daysSince(iso: string | null): number {
  if (!iso) return Infinity;
  return Math.max(0, (Date.now() - new Date(iso).getTime()) / DAY);
}

/**
 * Ebbinghaus-style retention. Stability grows with mastery and repetitions,
 * so well-drilled concepts decay far more slowly.
 */
export function retention(rec: MasteryRecord): number {
  if (rec.mastery <= 0) return 0;
  const d = daysSince(rec.lastReviewed);
  if (!isFinite(d)) return rec.mastery;
  const stability = 1.6 + 9 * rec.mastery + 1.8 * Math.min(rec.reviewCount, 8);
  return rec.mastery * Math.exp(-d / stability);
}

/** 0–1 risk that the concept has decayed below its recorded mastery. */
export function forgettingRisk(rec: MasteryRecord): number {
  if (rec.mastery <= 0) return 0;
  return clamp(1 - retention(rec) / Math.max(rec.mastery, 0.001));
}

export function prereqReadiness(state: AppState, concept: Concept): number {
  if (concept.prerequisites.length === 0) return 1;
  const vals = concept.prerequisites.map((p) => retention(recordFor(state, p)));
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export function weakPrereqs(state: AppState, concept: Concept) {
  return concept.prerequisites
    .map((id) => ({ id, r: retention(recordFor(state, id)) }))
    .filter((x) => x.r < PREREQ_READY)
    .sort((a, b) => a.r - b.r);
}

export function statusOf(state: AppState, concept: Concept): ConceptStatus {
  const rec = recordFor(state, concept.id);
  const ready = prereqReadiness(state, concept);
  if (rec.attempts === 0 && rec.mastery === 0) {
    return ready < PREREQ_READY ? "locked" : "unassessed";
  }
  const r = retention(rec);
  if (r >= MASTERY_THRESHOLD) return "mastered";
  if (r >= 0.6) return "strong";
  if (r >= 0.35) return "developing";
  return "weak";
}

export const STATUS_META: Record<ConceptStatus, { label: string; token: string }> = {
  mastered: { label: "Mastered", token: "var(--success)" },
  strong: { label: "Strong", token: "var(--primary)" },
  developing: { label: "Developing", token: "var(--warning)" },
  weak: { label: "Weak", token: "var(--destructive)" },
  locked: { label: "Locked", token: "var(--muted-foreground)" },
  unassessed: { label: "Not started", token: "var(--muted-foreground)" },
};

/** Bayesian-ish update: evidence weight falls as attempt count rises. */
export function updateMastery(
  rec: MasteryRecord,
  outcome: { correct: boolean; difficulty: number; responseMs: number; guessed: boolean },
): MasteryRecord {
  const base = retention(rec);
  const weight = 0.34 / (1 + rec.attempts * 0.12);
  const diffFactor = 0.6 + outcome.difficulty * 0.12; // harder items move mastery more
  const target = outcome.correct ? 1 : 0;
  const penalty = outcome.guessed ? 0.55 : 1;
  const next = clamp(base + (target - base) * weight * diffFactor * penalty);
  const attempts = rec.attempts + 1;
  const correct = rec.correct + (outcome.correct ? 1 : 0);
  const avg =
    rec.avgResponseMs === 0
      ? outcome.responseMs
      : Math.round((rec.avgResponseMs * rec.attempts + outcome.responseMs) / attempts);
  const accuracy = correct / attempts;
  const speedBonus = outcome.responseMs < 20_000 ? 0.08 : 0;
  const confidence = clamp(
    accuracy * 0.7 + Math.min(attempts / 12, 1) * 0.22 + speedBonus - (outcome.guessed ? 0.1 : 0),
  );
  const at = new Date().toISOString();
  return {
    ...rec,
    mastery: next,
    confidence,
    attempts,
    correct,
    avgResponseMs: avg,
    lastReviewed: at,
    reviewCount: rec.reviewCount + 1,
    history: [...rec.history, { at, mastery: next }].slice(-60),
  };
}

/** Mastery gained from studying (not testing) — smaller, capped effect. */
export function studyGain(rec: MasteryRecord, minutes: number): MasteryRecord {
  const base = retention(rec);
  const gain = Math.min(0.18, (minutes / 30) * 0.12);
  const at = new Date().toISOString();
  const next = clamp(base + gain * (1 - base));
  return {
    ...rec,
    mastery: next,
    lastReviewed: at,
    reviewCount: rec.reviewCount + 1,
    confidence: clamp(rec.confidence * 0.9 + 0.05),
    history: [...rec.history, { at, mastery: next }].slice(-60),
  };
}

/** How many downstream concepts a concept gates (transitively). */
export function unlockCount(conceptId: string): number {
  const seen = new Set<string>();
  const walk = (id: string) => {
    for (const d of dependentsOf(id)) {
      if (seen.has(d.id)) continue;
      seen.add(d.id);
      walk(d.id);
    }
  };
  walk(conceptId);
  return seen.size;
}

export function recommend(state: AppState, courseId: string, limit = 6): Recommendation[] {
  const pool = conceptsForCourse(courseId);
  const exam = examUrgency(state, courseId);
  const out: Recommendation[] = [];

  for (const concept of pool) {
    const rec = recordFor(state, concept.id);
    const r = retention(rec);
    if (r >= 0.95 && rec.attempts > 3) continue;

    const ready = prereqReadiness(state, concept);
    const gaps = weakPrereqs(state, concept);
    const unlocks = unlockCount(concept.id);
    const risk = forgettingRisk(rec);

    const gapSize = 1 - r;
    const impact = gapSize * (concept.importance / 5) * (1 + unlocks * 0.16);
    const readinessFactor = gaps.length ? 0.25 : 0.7 + ready * 0.3;
    const decayBoost = risk > 0.25 && rec.mastery > 0.4 ? risk * 0.9 : 0;
    const efficiency = 30 / (concept.estMinutes + 12);
    const examBoost = exam * (concept.importance / 5) * 0.35;

    const score =
      impact * readinessFactor * (0.75 + efficiency * 0.35) + decayBoost + examBoost;

    const reasons: string[] = [];
    if (gaps.length) {
      const names = gaps
        .slice(0, 2)
        .map((g) => CONCEPT_BY_ID.get(g.id)?.name ?? g.id)
        .join(" and ");
      reasons.push(`Blocked by weak prerequisites: ${names}`);
    }
    if (unlocks > 0) reasons.push(`Unlocks ${unlocks} downstream concept${unlocks > 1 ? "s" : ""}`);
    if (risk > 0.25 && rec.mastery > 0.4)
      reasons.push(`Retention has decayed ~${Math.round(risk * 100)}% since last review`);
    if (concept.importance >= 4) reasons.push("High exam weight");
    if (rec.attempts === 0) reasons.push("Never assessed — fastest way to shrink uncertainty");
    if (rec.attempts > 0 && rec.correct / rec.attempts < 0.6)
      reasons.push(`Accuracy is ${Math.round((rec.correct / rec.attempts) * 100)}% across ${rec.attempts} attempts`);

    const headline = gaps.length
      ? `Fix ${CONCEPT_BY_ID.get(gaps[0]!.id)?.name ?? "prerequisite"} first`
      : risk > 0.35 && rec.mastery > 0.4
        ? "Review before it slips"
        : rec.attempts === 0
          ? "Learn this next"
          : "Push this to mastery";

    out.push({
      conceptId: concept.id,
      score,
      minutes: Math.round(concept.estMinutes * (gaps.length ? 1.25 : 1 - r * 0.4)),
      reasons: reasons.slice(0, 3),
      headline,
      unlocks,
      impact,
    });
  }

  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function examUrgency(state: AppState, courseId: string) {
  const goal = state.goals.find((g) => g.courseId === courseId);
  const date = goal?.examDate;
  if (!date) return 0;
  const days = (new Date(date).getTime() - Date.now()) / DAY;
  if (days <= 0) return 0;
  return clamp(1 - days / 120);
}

/** Topological learning path to a target concept, skipping already-mastered nodes. */
export function pathTo(state: AppState, targetId: string): string[] {
  const order: string[] = [];
  const seen = new Set<string>();
  const visit = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    const concept = CONCEPT_BY_ID.get(id);
    if (!concept) return;
    for (const p of concept.prerequisites) visit(p);
    const r = retention(recordFor(state, id));
    if (r < MASTERY_THRESHOLD || id === targetId) order.push(id);
  };
  visit(targetId);
  return order;
}

export function courseMastery(state: AppState, courseId: string) {
  const pool = conceptsForCourse(courseId);
  if (!pool.length) return 0;
  const total = pool.reduce((sum, x) => sum + retention(recordFor(state, x.id)), 0);
  return total / pool.length;
}

export function statusBreakdown(state: AppState, courseId: string) {
  const pool = conceptsForCourse(courseId);
  const counts: Record<ConceptStatus, number> = {
    mastered: 0,
    strong: 0,
    developing: 0,
    weak: 0,
    locked: 0,
    unassessed: 0,
  };
  for (const concept of pool) counts[statusOf(state, concept)] += 1;
  return counts;
}

export function dueForReview(state: AppState, courseId: string) {
  return conceptsForCourse(courseId)
    .map((concept) => ({ concept, rec: recordFor(state, concept.id) }))
    .filter((x) => x.rec.mastery > 0.2 && forgettingRisk(x.rec) > 0.22)
    .sort((a, b) => forgettingRisk(b.rec) - forgettingRisk(a.rec));
}

export function bottlenecks(state: AppState, courseId: string) {
  return conceptsForCourse(courseId)
    .map((concept) => ({
      concept,
      blocked: dependentsOf(concept.id).filter(
        (d) => retention(recordFor(state, d.id)) < 0.5,
      ).length,
      mastery: retention(recordFor(state, concept.id)),
    }))
    .filter((x) => x.mastery < 0.7 && x.blocked > 0)
    .sort((a, b) => b.blocked * (1 - b.mastery) - a.blocked * (1 - a.mastery))
    .slice(0, 5);
}

/** Root-cause analysis for "why am I struggling with X". */
export function diagnose(state: AppState, conceptId: string) {
  const concept = CONCEPT_BY_ID.get(conceptId);
  if (!concept) return { causes: [], fix: [] as string[] };
  const gaps = weakPrereqs(state, concept);
  const rec = recordFor(state, conceptId);
  const causes: string[] = [];
  for (const g of gaps) {
    causes.push(
      `${CONCEPT_BY_ID.get(g.id)?.name} is only ${Math.round(g.r * 100)}% retained and this concept depends on it directly.`,
    );
  }
  const missed = state.mistakes.filter((m) => m.conceptId === conceptId && !m.resolved);
  const misconceptions = [...new Set(missed.map((m) => m.misconception))].slice(0, 3);
  for (const m of misconceptions) causes.push(`Recurring misconception: ${m}`);
  if (rec.attempts >= 3 && rec.correct / rec.attempts < 0.5)
    causes.push(`Accuracy of ${Math.round((rec.correct / rec.attempts) * 100)}% over ${rec.attempts} attempts suggests the core idea, not carelessness.`);
  if (rec.avgResponseMs > 60_000)
    causes.push("Response times are long, which usually means recall is reconstructive rather than automatic.");
  if (!causes.length) causes.push("No structural gap detected — this looks like normal early-stage practice.");

  const fix = gaps.length
    ? gaps.slice(0, 2).map((g) => `Spend ~15 min on ${CONCEPT_BY_ID.get(g.id)?.name} before returning here.`)
    : [`Do 5 targeted questions on ${concept.name}, then re-derive the worked example from memory.`];
  return { causes, fix };
}

/** Adaptive question selection: target ~70–80% success. */
export function nextQuestion(
  state: AppState,
  pool: Question[],
  conceptId: string,
): Question | null {
  if (!pool.length) return null;
  const rec = recordFor(state, conceptId);
  const r = retention(rec);
  const targetDifficulty = clampRange(1 + r * 4.2, 1, 5);
  const recent = new Set(
    state.attempts.slice(-14).filter((a) => a.conceptId === conceptId).map((a) => a.questionId),
  );
  const fresh = pool.filter((q) => !recent.has(q.id));
  const candidates = fresh.length ? fresh : pool;
  return candidates
    .slice()
    .sort(
      (a, b) =>
        Math.abs(a.difficulty - targetDifficulty) - Math.abs(b.difficulty - targetDifficulty),
    )[0]!;
}

export function gradeAnswer(question: Question, response: number[] | string): boolean {
  if (question.type === "numeric") {
    const value = Number(String(response).trim());
    if (!isFinite(value)) return false;
    const expected = Number(question.answer);
    return Math.abs(value - expected) <= (question.tolerance ?? 0.01);
  }
  if (question.type === "short-answer") {
    return String(response).trim().toLowerCase() === String(question.answer).trim().toLowerCase();
  }
  const chosen = (response as number[]).slice().sort().join(",");
  const answer = (question.answer as number[]).slice().sort().join(",");
  return chosen === answer;
}

/** Builds a study session plan that fits inside the available minutes. */
export function buildPlan(state: AppState, courseId: string, minutes: number) {
  const recs = recommend(state, courseId, 10);
  const due = dueForReview(state, courseId).slice(0, 4);
  const items: {
    conceptId: string | null;
    label: string;
    kind: "lesson" | "practice" | "review" | "flashcards" | "break";
    minutes: number;
  }[] = [];
  let left = minutes;

  for (const d of due) {
    if (left < 8) break;
    const m = Math.min(10, left);
    items.push({
      conceptId: d.concept.id,
      label: `Spaced review — ${d.concept.name}`,
      kind: "review",
      minutes: m,
    });
    left -= m;
  }

  for (const r of recs) {
    if (left < 10) break;
    const concept = CONCEPT_BY_ID.get(r.conceptId)!;
    const rec = recordFor(state, r.conceptId);
    const kind = rec.attempts === 0 ? "lesson" : "practice";
    const m = Math.min(Math.max(15, Math.round(r.minutes * 0.7)), left);
    items.push({
      conceptId: concept.id,
      label: `${kind === "lesson" ? "Learn" : "Practice"} — ${concept.name}`,
      kind,
      minutes: m,
    });
    left -= m;
    if (left > 12 && items.length % 3 === 0) {
      items.push({ conceptId: null, label: "Break", kind: "break", minutes: 5 });
      left -= 5;
    }
  }

  if (left >= 5) {
    items.push({
      conceptId: null,
      label: "Flashcard blitz — mixed retrieval",
      kind: "flashcards",
      minutes: left,
    });
  }
  return items;
}

export function timeToTarget(state: AppState, courseId: string, target: number) {
  const pool = conceptsForCourse(courseId);
  let minutes = 0;
  for (const concept of pool) {
    const r = retention(recordFor(state, concept.id));
    if (r >= target) continue;
    minutes += concept.estMinutes * (target - r) * 1.35;
  }
  return Math.round(minutes);
}

export function projectMastery(state: AppState, courseId: string, weeklyMinutes: number) {
  const current = courseMastery(state, courseId);
  const remaining = timeToTarget(state, courseId, 0.9);
  const weeks = weeklyMinutes > 0 ? remaining / weeklyMinutes : 0;
  const points: { week: number; mastery: number }[] = [];
  for (let w = 0; w <= 12; w++) {
    const progress = weeks > 0 ? Math.min(1, w / weeks) : 1;
    points.push({ week: w, mastery: current + (0.9 - current) * progress });
  }
  return { points, weeksToTarget: Math.ceil(weeks) };
}

export function conceptsBySubject(subjectId: string) {
  return CONCEPTS.filter((x) => x.subjectId === subjectId);
}

export function clamp(x: number) {
  return Math.max(0, Math.min(1, x));
}

function clampRange(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}

/** Deterministic force-free layout: layered by prerequisite depth. */
export function graphLayout(courseId: string) {
  const pool = conceptsForCourse(courseId);
  const depth = new Map<string, number>();
  const compute = (id: string, guard = 0): number => {
    if (depth.has(id)) return depth.get(id)!;
    if (guard > 20) return 0;
    const concept = CONCEPT_BY_ID.get(id);
    const d = !concept || concept.prerequisites.length === 0
      ? 0
      : 1 + Math.max(...concept.prerequisites.map((p) => compute(p, guard + 1)));
    depth.set(id, d);
    return d;
  };
  pool.forEach((concept) => compute(concept.id));

  const layers = new Map<number, Concept[]>();
  for (const concept of pool) {
    const d = depth.get(concept.id) ?? 0;
    layers.set(d, [...(layers.get(d) ?? []), concept]);
  }

  const nodes: { id: string; x: number; y: number; depth: number }[] = [];
  const xGap = 260;
  const yGap = 128;
  for (const [d, group] of [...layers.entries()].sort((a, b) => a[0] - b[0])) {
    group.forEach((concept, i) => {
      nodes.push({
        id: concept.id,
        x: 160 + d * xGap,
        y: 120 + (i - (group.length - 1) / 2) * yGap + 520,
        depth: d,
      });
    });
  }
  return nodes;
}
