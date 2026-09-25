// Server-only weather fetch (Open-Meteo, keyless).
import { describeWeather, type Forecast } from "./weather";

const cache = new Map<string, { at: number; value: Forecast | null }>();
const TTL = 30 * 60 * 1000;

function isoDate(input: string | null | undefined) {
  const d = input ? new Date(input) : new Date();
  const day = Number.isNaN(d.getTime()) ? new Date() : d;
  return day.toISOString().slice(0, 10);
}

export async function fetchForecast(
  lat: number,
  lon: number,
  dateInput: string | null,
): Promise<Forecast | null> {
  const date = isoDate(dateInput);
  const key = `${lat.toFixed(2)},${lon.toFixed(2)},${date}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value;

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max` +
      `&current_weather=true` +
      `&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=mm&timezone=auto` +
      `&start_date=${date}&end_date=${date}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      current_weather?: { temperature?: number; weathercode?: number };
      daily?: {
        time?: string[];
        weather_code?: number[];
        temperature_2m_max?: number[];
        temperature_2m_min?: number[];
        precipitation_probability_max?: (number | null)[];
        precipitation_sum?: number[];
        wind_speed_10m_max?: number[];
      };
    };
    const d = json.daily;
    if (!d?.time?.length) return null;
    const code = d.weather_code?.[0] ?? 0;
    const meta = describeWeather(code);
    const precipProbability = Math.round(d.precipitation_probability_max?.[0] ?? 0);
    const isToday = date === new Date().toISOString().slice(0, 10);
    const cur = isToday ? json.current_weather : undefined;
    const curMeta = cur?.weathercode != null ? describeWeather(cur.weathercode) : null;
    const forecast: Forecast = {
      date: d.time[0]!,
      code,
      label: meta.label,
      emoji: meta.emoji,
      precipProbability,
      precipMm: d.precipitation_sum?.[0] ?? 0,
      tempMaxF: d.temperature_2m_max?.[0] ?? 0,
      tempMinF: d.temperature_2m_min?.[0] ?? 0,
      windMph: d.wind_speed_10m_max?.[0] ?? 0,
      currentTempF: cur?.temperature != null ? Math.round(cur.temperature) : null,
      currentLabel: curMeta?.label ?? null,
      currentEmoji: curMeta?.emoji ?? null,
      alert: precipProbability >= 60 || [95, 96, 99, 82, 75, 65].includes(code),
      alertText: null,
    };
    forecast.alertText = forecast.alert
      ? `${forecast.emoji} Weather alert: ${forecast.label.toLowerCase()}, ${precipProbability}% chance of rain`
      : null;
    cache.set(key, { at: Date.now(), value: forecast });
    return forecast;
  } catch {
    return null;
  }
}
