import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { GradeRing } from "./GradeRing";
import { AnimatedNumber } from "./AnimatedNumber";
import { SpotlightCard } from "./SpotlightCard";
import { courseAverageFromAssignments, categoryAveragesFromAssignments } from "@/lib/hac/gpa";
import type { Course } from "@/lib/hac/types";
import { X, FlaskConical, Layers, ChevronDown } from "lucide-react";

export function ClassDetail({ course, onClose }: { course: Course; onClose: () => void }) {
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const simulated = useMemo(() => courseAverageFromAssignments(course, overrides), [course, overrides]);
  const displayAvg = simulated ?? course.average;
  const liveCats = useMemo(() => categoryAveragesFromAssignments(course, overrides), [course, overrides]);

  const summative = course.categoryAverages.find((c) => c.category === "Summative");
  const formative = course.categoryAverages.find((c) => c.category === "Formative");
  const sumAvg = liveCats["Summative"] ?? summative?.average ?? null;
  const formAvg = liveCats["Formative"] ?? formative?.average ?? null;
  const dirty = Object.keys(overrides).length > 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <motion.div
        initial={{ y: 60, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        className="glass-strong w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[92vh] flex flex-col"
      >
        <header className="flex items-start justify-between gap-3 p-5 pb-3 shrink-0">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{course.period ?? "Course"}</div>
            <h2 className="text-lg font-bold truncate">{course.name}</h2>
            <div className="text-xs text-muted-foreground truncate">{course.teacher ?? ""}</div>
          </div>
          <button onClick={onClose} className="glass h-9 w-9 grid place-items-center active:scale-95">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="px-5 grid grid-cols-[auto_1fr] gap-4 items-center">
          <GradeRing value={displayAvg} size={150} label={dirty ? "Simulated" : "Average"} />
          <div className="space-y-2">
            <SpotlightCard className="p-3">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1">
                <FlaskConical className="h-3 w-3" /> Summative
              </div>
              <div className="text-xl font-bold tabular-nums">
                {sumAvg !== null ? <AnimatedNumber value={sumAvg} decimals={1} /> : "—"}
              </div>
              <div className="text-[10px] text-muted-foreground">Weight {summative?.weight ?? "—"}%</div>
            </SpotlightCard>
            <SpotlightCard className="p-3">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1">
                <Layers className="h-3 w-3" /> Formative
              </div>
              <div className="text-xl font-bold tabular-nums">
                {formAvg !== null ? <AnimatedNumber value={formAvg} decimals={1} /> : "—"}
              </div>
              <div className="text-[10px] text-muted-foreground">Weight {formative?.weight ?? "—"}%</div>
            </SpotlightCard>
          </div>
        </div>

        <div className="mt-4 px-5 text-[10px] uppercase tracking-widest text-muted-foreground flex items-center justify-between">
          <span>What-If Simulator · {course.assignments.length} assignments</span>
          {dirty ? (
            <button onClick={() => setOverrides({})} className="text-primary uppercase">Reset</button>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-6 mt-2 space-y-2">
          {course.assignments.length === 0 ? (
            <div className="text-sm text-muted-foreground p-4 text-center">No assignments synced.</div>
          ) : (
            course.assignments.map((a, i) => {
              const baseline =
                a.percent ?? (a.score !== null && a.totalPoints ? (a.score / a.totalPoints) * 100 : null);
              const current = overrides[a.name] ?? baseline ?? 0;
              const isOpen = expanded === a.name;
              const flagged = a.missing || a.absent;
              const perfect = (overrides[a.name] ?? baseline ?? 0) >= 100;
              return (
                <SpotlightCard
                  key={i}
                  className={`p-3 ${flagged ? "pulse-coral" : perfect ? "aura-electric" : ""}`}
                >
                  <button
                    className="w-full flex items-start justify-between gap-2 text-left"
                    onClick={() => setExpanded(isOpen ? null : a.name)}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate flex items-center gap-2">
                        {a.name}
                        {flagged ? (
                          <span className="text-[9px] font-bold uppercase tracking-widest text-destructive bg-destructive/15 px-1.5 py-0.5 rounded">
                            {a.absent ? "ABS" : "MISS"}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {a.category} {a.dueDate ? `· ${a.dueDate}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-bold tabular-nums text-primary">
                        <AnimatedNumber value={Number.isFinite(current) ? current : 0} decimals={0} />
                      </span>
                      <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ type: "spring", stiffness: 400, damping: 26 }}>
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      </motion.span>
                    </div>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen ? (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 320, damping: 32 }}
                        className="overflow-hidden"
                      >
                        <div className="flex items-center gap-3 pt-3">
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={Number.isFinite(current) ? current : 0}
                            onChange={(e) => setOverrides({ ...overrides, [a.name]: Number(e.target.value) })}
                            className="flex-1 accent-[var(--primary)]"
                          />
                          <input
                            type="number"
                            min={0}
                            max={120}
                            value={Number.isFinite(current) ? Math.round(current) : 0}
                            onChange={(e) => setOverrides({ ...overrides, [a.name]: Number(e.target.value) })}
                            className="w-16 bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1 text-right text-sm tabular-nums focus:outline-none focus:border-primary/60"
                          />
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </SpotlightCard>
              );
            })
          )}
        </div>
      </motion.div>
    </div>
  );
}
