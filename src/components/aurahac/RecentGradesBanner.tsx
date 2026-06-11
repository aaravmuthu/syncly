import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useHac } from "@/lib/hac/store";
import type { Course, Assignment } from "@/lib/hac/types";
import { ChevronRight, X, CheckCircle2, ArrowUp, ChevronDown, Minus, Radio } from "lucide-react";

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

interface GradeEntry {
  key: string;
  course: Course;
  a: Assignment;
  ts: number;
  v: number;
  dir: Direction;
  color: string;
}

function analyzeEntry(course: Course, a: Assignment, ts: number): GradeEntry {
  const v = a.percent ?? 0;
  const avg = course.average ?? v;
  const delta = v - avg;

  let dir: Direction;
  if (delta > 0.75) dir = "up";
  else if (delta < -0.75) dir = "down";
  else dir = "hold";

  return {
    key: `${course.id}-${a.name}-${ts}`,
    course,
    a,
    ts,
    v,
    dir,
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
      style={{ background: "color-mix(in oklab, var(--muted-foreground) 12%, transparent)", border: "1px solid color-mix(in oklab, var(--muted-foreground) 30%, transparent)" }}
    >
      <Minus className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}

export function RecentGradesBanner() {
  const { data, setCourseNav } = useHac();
  const [dismissed, setDismissed] = useState(false);

  const feed = useMemo<GradeEntry[]>(() => {
    if (!data) return [];
    const all = data.courses.flatMap((c) =>
      c.assignments
        .filter((a) => a.percent !== null && a.dueDate)
        .map((a) => ({ course: c, a, ts: parseDate(a.dueDate as string) })),
    );
    all.sort((x, y) => y.ts - x.ts);
    return all.slice(0, 6).map(({ course, a, ts }) => analyzeEntry(course, a, ts));
  }, [data]);

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
            <Radio className="h-3.5 w-3.5" /> Recent Grades
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
          {feed.map((e, i) => (
            <motion.button
              key={e.key}
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ delay: i * 0.07, type: "spring", stiffness: 360, damping: 26 }}
              onClick={() => setCourseNav({ courseId: e.course.id, sub: "analysis" })}
              className="w-full text-left flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-white/[0.04] transition-colors relative"
            >
              <StatusIcon dir={e.dir} />

              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-bold leading-snug line-clamp-1">{e.a.name}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5 inline-flex items-center gap-1.5">
                  {e.course.name} · {elapsed(e.ts)}
                </div>
              </div>

              <div className="shrink-0 text-right">
                <div className="text-base font-bold tabular-nums" style={{ color: e.color }}>
                  {e.v.toFixed(0)}%
                </div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
                  {e.dir === "up" ? "Above avg" : e.dir === "down" ? "Below avg" : "On par"}
                </div>
              </div>

              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}
