export type PillTone = "neutral" | "good" | "warn" | "bad" | "accent";

/**
 * Canonical plan/vote status -> semantic tone. Single source of truth so
 * Home, Groups, and Plans don't each invent their own emerald/amber/indigo
 * mapping for the same underlying states.
 */
export function statusTone(status: string): PillTone {
  switch (status) {
    case "voting":
    case "collecting":
    case "recommending":
      return "accent";
    case "finalized":
    case "completed":
      return "good";
    case "cancelled":
      return "bad";
    default:
      return "neutral";
  }
}

export const STATUS_TONE_CLASSES: Record<PillTone, string> = {
  accent: "bg-primary/12 text-primary ring-primary/25",
  good: "bg-success/14 text-success ring-success/25",
  warn: "bg-warning/16 text-warning ring-warning/25",
  bad: "bg-destructive/12 text-destructive ring-destructive/25",
  neutral: "bg-foreground/8 text-muted-foreground ring-foreground/12",
};

/** Ring/bg/text classes for statusTone(), for callers using the ring-pill look directly instead of the `Pill` component. */
export function statusToneClasses(status: string): string {
  return STATUS_TONE_CLASSES[statusTone(status)];
}
