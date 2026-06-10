import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import confetti from "canvas-confetti";
import { useHac } from "@/lib/hac/store";
import type { Course, Assignment } from "@/lib/hac/types";
import { ChevronRight, X, CheckCircle2, ArrowUp, ChevronDown, ShieldCheck, Radio } from "lucide-react";

function parseDate(s: string): number {
  const [m, d, y] = s.split("/").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1).getTime();
}

function elapsed(ts: number): string {
  const days = Math.round((Date.now() - ts) / 86_400_000);
  if (days <= 0) return "Just Now";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return `${Math.round(days / 7)}w ago`;
}

function scoreColor(v: number): string {
  if (v >= 95) return "var(--primary)";
  if (v >= 90) return "var(--success)";
  if (v >= 80) return "var(--warning)";
  return "var(--destructive)";
}

type Direction = "up" | "down" | "hold";

interface LogEntry {
  key: string;
  course: Course;
  a: Assignment;
  ts: number;
  v: number;
  avg: number;
  dir: Direction;
  headline: string;
  subtext: string;
  points: number;
  color: string;
}

/**
 * Tactical formatter — analyzes a graded assignment against its class average
 * and returns RPG-flavored combat-log copy describing the consequence.
 */
function analyzeEntry(course: Course, a: Assignment, ts: number): LogEntry {
  const v = a.percent ?? 0;
  const avg = course.average ?? v;
  const avgStr = avg.toFixed(1);
  const delta = v - avg;

  // Aura points scale with the score; bigger swings, bigger rewards.
  const points = Math.max(1, Math.round(v / 4));

  let dir: Direction;
  let headline: string;
  let subtext: string;

  if (delta > 0.75) {
    dir = "up";
    headline = `📈 AURA UPGRADE: ${v.toFixed(0)}% on ${a.name} pushes ${course.name} to ${avgStr}!`;
    subtext = `CLASS AVG INCREASED TO ${avgStr}% • TIER PROGRESS +${Math.max(1, Math.round(delta))}%`;
  } else if (delta < -0.75) {
    dir = "down";
    headline = `⚠️ RANK AT RISK: ${v.toFixed(0)}% on ${a.name} pulled ${course.name} down.`;
    subtext = `CRITICAL IMPACTION: DROPPED AVG TO ${avgStr}%`;
  } else {
    dir = "hold";
    headline = `🛡️ LINE HELD: ${v.toFixed(0)}% on ${a.name} defended ${course.name}.`;
    subtext = `BOUNDARY DEFENDED • ${avgStr}% HOLDING STEADY`;
  }

  return {
    key: `${course.id}-${a.name}-${ts}`,
    course,
    a,
    ts,
    v,
    avg,
    dir,
    headline,
    subtext,
    points,
    color: scoreColor(v),
  };
}

function StatusIcon({ dir }: { dir: Direction }) {
  if (dir === "up") {
    return (
      <div
        className="h-9 w-9 rounded-xl grid place-items-center shrink-0"
        style={{ background: "color-mix(in oklab, var(--success) 18%, transparent)", border: "1px solid color-mix(in oklab, var(--success) 42%, transparent)" }}
      >
        <ArrowUp className="h-4 w-4 text-success" />
      </div>
    );
  }
  if (dir === "down") {
    return (
      <div
        className="h-9 w-9 rounded-xl grid place-items-center shrink-0"
        style={{ background: "color-mix(in oklab, var(--destructive) 18%, transparent)", border: "1px solid color-mix(in oklab, var(--destructive) 42%, transparent)" }}
      >
        <ChevronDown className="h-4 w-4 text-destructive" />
      </div>
    );
  }
  return (
    <div
      className="h-9 w-9 rounded-xl grid place-items-center shrink-0"
      style={{ background: "color-mix(in oklab, #f5b301 18%, transparent)", border: "1px solid color-mix(in oklab, #f5b301 42%, transparent)" }}
    >
      <ShieldCheck className="h-4 w-4" style={{ color: "#f5b301" }} />
    </div>
  );
}

