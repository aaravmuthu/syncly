// Academic Tier Progression ("Aura Tiers") — maps a cumulative weighted GPA
// to a curated high-end rank. Pure logic + presentation tokens, no React.

export type TierId = "vanguard" | "lucid" | "zenith" | "radiant" | "apex";

export interface Tier {
  id: TierId;
  name: string;
  /** Inclusive lower bound of the tier on the weighted GPA scale. */
  min: number;
  /** Short accent color used for the ring stroke / glow. */
  accent: string;
  /** Card backdrop for emblem / detail surfaces. */
  background: string;
  /** Border treatment. */
  border: string;
  /** Box-shadow glow signature. */
  glow: string;
  /** One-line flavor description. */
  blurb: string;
}

export const TIERS: Tier[] = [
  {
    id: "vanguard",
    name: "Vanguard",
    min: 0,
    accent: "#94a3b8",
    background: "linear-gradient(135deg, #2b3038, #1c2026)",
    border: "1px solid rgba(148,163,184,0.28)",
    glow: "0 0 24px -10px rgba(148,163,184,0.5)",
    blurb: "Steady, deliberate, building momentum.",
  },
  {
    id: "lucid",
    name: "Lucid",
    min: 3.5,
    accent: "#8b5cf6",
    background: "linear-gradient(135deg, #0e1326, #161033)",
    border: "1px solid rgba(139,92,246,0.45)",
    glow: "0 0 30px -8px rgba(139,92,246,0.55)",
    blurb: "Obsidian glass, sharpening focus.",
  },
  {
    id: "zenith",
    name: "Zenith",
    min: 4.0,
    accent: "#22d3ee",
    background: "linear-gradient(135deg, #062c33, #0a3d44)",
    border: "1px solid rgba(34,211,238,0.5)",
    glow: "0 0 34px -6px rgba(34,211,238,0.6)",
    blurb: "Electric clarity at altitude.",
  },
  {
    id: "radiant",
    name: "Radiant",
    min: 4.5,
    accent: "#e6edf6",
    background: "linear-gradient(120deg, #cfd8e6, #ffffff, #d7e0ee)",
    border: "1px solid rgba(255,255,255,0.7)",
    glow: "0 0 40px -6px rgba(226,237,246,0.7)",
    blurb: "Platinum poise, diamond shimmer.",
  },
  {
    id: "apex",
    name: "Apex",
    min: 4.9,
    accent: "#c084fc",
    background:
      "conic-gradient(from 180deg at 50% 50%, #2a1055, #6d28d9, #c79a3a, #6d28d9, #2a1055)",
    border: "1px solid rgba(217,180,90,0.6)",
    glow: "0 0 48px -4px rgba(192,132,252,0.7)",
    blurb: "Cosmic violet & phantom gold kinetic energy.",
  },
];

/** Round to 2 decimals to avoid float fuzz on boundary comparisons. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function tierForGpa(gpa: number): Tier {
  const g = round2(gpa);
  let current = TIERS[0];
  for (const t of TIERS) {
    if (g >= t.min) current = t;
  }
  return current;
}

export function nextTier(tier: Tier): Tier | null {
  const idx = TIERS.findIndex((t) => t.id === tier.id);
  return idx >= 0 && idx < TIERS.length - 1 ? TIERS[idx + 1] : null;
}

export interface TierProgress {
  tier: Tier;
  next: Tier | null;
  /** 0..1 fill toward the next milestone. */
  fill: number;
  /** GPA points remaining to reach the next tier (>=0), or 0 at Apex. */
  toNext: number;
}

export function tierProgress(gpa: number): TierProgress {
  const g = round2(gpa);
  const tier = tierForGpa(g);
  const next = nextTier(tier);
  if (!next) {
    return { tier, next: null, fill: 1, toNext: 0 };
  }
  // Decimal-based fill (e.g. 4.77 -> 77% toward the next milestone), matching
  // the curated progression feel.
  const fill = Math.max(0, Math.min(1, g - Math.floor(g)));
  const toNext = round2(Math.max(0, next.min - g));
  return { tier, next, fill, toNext };
}
