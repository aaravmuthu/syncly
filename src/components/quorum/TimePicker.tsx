import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { prettyTime, toMinutes, fromMinutes, parseTimeInput } from "./time-format";

/* ------------------------------------------------------------------ */
/* Time helpers — everything is stored as 24h "HH:MM"                  */
/* ------------------------------------------------------------------ */

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
                "tap-target rounded-full border px-3 py-1.5 text-xs font-semibold tabular-nums backdrop-blur transition duration-150",
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
              "tap-target rounded-full border px-3 py-1.5 text-xs font-semibold transition duration-150",
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
        <div className="flex flex-wrap items-baseline justify-between gap-2">
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
            className="h-11 w-full cursor-pointer rounded-full accent-primary"
          />
        </div>
        <div className="mt-1.5 flex justify-between text-caption uppercase tracking-wide text-muted-foreground">
          <span>12 AM</span>
          <span>Noon</span>
          <span>6 PM</span>
          <span>11:45 PM</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          aria-label="Custom time"
          enterKeyHint="done"
          className="h-11 w-full rounded-2xl border border-border bg-background px-3.5 py-2 outline-none transition-colors focus:border-primary/60"
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
