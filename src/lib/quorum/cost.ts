/**
 * Expense estimator. Everything here is derived from group-visible venue data
 * only — no member's private budget ever enters this calculation.
 */

export type CostEstimate = {
  entryMin: number;
  entryMax: number;
  foodMin: number;
  foodMax: number;
  travel: number;
  perPersonMin: number;
  perPersonMax: number;
  groupMin: number;
  groupMax: number;
  lines: { label: string; value: string }[];
};

const GAS_PER_MILE = 0.18; // fuel + wear, split across a car
const MPH = 28;

export function estimateCost(input: {
  costMin: number;
  costMax: number;
  travelMinutes: number;
  distanceMiles?: number | null;
  category: string;
  headcount: number;
  carCount?: number;
  /** False for options nobody needs to drive to (e.g. walkable venues) — no
   *  car cost line should ever appear for those. Defaults true so existing
   *  callers keep their current behavior until they pass this through. */
  requiresDriving?: boolean;
}): CostEstimate {
  const heads = Math.max(1, input.headcount);
  const cars = Math.max(1, input.carCount ?? Math.ceil(heads / 4));
  const miles =
    input.distanceMiles != null ? input.distanceMiles : (input.travelMinutes / 60) * MPH;
  const requiresDriving = input.requiresDriving ?? true;

  const isFood = ["dinner", "party", "hangout"].includes(input.category);
  // Venue cost is a per-person ticket/entry unless the category is food-led,
  // in which case the range already represents the meal.
  const entryMin = isFood ? 0 : Math.round(input.costMin);
  const entryMax = isFood ? 0 : Math.round(input.costMax);
  const foodMin = isFood ? Math.round(input.costMin) : Math.round(input.costMin * 0.35);
  const foodMax = isFood ? Math.round(input.costMax) : Math.round(input.costMax * 0.5);
  const travel = requiresDriving
    ? Math.round(((miles * 2 * GAS_PER_MILE * cars) / heads) * 100) / 100
    : 0;

  const perPersonMin = Math.round(entryMin + foodMin + travel);
  const perPersonMax = Math.round(entryMax + foodMax + travel);

  const money = (n: number) => `$${n.toFixed(n % 1 === 0 ? 0 : 2)}`;
  const range = (a: number, b: number) => (a === b ? money(a) : `${money(a)}–${money(b)}`);

  return {
    entryMin,
    entryMax,
    foodMin,
    foodMax,
    travel,
    perPersonMin,
    perPersonMax,
    groupMin: perPersonMin * heads,
    groupMax: perPersonMax * heads,
    lines: [
      ...(entryMax > 0 ? [{ label: "Entry / tickets", value: range(entryMin, entryMax) }] : []),
      { label: isFood ? "Food & drinks" : "Snacks & extras", value: range(foodMin, foodMax) },
      ...(requiresDriving
        ? [
            {
              label: `Travel (${cars} ${cars === 1 ? "car" : "cars"}, split)`,
              value: money(travel),
            },
          ]
        : []),
    ],
  };
}

export function formatRange(min: number, max: number) {
  return min === max ? `$${min}` : `$${min}–$${max}`;
}