export function RecentGradesBanner() {
  const { data, setCourseNav } = useHac();
  const [dismissed, setDismissed] = useState(false);
  const [hype, setHype] = useState(false);
  const firedRef = useRef(false);

  const feed = useMemo<LogEntry[]>(() => {
    if (!data) return [];
    const all = data.courses.flatMap((c) =>
      c.assignments
        .filter((a) => a.percent !== null && a.dueDate)
        .map((a) => ({ course: c, a, ts: parseDate(a.dueDate as string) })),
    );
    all.sort((x, y) => y.ts - x.ts);
    return all.slice(0, 6).map(({ course, a, ts }) => analyzeEntry(course, a, ts));
  }, [data]);

  const top = feed[0] ?? null;

  // Hype trigger: high A-range (>95) or perfect 100 grade on the freshest drop.
  useEffect(() => {
    if (!top || dismissed || firedRef.current) return;
    if (top.v < 95) return;
    firedRef.current = true;
    setHype(true);

    const t = window.setTimeout(() => {
      const purple = ["#a855f7", "#7c3aed", "#c4b5fd"];
      const silver = ["#e5e7eb", "#cbd5e1", "#f8fafc"];
      const colors = [...purple, ...silver];
      const end = Date.now() + 1100;
      (function frame() {
        confetti({
          particleCount: 4,
          startVelocity: 28,
          ticks: 200,
          gravity: 0.85,
          scalar: 0.9,
          spread: 70,
          origin: { x: Math.random(), y: -0.1 },
          colors,
          zIndex: 5,
        });
        if (Date.now() < end) requestAnimationFrame(frame);
      })();
    }, 350);

    const clear = window.setTimeout(() => setHype(false), 3200);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(clear);
    };
  }, [top, dismissed]);

  if (!data) return null;

  if (dismissed || feed.length === 0) {
    return (
      <div className="liquid shimmer-sweep rounded-2xl px-4 py-3.5 flex items-center gap-2.5 text-sm">
        <CheckCircle2 className="h-4 w-4 text-success shrink-0 relative z-10" />
        <span className="relative z-10 font-medium tracking-tight" style={{ color: "color-mix(in oklab, var(--primary) 35%, var(--muted-foreground))" }}>
          No New Grades Have Been Added
        </span>
      </div>
    );
  }

  return (
    <section
      className="relative rounded-2xl overflow-hidden"
      style={{
        background: "var(--card)",
        border: "1px solid color-mix(in oklab, var(--primary) 38%, transparent)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
        <div className="inline-flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive" />
          </span>
          <span className="text-[10px] font-bold uppercase tracking-[0.22em] inline-flex items-center gap-1.5" style={{ color: "color-mix(in oklab, var(--primary) 60%, var(--foreground))" }}>
            <Radio className="h-3.5 w-3.5" /> Combat Log
          </span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 h-7 w-7 grid place-items-center rounded-lg bg-white/[0.06] text-muted-foreground hover:text-foreground active:scale-90 transition"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Chronological feed */}
      <div className="px-2 pb-2 space-y-1">
        <AnimatePresence initial={true}>
          {feed.map((e, i) => {
            const isTop = i === 0;
            return (
              <motion.button
                key={e.key}
                initial={{ y: 16, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ delay: i * 0.07, type: "spring", stiffness: 360, damping: 26 }}
                onClick={() => setCourseNav({ courseId: e.course.id, sub: "analysis" })}
                className="w-full text-left flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-white/[0.04] transition-colors relative"
              >
                {isTop && hype ? (
                  <motion.span
                    aria-hidden
                    className="absolute inset-0 rounded-xl pointer-events-none"
                    animate={{
                      boxShadow: [
                        "0 0 0 1px color-mix(in oklab, var(--primary) 30%, transparent)",
                        "0 0 22px 0px color-mix(in oklab, var(--primary) 70%, transparent)",
                        "0 0 0 1px color-mix(in oklab, var(--primary) 30%, transparent)",
                      ],
                    }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  />
                ) : null}

                <StatusIcon dir={e.dir} />

                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold leading-snug line-clamp-2">{e.headline}</div>
                  <div
                    className="text-[10px] font-bold uppercase tracking-wider mt-1 truncate"
                    style={{
                      color:
                        e.dir === "up"
                          ? "var(--success)"
                          : e.dir === "down"
                            ? "var(--destructive)"
                            : "#f5b301",
                    }}
                  >
                    {e.subtext}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 inline-flex items-center gap-1.5">
                    {e.course.name} • {elapsed(e.ts)}
                    {e.dir === "up" ? <span className="text-success font-bold">+{e.points} Aura</span> : null}
                  </div>
                </div>

                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
    </section>
  );
}
