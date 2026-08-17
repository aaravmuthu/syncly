import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Time helpers — everything is stored as 24h "HH:MM"                  */
/* ------------------------------------------------------------------ */

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

const toMinutes = (v: string) => {
  const [h = "0", m = "0"] = v.split(":");
  return Number(h) * 60 + Number(m);
};
const fromMinutes = (mins: number) => {
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

/** Ambient tint for the scrubber: daylight → sunset → deep night. */
function ambient(mins: number): string {
  const h = mins / 60;
  if (h < 6) return "from-indigo-500/40 via-violet-600/40 to-slate-900/60";
  if (h < 11) return "from-sky-400/40 via-cyan-300/30 to-amber-200/30";
  if (h < 16) return "from-amber-200/30 via-sky-300/30 to-sky-400/30";
  if (h < 20) return "from-orange-400/45 via-rose-500/40 to-fuchsia-600/35";
  return "from-violet-700/45 via-indigo-800/45 to-slate-950/70";
}

const DEFAULT_PRESETS = ["21:00", "21:30", "22:00", "22:30", "23:00", "23:30", "00:00"];

export function TimePicker({
  value,
  onChange,
  presets = DEFAULT_PRESETS,
  allowNone = false,
  noneLabel = "No curfew",
  className,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  presets?: string[];
  allowNone?: boolean;
  noneLabel?: string;
  className?: string;
}) {
  const normalized = value ? value.slice(0, 5) : null;
  const [custom, setCustom] = useState("");
  const [pulse, setPulse] = useState<string | null>(null);
  const mins = normalized ? toMinutes(normalized) : 21 * 60;

  useEffect(() => {
    if (!pulse) return;
    const t = setTimeout(() => setPulse(null), 260);
    return () => clearTimeout(t);
  }, [pulse]);

  const pick = (v: string | null) => {
    setPulse(v ?? "none");
    onChange(v);
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => {
          const on = normalized === p;
          return (
            <button
              key={p}
              type="button"
              aria-pressed={on}
              onClick={() => pick(p)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold tabular-nums backdrop-blur transition duration-150",
                on
                  ? "border-success/60 bg-success/15 text-success shadow-[0_0_18px_-6px_var(--success)]"
                  : "border-border/70 bg-secondary/60 text-secondary-foreground hover:border-primary/40",
                pulse === p ? "scale-105" : "scale-100",
              )}
            >
              {prettyTime(p)}
            </button>
          );
        })}
        {allowNone ? (
          <button
            type="button"
            aria-pressed={normalized === null}
            onClick={() => pick(null)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition duration-150",
              normalized === null
                ? "border-success/60 bg-success/15 text-success shadow-[0_0_18px_-6px_var(--success)]"
                : "border-border/70 bg-secondary/60 text-secondary-foreground hover:border-primary/40",
              pulse === "none" ? "scale-105" : "scale-100",
            )}
          >
            {noneLabel}
          </button>
        ) : null}
      </div>

      <div className="rounded-2xl border border-border/70 bg-background/40 p-3">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-muted-foreground">Slide for a custom time</span>
          <span className="font-display text-lg font-semibold tabular-nums">
            {prettyTime(normalized)}
          </span>
        </div>
        <div className={cn("relative mt-2 rounded-full bg-gradient-to-r p-[3px]", ambient(mins))}>
          <input
            type="range"
            min={0}
            max={1425}
            step={15}
            value={mins}
            aria-label="Time"
            onChange={(e) => onChange(fromMinutes(Number(e.target.value)))}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-background/70 accent-primary"
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
          <span>12 AM</span>
          <span>Noon</span>
          <span>6 PM</span>
          <span>11:45 PM</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          className="w-full rounded-2xl border border-border bg-background px-3.5 py-2 text-sm outline-none focus:border-primary/60"
          placeholder='Type "1030", "10:30pm" or "midnight"'
          value={custom}
          onChange={(e) => {
            setCustom(e.target.value);
            const parsed = parseTimeInput(e.target.value);
            if (parsed) onChange(parsed);
          }}
          onBlur={() => setCustom("")}
        />
      </div>
    </div>
  );
}
