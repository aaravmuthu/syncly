/**
 * Family Plus — the optional paid plan for parents. Teens never pay, and
 * everything a teen uses stays free. Shared by the server (enforcement) and
 * the client (prompts and the plan page), so limits live in one place.
 *
 * Billing isn't connected yet: starting Family Plus begins a founding-family
 * trial with no payment details.
 */

export const FAMILY_PLUS = {
  name: "Family Plus",
  monthly: 3.99,
  yearly: 38.99,
  foundingTrialMonths: 6,
} as const;

export type BillingInterval = "month" | "year";

export const FREE_LIMITS = {
  safeZonesPerTeen: 2,
  teensPerGuardian: 1,
  guardiansPerTeen: 1,
  historyHours: 48,
} as const;

export const PLUS_LIMITS = {
  safeZonesPerTeen: Infinity,
  teensPerGuardian: Infinity,
  guardiansPerTeen: Infinity,
  historyHours: 30 * 24,
} as const;

export type FamilyLimits = { [K in keyof typeof FREE_LIMITS]: number };

export type FamilyPlanStatus = "free" | "trialing" | "active" | "canceled";

/** What the client sees about the caller's own plan. */
export type MyFamilyPlan = {
  tier: "free" | "plus";
  status: FamilyPlanStatus;
  interval: BillingInterval | null;
  /** When Plus access ends (trial end, renewal date, or cancel date). */
  periodEnd: string | null;
  trialAvailable: boolean;
  /** Plus from this account or a co-guardian's; what limits actually apply. */
  familyTier: "free" | "plus";
};

export const limitsFor = (tier: "free" | "plus"): FamilyLimits =>
  tier === "plus" ? PLUS_LIMITS : FREE_LIMITS;

/** Yearly saving vs. paying monthly, as a whole percentage. */
export const yearlySavingPct = () =>
  Math.round((1 - FAMILY_PLUS.yearly / (FAMILY_PLUS.monthly * 12)) * 100);

/**
 * Message prefix for errors thrown when a free-plan limit blocks an action,
 * so the client can offer Family Plus instead of a generic failure toast.
 */
export const PLUS_REQUIRED = "Family Plus:";

export const isPlusRequiredError = (e: unknown) =>
  e instanceof Error && e.message.startsWith(PLUS_REQUIRED);

export const plusErrorText = (e: unknown) =>
  e instanceof Error ? e.message.replace(PLUS_REQUIRED, "").trim() : "";
