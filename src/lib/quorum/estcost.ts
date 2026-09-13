/** Creator-set "bring this much money" estimate, shared by every surface. */
export type EstCost = { min: number | null; max: number | null };

export const EST_COST_PRESETS: { id: string; label: string; min: number; max: number }[] = [
  { id: "free", label: "Free", min: 0, max: 0 },
  { id: "10", label: "$10", min: 5, max: 10 },
  { id: "20", label: "$20", min: 15, max: 20 },
  { id: "30", label: "$30+", min: 30, max: 45 },
];

/**
 * "Est. $15–$20/person" — null when the host never set an estimate. No
 * embedded emoji: callers that want an icon (most do, for the cost concept)
 * pair this with lucide's DollarSign themselves instead of inheriting one.
 */
export function estCostLabel(min: number | null | undefined, max: number | null | undefined) {
  const lo = min ?? max;
  const hi = max ?? min;
  if (lo == null || hi == null) return null;
  if (lo === 0 && hi === 0) return "Free";
  if (lo === hi) return `Est. $${Math.round(hi)}/person`;
  return `Est. $${Math.round(lo)}–$${Math.round(hi)}/person`;
}

/** Matches an existing estimate back to a preset chip id. */
export function presetIdFor(min: number | null, max: number | null) {
  return (
    EST_COST_PRESETS.find((p) => p.min === (min ?? -1) && p.max === (max ?? -1))?.id ?? null
  );
}
