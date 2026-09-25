export function prettyTime(v: string | null | undefined): string {
  if (!v) return "—";
  const [h = "0", m = "00"] = v.split(":");
  const hour = Number(h);
  const suffix = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  if (hour === 0 && m === "00") return "Midnight";
  if (hour === 12 && m === "00") return "Noon";
  return `${h12}:${m.padStart(2, "0")} ${suffix}`;
}

export const toMinutes = (v: string) => {
  const [h = "0", m = "0"] = v.split(":");
  return Number(h) * 60 + Number(m);
};

export const fromMinutes = (mins: number) => {
  const wrapped = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

/**
 * Parses loose human typing into "HH:MM".
 * "10" → 10:00 PM-ish rules, "1030" → 10:30, "10:30pm" → 22:30, "midnight" → 00:00.
 */
export function parseTimeInput(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  if (s.startsWith("mid")) return "00:00";
  if (s.startsWith("noon")) return "12:00";

  const pm = /p/.test(s);
  const am = /a/.test(s);
  const digits = s.replace(/[^0-9]/g, "");
  if (!digits) return null;

  let h: number;
  let m = 0;
  if (s.includes(":")) {
    const [hh = "", mm = ""] = s.split(":");
    h = Number(hh.replace(/[^0-9]/g, ""));
    m = Number(mm.replace(/[^0-9]/g, "") || 0);
  } else if (digits.length <= 2) {
    h = Number(digits);
  } else {
    h = Number(digits.slice(0, digits.length - 2));
    m = Number(digits.slice(-2));
  }
  if (Number.isNaN(h) || Number.isNaN(m) || h > 24 || m > 59) return null;
  if (h === 24) h = 0;
  if (pm && h < 12) h += 12;
  if (am && h === 12) h = 0;
  // Bare small numbers with no meridiem read as evening — this picker is used
  // for curfews and night-out start times far more than for mornings.
  if (!pm && !am && h >= 1 && h <= 11 && !s.includes(":") && digits.length <= 2) h += 12;
  return fromMinutes(h * 60 + m);
}
