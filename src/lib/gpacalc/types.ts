export type TierId = "ap" | "honors" | "dual" | "regular";

export const TIER_LABELS: Record<TierId, string> = {
  ap: "AP / IB",
  honors: "Honors / Pre-AP",
  dual: "Dual Credit",
  regular: "On-Level",
};

export const TIER_ORDER: TierId[] = ["ap", "dual", "honors", "regular"];

export interface GpaCourse {
  id: string;
  name: string;
  /** School year label, e.g. "2024-2025". */
  year: string;
  /** 9 | 10 | 11 | 12, or null when unknown. */
  gradeLevel: number | null;
  tier: TierId;
  /** Raw grade strings as entered: numeric ("94") or letter ("A-"). */
  sem1: string;
  sem2: string;
  final: string;
  /** Total attempted credits for the course (1.0 = full year). */
  credits: number;
  /** Pass/fail, PE, or otherwise excluded from GPA. */
  exempt: boolean;
}

export type ScaleId =
  | "unweighted4"
  | "weighted5"
  | "tiered6banded"
  | "tiered6continuous"
  | "raw100"
  | "custom"
  /** @deprecated legacy alias for the continuous Texas 6.0 scale. */
  | "tiered6";

export type ConversionMode = "discrete" | "continuous";

export interface CustomScale {
  mode: ConversionMode;
  /** Discrete mode: points added on top of the 4.0 base for an A/B/C. */
  boosts: Record<TierId, number>;
  /** Continuous mode: points awarded for a 100 in that tier (70 = value - 3). */
  tops: Record<TierId, number>;
}

export interface GpaSettings {
  scale: ScaleId;
  custom: CustomScale;
  /** Show results as GPA points vs. raw 100-point credit-weighted average. */
  display: "points" | "percent";
  /** Year treated as "current"; empty = latest year found. */
  activeYear: string;
}

export const DEFAULT_CUSTOM: CustomScale = {
  mode: "discrete",
  boosts: { ap: 1, dual: 1, honors: 0.5, regular: 0 },
  tops: { ap: 6, dual: 6, honors: 5.5, regular: 5 },
};

export const DEFAULT_SETTINGS: GpaSettings = {
  scale: "tiered6continuous",
  custom: DEFAULT_CUSTOM,
  display: "points",
  activeYear: "",
};
