import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useHac } from "@/lib/hac/store";
import { dayTypeFor } from "@/lib/hac/customize";
import type { BellPeriod } from "@/lib/hac/types";
import { Clock, MapPin, Hourglass, Coffee } from "lucide-react";

/** Minutes since midnight for an "HH:MM" string. */
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

type Phase =
  | { kind: "before"; next: BellPeriod; secondsLeft: number }
  | { kind: "in"; period: BellPeriod; secondsLeft: number; total: number }
  | { kind: "passing"; next: BellPeriod; secondsLeft: number; total: number }
  | { kind: "after" }
  | { kind: "off" };

function computePhase(periods: BellPeriod[], now: Date): Phase {
  if (!periods.length) return { kind: "off" };
  const sorted = [...periods].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  const secNow = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    const startS = toMinutes(p.start) * 60;
    const endS = toMinutes(p.end) * 60;

    if (secNow < startS) {
      // Before this period starts.
      const prev = sorted[i - 1];
      if (!prev) return { kind: "before", next: p, secondsLeft: startS - secNow };
      // Between previous end and this start → passing period.
      const prevEnd = toMinutes(prev.end) * 60;
      return { kind: "passing", next: p, secondsLeft: startS - secNow, total: startS - prevEnd };
    }
    if (secNow >= startS && secNow < endS) {
      return { kind: "in", period: p, secondsLeft: endS - secNow, total: endS - startS };
    }
  }
  return { kind: "after" };
}

function fmt(seconds: number): { m: string; s: string } {
  const s = Math.max(0, Math.floor(seconds));
  return {
    m: String(Math.floor(s / 60)).padStart(2, "0"),
    s: String(s % 60).padStart(2, "0"),
  };
}

export function LivePeriodWidget() {
  const { bellRotation } = useHac();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const periods = useMemo(() => {
    const dt = dayTypeFor(bellRotation, now);
    return dt ? bellRotation.periods[dt] ?? [] : [];
  }, [bellRotation, now]);

  const dayType = useMemo(() => dayTypeFor(bellRotation, now), [bellRotation, now]);
  const phase = useMemo(() => computePhase(periods, now), [periods, now]);

  // Off-day / no schedule → calm resting card.
  if (phase.kind === "off" || (phase.kind === "after" && !periods.length)) {
    return (
      <RestingCard
        title="No classes today"
        subtitle="Enjoy the break — your schedule resumes on a school day."
      />
    );
  }
  if (phase.kind === "after") {
    return <RestingCard title="School's out" subtitle="All periods are done for today. Nice work." />;
  }

  const passing = phase.kind === "passing" || phase.kind === "before";
  const seconds = phase.secondsLeft;
  const { m, s } = fmt(seconds);

  // Progress ring fraction (time elapsed in the current segment).
  const fraction =
    phase.kind === "in"
      ? 1 - phase.secondsLeft / phase.total
      : phase.kind === "passing"
        ? 1 - phase.secondsLeft / phase.total
        : 0;

  const room =
    phase.kind === "in"
      ? phase.period.room
      : phase.kind === "passing" || phase.kind === "before"
        ? phase.next.room
        : undefined;
  const periodLabel =
    phase.kind === "in"
      ? phase.period.label
      : phase.kind === "passing" || phase.kind === "before"
        ? phase.next.label
        : "";

  const isLunch = phase.kind === "in" && /lunch/i.test(phase.period.label);
  // Urgency: passing period under 60s burns coral; otherwise primary glow.
  const urgent = passing && seconds <= 60;
  const accent = urgent ? "#f43f5e" : isLunch ? "var(--success)" : "var(--primary)";

  const R = 30;
  const C = 2 * Math.PI * R;

  return (
    <section
      className="relative overflow-hidden rounded-3xl p-5"
      style={{
        background: "color-mix(in oklab, var(--card) 55%, transparent)",
        border: `1px solid color-mix(in oklab, ${accent} 38%, transparent)`,
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        boxShadow: `0 0 40px -16px ${accent}`,
      }}
    >
      {/* Ambient accent glow */}
      <div
        aria-hidden
        className="absolute -top-12 -right-10 w-44 h-44 pointer-events-none"
        style={{
          background: `radial-gradient(circle, color-mix(in oklab, ${accent} 30%, transparent), transparent 70%)`,
          filter: "blur(24px)",
        }}
      />

      <div className="flex items-center gap-2 mb-3">
        <span
          className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] px-2.5 py-1 rounded-full"
          style={{
            color: accent,
            background: `color-mix(in oklab, ${accent} 14%, transparent)`,
            border: `1px solid color-mix(in oklab, ${accent} 34%, transparent)`,
          }}
        >
          {passing ? <Hourglass className="h-3 w-3" /> : isLunch ? <Coffee className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
          {passing ? "Passing Period" : isLunch ? "Lunch" : "In Class"}
        </span>
        {dayType ? (
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{dayType}</span>
        ) : null}
      </div>

      <div className="flex items-center gap-4">
        {/* Countdown ring */}
        <div className="relative shrink-0" style={{ width: 76, height: 76 }}>
          <svg width="76" height="76" viewBox="0 0 76 76" className="-rotate-90">
            <circle cx="38" cy="38" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
            <motion.circle
              cx="38"
              cy="38"
              r={R}
              fill="none"
              stroke={accent}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={C}
              animate={{ strokeDashoffset: C * (1 - Math.max(0, Math.min(1, fraction))) }}
              transition={{ ease: "linear", duration: 0.9 }}
              style={{ filter: `drop-shadow(0 0 6px ${accent})` }}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <Hourglass className="h-5 w-5" style={{ color: accent }} />
          </div>
        </div>

        {/* Timer + locator */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1 tabular-nums">
            <AnimatePresence mode="popLayout">
              <motion.span
                key={`${m}:${s}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="text-4xl font-extrabold leading-none"
                style={{ color: accent }}
              >
                {m}:{s}
              </motion.span>
            </AnimatePresence>
            <span className="text-xs text-muted-foreground ml-1">left</span>
          </div>
          <div className="mt-1 text-sm font-semibold truncate">
            {passing ? `Next: ${periodLabel}` : periodLabel}
          </div>
          {room ? (
            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold"
              style={{
                background: `color-mix(in oklab, ${accent} 16%, transparent)`,
                color: accent,
                border: `1px solid color-mix(in oklab, ${accent} 36%, transparent)`,
              }}
            >
              <MapPin className="h-3.5 w-3.5" />
              {passing ? "Head to" : "Room"} {room}
            </div>
          ) : null}
        </div>
      </div>

      {urgent ? (
        <div className="mt-3 text-[11px] font-bold uppercase tracking-widest" style={{ color: accent }}>
          Hurry — beat the tardy bell!
        </div>
      ) : null}
    </section>
  );
}

function RestingCard({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <section className="liquid rounded-3xl p-5 flex items-center gap-3">
      <div
        className="h-11 w-11 rounded-2xl grid place-items-center shrink-0"
        style={{ background: "color-mix(in oklab, var(--primary) 14%, transparent)" }}
      >
        <Clock className="h-5 w-5 text-primary" />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-bold">{title}</div>
        <div className="text-xs text-muted-foreground">{subtitle}</div>
      </div>
    </section>
  );
}
