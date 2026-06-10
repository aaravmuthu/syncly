import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import confetti from "canvas-confetti";
import { useHac } from "@/lib/hac/store";
import { ChevronRight, X, Sparkles, CheckCircle2 } from "lucide-react";

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

export function RecentGradesBanner() {
  const { data, setCourseNav } = useHac();
  const [dismissed, setDismissed] = useState(false);

  const recent = useMemo(() => {
    if (!data) return null;
    const all = data.courses.flatMap((c) =>
      c.assignments
        .filter((a) => a.percent !== null && a.dueDate)
        .map((a) => ({ course: c, a, ts: parseDate(a.dueDate as string) })),
    );
    all.sort((x, y) => y.ts - x.ts);
    return all[0] ?? null;
  }, [data]);

  if (!data) return null;

  if (dismissed || !recent) {
    return (
      <div className="glass rounded-2xl px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground" style={{ backdropFilter: "blur(12px)" }}>
        <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
        Your dashboard is fully up to date.
      </div>
    );
  }

  const v = recent.a.percent ?? 0;
  const color = scoreColor(v);

  return (
    <AnimatePresence initial={true}>
      <motion.div
        key="recent-grade"
        initial={{ y: -28, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ x: -420, opacity: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 22 }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.5}
        onDragEnd={(_, info) => {
          if (info.offset.x < -110) setDismissed(true);
        }}
        className="relative rounded-2xl p-3 pr-2 flex items-center gap-3 overflow-hidden"
        style={{
          background: "var(--card)",
          border: "1px solid color-mix(in oklab, var(--primary) 45%, transparent)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        {/* pulsing electric purple perimeter glow */}
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-2xl pointer-events-none"
          animate={{
            boxShadow: [
              "0 0 0 1px color-mix(in oklab, var(--primary) 40%, transparent), 0 0 16px -4px var(--primary)",
              "0 0 0 1px color-mix(in oklab, var(--primary) 70%, transparent), 0 0 30px 0px var(--primary)",
              "0 0 0 1px color-mix(in oklab, var(--primary) 40%, transparent), 0 0 16px -4px var(--primary)",
            ],
          }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        />

        <button
          onClick={() => setCourseNav({ courseId: recent.course.id, sub: "analysis" })}
          className="relative z-10 flex items-center gap-3 flex-1 min-w-0 text-left"
        >
          {/* Score capsule */}
          <div
            className="shrink-0 px-3 py-2 rounded-xl font-bold tabular-nums text-base grid place-items-center min-w-[58px]"
            style={{
              background: `color-mix(in oklab, ${color} 22%, transparent)`,
              color,
              border: `1px solid color-mix(in oklab, ${color} 50%, transparent)`,
              boxShadow: `0 0 18px -6px ${color}`,
            }}
          >
            {v.toFixed(1)}
          </div>

          {/* Micro-data */}
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-widest text-primary inline-flex items-center gap-1 mb-0.5">
              <Sparkles className="h-3 w-3" /> Just Added
            </div>
            <div className="text-sm font-bold truncate">{recent.a.name}</div>
            <div className="text-[11px] truncate" style={{ color: "color-mix(in oklab, var(--primary) 45%, var(--muted-foreground))" }}>
              {recent.course.name} • {elapsed(recent.ts)}
            </div>
          </div>

          <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
        </button>

        <button
          onClick={() => setDismissed(true)}
          className="relative z-10 shrink-0 h-7 w-7 grid place-items-center rounded-lg bg-white/[0.06] text-muted-foreground hover:text-foreground active:scale-90 transition"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
