// Pure helpers for the "works for everyone" hard filter: operating hours and
// fairness scoring. No IO — safe to import from client or server code.

const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(":");
  return Number(h) * 60 + Number(m ?? 0);
};

/** Fallback open window when a venue publishes no hours. */
const DEFAULT_HOURS: Record<string, [string, string]> = {
  dinner: ["10:30", "22:30"],
  hangout: ["09:00", "22:00"],
  movie: ["11:00", "23:30"],
  party: ["16:00", "23:59"],
  trip: ["07:00", "22:00"],
  custom: ["09:00", "22:00"],
};

/**
 * Rough OSM `opening_hours` check. Returns true when the venue is open for the
 * whole [start, end] window; unparseable or missing data is treated as open so
 * a provider gap never wipes out every option.
 */
export function isOpenDuring(
  openHours: string | null | undefined,
  start: string | null | undefined,
  end: string | null | undefined,
  category: string,
): boolean {
  if (!start || !end) return true;
  const s = toMin(start);
  const e = Math.max(toMin(end), s);

  if (!openHours) {
    const [ds, de] = DEFAULT_HOURS[category] ?? DEFAULT_HOURS["custom"]!;
    return s >= toMin(ds) && e <= toMin(de);
  }
  const text = openHours.toLowerCase();
  if (text.includes("24/7")) return true;
  const ranges = [...text.matchAll(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/g)].map((m) => {
    const from = Number(m[1]) * 60 + Number(m[2]);
    let to = Number(m[3]) * 60 + Number(m[4]);
    if (to <= from) to += 24 * 60; // crosses midnight
    return [from, to] as const;
  });
  if (!ranges.length) return true;
  return ranges.some(([from, to]) => s >= from && e <= to);
}

/**
 * Fairness = nobody gets stuck driving much further than anyone else.
 * Lower spread and lower average travel both score higher (0-100).
 */
export function fairnessScore(minutes: number[]): number {
  if (!minutes.length) return 50;
  const avg = minutes.reduce((a, b) => a + b, 0) / minutes.length;
  const spread = Math.max(...minutes) - Math.min(...minutes);
  const variance = minutes.reduce((a, m) => a + (m - avg) ** 2, 0) / minutes.length;
  const stdev = Math.sqrt(variance);
  const score = 100 - spread * 2.4 - stdev * 1.6 - avg * 0.6;
  return Math.max(0, Math.round(score));
}

export type OptionLabelKey = "A" | "B" | "C";

export const OPTION_LABELS: Record<OptionLabelKey, { emoji: string; title: string }> = {
  A: { emoji: "📍", title: "Option A · Best midpoint" },
  B: { emoji: "⚡", title: "Option B · Popular pick" },
  C: { emoji: "🕒", title: "Option C · Quickest trip" },
};
