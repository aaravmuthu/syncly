/** Keyless weather layer (Open-Meteo). Pure helpers — safe on the client. */

export type Forecast = {
  date: string; // YYYY-MM-DD
  precipProbability: number; // 0..100
  precipMm: number;
  tempMaxF: number;
  tempMinF: number;
  windMph: number;
  code: number;
  label: string;
  emoji: string;
  /** True when an outdoor plan would genuinely be unpleasant or unsafe. */
  alert: boolean;
  alertText: string | null;
};

const CODES: Record<number, { label: string; emoji: string }> = {
  0: { label: "Clear", emoji: "☀️" },
  1: { label: "Mostly clear", emoji: "🌤" },
  2: { label: "Partly cloudy", emoji: "⛅️" },
  3: { label: "Overcast", emoji: "☁️" },
  45: { label: "Fog", emoji: "🌫" },
  48: { label: "Freezing fog", emoji: "🌫" },
  51: { label: "Light drizzle", emoji: "🌦" },
  53: { label: "Drizzle", emoji: "🌦" },
  55: { label: "Heavy drizzle", emoji: "🌦" },
  61: { label: "Light rain", emoji: "🌧" },
  63: { label: "Rain", emoji: "🌧" },
  65: { label: "Heavy rain", emoji: "🌧" },
  71: { label: "Light snow", emoji: "🌨" },
  73: { label: "Snow", emoji: "🌨" },
  75: { label: "Heavy snow", emoji: "❄️" },
  80: { label: "Rain showers", emoji: "🌦" },
  81: { label: "Rain showers", emoji: "🌧" },
  82: { label: "Violent showers", emoji: "⛈" },
  95: { label: "Thunderstorms", emoji: "⛈" },
  96: { label: "Thunderstorms", emoji: "⛈" },
  99: { label: "Severe storms", emoji: "⛈" },
};

export function describeWeather(code: number) {
  return CODES[code] ?? { label: "Mixed conditions", emoji: "🌥" };
}

const OUTDOOR_HINTS = [
  "park",
  "outdoor",
  "trail",
  "hike",
  "beach",
  "lake",
  "picnic",
  "patio",
  "golf",
  "topgolf",
  "garden",
  "festival",
  "zoo",
  "amphitheater",
  "field",
  "stadium",
];

/** Whether an option is exposed to the weather. */
export function isOutdoorOption(input: { style?: string; tags?: string[]; title?: string }) {
  if ((input.style ?? "").toLowerCase() === "outdoor") return true;
  const hay = [...(input.tags ?? []), input.title ?? ""].join(" ").toLowerCase();
  return OUTDOOR_HINTS.some((h) => hay.includes(h));
}

/**
 * How much an outdoor option should be pushed down for a given forecast.
 * Returns a 0..1 multiplier plus a group-safe caution string.
 */
export function weatherPenalty(f: Forecast | null, outdoor: boolean) {
  if (!f || !outdoor) return { multiplier: 1, caution: null as string | null };
  const severe = [95, 96, 99, 82, 75, 65].includes(f.code);
  if (severe) {
    return {
      multiplier: 0.6,
      caution: `${f.emoji} Weather alert: ${f.label.toLowerCase()} forecast — indoor options rank higher`,
    };
  }
  if (f.precipProbability >= 60) {
    return {
      multiplier: 0.75,
      caution: `${f.emoji} Weather alert: ${f.precipProbability}% chance of rain at this outdoor spot`,
    };
  }
  if (f.precipProbability >= 35) {
    return {
      multiplier: 0.88,
      caution: `${f.emoji} ${f.precipProbability}% chance of rain — bring a backup`,
    };
  }
  if (f.tempMaxF >= 100 || f.tempMinF <= 28) {
    return { multiplier: 0.85, caution: `🌡 Extreme temperatures forecast for an outdoor plan` };
  }
  return { multiplier: 1, caution: null };
}

export function forecastSummary(f: Forecast) {
  return `${f.emoji} ${f.label} · ${Math.round(f.tempMaxF)}°/${Math.round(f.tempMinF)}° · ${f.precipProbability}% rain`;
}
