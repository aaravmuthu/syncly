// Pure helpers for the "works for everyone" hard filter: operating hours and
// fairness scoring. No IO — safe to import from client or server code.
import type { ScoredOption } from "./engine";

/** Persist every hard gate in the same feasibility value the lock-in uses. */
export function applyVenueRequirements(
  scored: ScoredOption,
  gates: { distanceOk: boolean; curfewOk: boolean; hoursOk: boolean },
): ScoredOption {
  const failed = Object.values(gates).filter((passes) => !passes).length;
  if (!failed) return scored;
  return {
    ...scored,
    feasible: false,
    breakdown: {
      ...scored.breakdown,
      hardFailures: scored.breakdown.hardFailures + failed,
      reasons: [],
      cautions: [
        ...new Set([
          ...scored.breakdown.cautions,
          "This option does not meet every member's requirements",
          ...(!gates.hoursOk ? ["The venue may be closed during this window"] : []),
        ]),
      ],
    },
  };
}

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
  date?: string,
): boolean {
  if (!start || !end) return true;
  const s = toMin(start);
  const rawEnd = toMin(end);
  const e = rawEnd < s ? rawEnd + 24 * 60 : rawEnd;

  if (!openHours) {
    const [ds, de] = DEFAULT_HOURS[category] ?? DEFAULT_HOURS["custom"]!;
    return s >= toMin(ds) && e <= toMin(de);
  }
  const text = openHours.trim().toLowerCase();
  if (text === "24/7") return true;
  const weekdays = ["su", "mo", "tu", "we", "th", "fr", "sa"];
  const weekday = date ? new Date(`${date}T12:00:00Z`).getUTCDay() : null;
  // Day-specific strings cannot be verified without the outing's calendar day.
  if (weekday == null && /\b(mo|tu|we|th|fr|sa|su)\b/.test(text)) return false;
  let open = false;
  for (const clause of text.split(";")) {
    const days = clause
      .trim()
      .match(
        /^((?:(?:mo|tu|we|th|fr|sa|su)(?:-(?:mo|tu|we|th|fr|sa|su))?)(?:,(?:mo|tu|we|th|fr|sa|su)(?:-(?:mo|tu|we|th|fr|sa|su))?)*)\s+/,
      );
    if (days && weekday != null) {
      const allowed = new Set<number>();
      for (const part of days[1].split(",")) {
        const [from, to = from] = part.split("-");
        let i = weekdays.indexOf(from);
        const end = weekdays.indexOf(to);
        for (let n = 0; n < 7; n++) {
          allowed.add(i);
          if (i === end) break;
          i = (i + 1) % 7;
        }
      }
      if (!allowed.has(weekday)) continue;
    }
    const hours = days ? clause.trim().slice(days[0].length) : clause.trim();
    if (/^(off|closed)$/.test(hours)) {
      open = false;
      continue;
    }
    if (
      !/^\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}(?:\s*,\s*\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})*$/.test(
        hours,
      )
    )
      return false;
    const ranges = [...hours.matchAll(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/g)];
    open ||= ranges.some((m) => {
      const from = Number(m[1]) * 60 + Number(m[2]);
      let to = Number(m[3]) * 60 + Number(m[4]);
      if (to <= from) to += 1440;
      return (s >= from && e <= to) || (s + 1440 >= from && e + 1440 <= to);
    });
  }
  return open;
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
