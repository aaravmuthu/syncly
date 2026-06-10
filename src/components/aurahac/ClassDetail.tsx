import { useMemo, useState } from "react";
import { GradeRing } from "./GradeRing";
import { courseAverageFromAssignments } from "@/lib/hac/gpa";
import type { Course } from "@/lib/hac/types";
import { X, FlaskConical, Layers } from "lucide-react";

export function ClassDetail({ course, onClose }: { course: Course; onClose: () => void }) {
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const simulated = useMemo(() => courseAverageFromAssignments(course, overrides), [course, overrides]);
  const displayAvg = simulated ?? course.average;

  const summative = course.categoryAverages.find((c) => c.category === "Summative");
  const formative = course.categoryAverages.find((c) => c.category === "Formative");

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="glass-strong w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[92vh] flex flex-col animate-in slide-in-from-bottom duration-300">
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
          <GradeRing value={displayAvg} size={150} label={simulated !== null ? "Simulated" : "Average"} />
          <div className="space-y-2">
            <div className="glass p-3">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1">
                <FlaskConical className="h-3 w-3" /> Summative
              </div>
              <div className="text-xl font-bold tabular-nums">
                {summative?.average !== undefined && summative?.average !== null ? summative.average.toFixed(1) : "—"}
              </div>
              <div className="text-[10px] text-muted-foreground">Weight {summative?.weight ?? "—"}%</div>
            </div>
            <div className="glass p-3">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1">
                <Layers className="h-3 w-3" /> Formative
              </div>
              <div className="text-xl font-bold tabular-nums">
                {formative?.average !== undefined && formative?.average !== null ? formative.average.toFixed(1) : "—"}
              </div>
              <div className="text-[10px] text-muted-foreground">Weight {formative?.weight ?? "—"}%</div>
            </div>
          </div>
        </div>

        <div className="mt-4 px-5 text-[10px] uppercase tracking-widest text-muted-foreground flex items-center justify-between">
          <span>What-If Simulator · {course.assignments.length} assignments</span>
          {Object.keys(overrides).length ? (
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
              return (
                <div key={i} className="glass p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{a.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {a.category} {a.dueDate ? `· ${a.dueDate}` : ""}
                      </div>
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={120}
                      value={Number.isFinite(current) ? Math.round(current) : 0}
                      onChange={(e) => setOverrides({ ...overrides, [a.name]: Number(e.target.value) })}
                      className="w-16 bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1 text-right text-sm tabular-nums focus:outline-none focus:border-primary/60"
                    />
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Number.isFinite(current) ? current : 0}
                    onChange={(e) => setOverrides({ ...overrides, [a.name]: Number(e.target.value) })}
                    className="w-full mt-2 accent-[var(--primary)]"
                  />
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}