/** Privacy-safe availability grid helpers. */

export const AVAILABILITY_SLOTS = [
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
  "22:00",
] as const;

export type AvailabilityCell = { slot: string; free: number; total: number };

export function prettySlot(slot: string) {
  const [h] = slot.split(":");
  const hh = Number(h);
  const ap = hh >= 12 ? "pm" : "am";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}${ap}`;
}

export function densityTone(cell: AvailabilityCell) {
  if (cell.total === 0) return 0;
  return cell.free / cell.total;
}

/** Best window: the longest run of slots where the most people are free. */
export function bestWindow(cells: AvailabilityCell[]) {
  if (!cells.length) return null;
  const peak = Math.max(...cells.map((c) => c.free));
  if (peak === 0) return null;
  let bestStart = -1;
  let bestLen = 0;
  let start = -1;
  cells.forEach((c, i) => {
    if (c.free === peak) {
      if (start === -1) start = i;
      const len = i - start + 1;
      if (len > bestLen) {
        bestLen = len;
        bestStart = start;
      }
    } else {
      start = -1;
    }
  });
  if (bestStart === -1) return null;
  const first = cells[bestStart]!;
  const last = cells[bestStart + bestLen - 1]!;
  return { from: first.slot, to: last.slot, free: peak, total: first.total };
}
