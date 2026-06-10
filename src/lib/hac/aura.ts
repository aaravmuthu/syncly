// Aura Points (AP) Gamified Progression Engine.
// Pure calculation utilities: converts gradebook entries into AP gains, builds
// the chronological "Aura Ledger", and maps cumulative AP onto rank tiers.

import type { Assignment, Course } from "./types";
import { TIERS, type Tier, type TierId } from "./tiers";

export interface AuraGain {
  /** Total AP earned for this assignment (after multipliers + bonuses). */
  points: number;
  /** Performance label, e.g. "Flawless Execution". */
  label: string;
  /** Whether a 2x Major/Test multiplier was applied. */
  multiplied: boolean;
  /** Whether the +15 advanced-track rigor bonus was applied. */
  rigorBonus: boolean;
}

/** True when the assignment counts as a Major/Test category (2x multiplier). */
export function isMajorCategory(course: Course, a: Assignment): boolean {
  const hay = `${a.category ?? ""} ${a.name ?? ""}`.toLowerCase();
  return /(major|test|exam|summative|assessment)/.test(hay);
}

/** True when the course is an advanced track ("Adv" or "AP") → +15 rigor bonus. */
export function isAdvancedTrack(course: Course): boolean {
  const hay = `${course.name ?? ""} ${course.code ?? ""}`;
  return /\bAdv\b/i.test(hay) || /\bAP\b/.test(hay) || /advanced/i.test(hay);
}

/**
 * Compute the AP gain for a single graded assignment using the high-fidelity
 * guidelines:
 *   98–100% → +100 ("Flawless Execution")
 *   90–97%  → +50  ("Mastery Confirmed")
 *   80–89%  → +25  ("Secure Position")
 *   <80%    → 0
 * Major/Test category doubles the base; advanced track adds a flat +15.
 */
export function auraForAssignment(course: Course, a: Assignment): AuraGain | null {
  const v = a.percent;
  if (v === null || v === undefined || Number.isNaN(v)) return null;
  if (v < 80) return null;

  let base = 0;
  let label = "";
  if (v >= 98) {
    base = 100;
    label = "Flawless Execution";
  } else if (v >= 90) {
    base = 50;
    label = "Mastery Confirmed";
  } else {
    base = 25;
    label = "Secure Position";
  }

  const multiplied = isMajorCategory(course, a);
  const rigorBonus = isAdvancedTrack(course);
  let points = base * (multiplied ? 2 : 1);
  if (rigorBonus) points += 15;

  return { points, label, multiplied, rigorBonus };
}

export interface LedgerEntry {
  key: string;
  course: Course;
  assignment: Assignment;
  /** Sortable timestamp from the due date (or 0 when absent). */
  ts: number;
  /** Assignment percentage. */
  percent: number;
  gain: AuraGain;
}

function parseDate(s: string | null): number {
  if (!s) return 0;
  const [m, d, y] = s.split("/").map(Number);
  if (!y) return 0;
  return new Date(y, (m ?? 1) - 1, d ?? 1).getTime();
}

/** Build the full chronological ledger of AP-earning assignments. */
export function buildAuraLedger(courses: Course[]): LedgerEntry[] {
  const entries: LedgerEntry[] = [];
  for (const course of courses) {
    for (const a of course.assignments) {
      const gain = auraForAssignment(course, a);
      if (!gain) continue;
      entries.push({
        key: `${course.id}-${a.name}-${a.dueDate ?? ""}`,
        course,
        assignment: a,
        ts: parseDate(a.dueDate),
        percent: a.percent as number,
        gain,
      });
    }
  }
  entries.sort((x, y) => y.ts - x.ts);
  return entries;
}

/** Cumulative global AP across all courses. */
export function totalAura(courses: Course[]): number {
  return buildAuraLedger(courses).reduce((s, e) => s + e.gain.points, 0);
}

// ---------------------------------------------------------------------------
// AP → Rank Tier progression
// ---------------------------------------------------------------------------

/** Inclusive lower AP bound per rank tier. */
export const AURA_TIER_THRESHOLDS: Record<TierId, number> = {
  vanguard: 0,
  lucid: 1500,
  zenith: 4000,
  radiant: 8000,
  apex: 13000,
};

export interface AuraTierProgress {
  tier: Tier;
  next: Tier | null;
  /** 0..1 fill toward the next milestone within the tier. */
  fill: number;
  /** AP remaining to reach the next tier (0 at Apex). */
  toNext: number;
  /** Cumulative AP. */
  total: number;
}

export function auraTierForPoints(ap: number): Tier {
  let current = TIERS[0];
  for (const t of TIERS) {
    if (ap >= AURA_TIER_THRESHOLDS[t.id]) current = t;
  }
  return current;
}

export function auraTierProgress(ap: number): AuraTierProgress {
  const tier = auraTierForPoints(ap);
  const idx = TIERS.findIndex((t) => t.id === tier.id);
  const next = idx >= 0 && idx < TIERS.length - 1 ? TIERS[idx + 1] : null;
  if (!next) {
    return { tier, next: null, fill: 1, toNext: 0, total: ap };
  }
  const lo = AURA_TIER_THRESHOLDS[tier.id];
  const hi = AURA_TIER_THRESHOLDS[next.id];
  const fill = Math.max(0, Math.min(1, (ap - lo) / Math.max(1, hi - lo)));
  return { tier, next, fill, toNext: Math.max(0, hi - ap), total: ap };
}
