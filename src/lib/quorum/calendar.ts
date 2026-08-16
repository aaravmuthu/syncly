/** Calendar + share export helpers for finalized plans. */

export type CalendarEvent = {
  title: string;
  description: string;
  location: string;
  date: string | null; // ISO date or datetime
  start: string | null; // "19:00"
  end: string | null; // "21:30"
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toDateParts(ev: CalendarEvent) {
  const base = ev.date ? new Date(ev.date) : new Date(Date.now() + 86400000);
  const day = Number.isNaN(base.getTime()) ? new Date() : base;
  const mk = (time: string | null, fallbackHour: number) => {
    const [h, m] = (time ?? "").split(":");
    const d = new Date(day);
    d.setHours(Number(h ?? fallbackHour) || fallbackHour, Number(m ?? 0) || 0, 0, 0);
    return d;
  };
  const start = mk(ev.start, 19);
  const end = mk(ev.end, 21);
  if (end <= start) end.setTime(start.getTime() + 2 * 3600000);
  return { start, end };
}

function stampUtc(d: Date) {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`
  );
}

export function googleCalendarUrl(ev: CalendarEvent) {
  const { start, end } = toDateParts(ev);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: ev.title,
    details: ev.description,
    location: ev.location,
    dates: `${stampUtc(start)}/${stampUtc(end)}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function icsFile(ev: CalendarEvent) {
  const { start, end } = toDateParts(ev);
  const esc = (s: string) => s.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Quorum//Plan//EN",
    "BEGIN:VEVENT",
    `UID:${Math.random().toString(36).slice(2)}@quorum`,
    `DTSTAMP:${stampUtc(new Date())}`,
    `DTSTART:${stampUtc(start)}`,
    `DTEND:${stampUtc(end)}`,
    `SUMMARY:${esc(ev.title)}`,
    `DESCRIPTION:${esc(ev.description)}`,
    `LOCATION:${esc(ev.location)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadIcs(ev: CalendarEvent) {
  const blob = new Blob([icsFile(ev)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${ev.title.replace(/[^\w-]+/g, "-").toLowerCase() || "plan"}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** SMS-friendly summary. Deliberately contains no private constraint data. */
export function planSummaryText(input: {
  planTitle: string;
  venue: string;
  address?: string | null;
  when: string;
  attendees: string[];
  cars: { label: string; driver: string }[];
  perPerson: string;
}) {
  const lines = [
    `📍 ${input.planTitle}`,
    `${input.venue}${input.address ? ` — ${input.address}` : ""}`,
    `🕒 ${input.when}`,
    `💵 About ${input.perPerson} per person`,
  ];
  if (input.attendees.length) lines.push(`👥 ${input.attendees.join(", ")}`);
  for (const c of input.cars) lines.push(`🚗 ${c.label}: ${c.driver} driving`);
  lines.push("Planned with Quorum");
  return lines.join("\n");
}
