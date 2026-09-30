/**
 * Plan times are instants. The planning UIs collect a wall-clock date + time
 * in the user's zone; these helpers turn that into an unambiguous ISO
 * timestamp before it is stored in a `timestamptz` column. Sending the bare
 * "YYYY-MM-DDTHH:MM:00" makes Postgres read it as UTC, which shifts the plan
 * by the user's UTC offset (5-6 hours early for US Central).
 */

/** How long after a plan's end (or start, when no end) before it is settled. */
export const PLAN_END_GRACE_MS = 4 * 60 * 60 * 1000;

/** Browser-local wall clock -> ISO instant. Use in client code only. */
export function localToInstant(date: string, time: string): string {
  return new Date(`${date}T${time.slice(0, 5)}:00`).toISOString();
}

/** Browser-local calendar date as YYYY-MM-DD (unlike toISOString, not UTC). */
export function localDateKey(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Wall clock in an IANA zone -> ISO instant. For server code given the user's zone. */
export function zonedToInstant(date: string, time: string, timeZone: string): string {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  });
  const offsetAt = (ms: number) => {
    const parts = Object.fromEntries(
      fmt.formatToParts(new Date(ms)).map((x) => [x.type, Number(x.value)]),
    );
    return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute) - ms;
  };
  // Two passes so a DST change between the guess and the answer is honoured.
  let ms = wall - offsetAt(wall);
  ms = wall - offsetAt(ms);
  return new Date(ms).toISOString();
}

/**
 * Wall-clock pieces of an ISO instant in a zone. The parent-approval pages are
 * public (no signed-in profile whose zone we could trust), so their servers
 * format the plan's `timestamptz` values with the timezone the viewer's
 * browser reports instead of slicing the UTC string.
 */
const zonedParts = (iso: string, timeZone: string) =>
  Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  ) as { year: string; month: string; day: string; hour: string; minute: string };

/** HH:MM wall clock of an ISO instant in a zone. */
export function zonedClockTime(iso: string, timeZone: string): string {
  const p = zonedParts(iso, timeZone);
  return `${p.hour}:${p.minute}`;
}

/** YYYY-MM-DD calendar day of an ISO instant in a zone. */
export function zonedDateKey(iso: string, timeZone: string): string {
  const p = zonedParts(iso, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

/** True for a value Intl accepts as a zone name. */
export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * A plan is over once its grace window has elapsed: PLAN_END_GRACE_MS after
 * `windowEnd`, or after `windowStart` when no end was set. Plans with no times
 * never end. All comparisons are between instants.
 */
export function isPlanOver(
  plan: { windowStart: string | null; windowEnd: string | null },
  nowMs: number,
): boolean {
  const anchor = plan.windowEnd ?? plan.windowStart;
  if (!anchor) return false;
  return new Date(anchor).getTime() + PLAN_END_GRACE_MS < nowMs;
}

/** ISO cutoff for queries: rows with window_end/window_start before it are over. */
export function planOverCutoff(nowMs: number): string {
  return new Date(nowMs - PLAN_END_GRACE_MS).toISOString();
}
