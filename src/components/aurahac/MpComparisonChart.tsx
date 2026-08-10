import { motion } from "motion/react";
import { useHac } from "@/lib/hac/store";
import { courseHistory, semesterGrade, SEMESTER_WEIGHTS } from "@/lib/hac/history";
import type { Course } from "@/lib/hac/types";

function color(v: number): string {
  if (v >= 90) return "var(--success)";
  if (v >= 80) return "var(--primary)";
  if (v >= 70) return "var(--warning)";
  return "var(--destructive)";
}

/**
 * Historical comparison of a course across MP1 → MP4, backed by the locked
 * marking-period ledger so past quarters survive term rollovers. Shows the
 * computed S1 / S2 grades (MP 40% + MP 40% + exam 20%) underneath.
 */
export function MpComparisonChart({ course }: { course: Course }) {
  const { ledger, academicYear } = useHac();
  const series = courseHistory(ledger, academicYear, course);
  const record = ledger.years[academicYear]?.courses[course.id];
  const s1 = semesterGrade(record, "S1");
  const s2 = semesterGrade(record, "S2");
  const graded = series.filter((s) => s.average !== null);

  if (!graded.length) {
    return (
      <div className="liquid rounded-2xl p-4 text-xs text-muted-foreground">
        No marking-period history recorded yet.
      </div>
    );
  }

  const min = Math.max(0, Math.min(...graded.map((g) => g.average as number)) - 6);
  const span = Math.max(1, 100 - min);

  return (
    <div className="liquid rounded-2xl p-4 space-y-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Marking period history
        </h3>
        <span className="text-[10px] text-muted-foreground">{academicYear}</span>
      </div>

      <div className="flex items-end gap-3 h-36">
        {series.map((s, i) => {
          const v = s.average;
          const h = v === null ? 0 : ((v - min) / span) * 100;
          return (
            <div key={s.mp} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
              <span className="text-[11px] font-bold tabular-nums" style={{ color: v === null ? undefined : color(v) }}>
                {v === null ? "—" : v.toFixed(1)}
              </span>
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(3, h)}%` }}
                transition={{ delay: i * 0.06, type: "spring", stiffness: 200, damping: 26 }}
                className="w-full rounded-t-lg"
                style={{
                  background:
                    v === null
                      ? "rgba(255,255,255,0.07)"
                      : `linear-gradient(180deg, ${color(v)}, color-mix(in oklab, ${color(v)} 25%, transparent))`,
                  boxShadow: v === null ? undefined : `0 0 20px -8px ${color(v)}`,
                }}
              />
              <span className="text-[10px] text-muted-foreground">
                {s.mp}
                {s.locked ? " 🔒" : ""}
              </span>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(["S1", "S2"] as const).map((sem) => {
          const r = sem === "S1" ? s1 : s2;
          return (
            <div key={sem} className="rounded-xl bg-white/[0.04] border border-white/10 p-2.5">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Semester {sem === "S1" ? "1" : "2"}
              </div>
              <div className="text-xl font-bold tabular-nums">
                {r.value === null ? "—" : r.value.toFixed(2)}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {r.usedExam
                  ? `${SEMESTER_WEIGHTS.mpA * 100}/${SEMESTER_WEIGHTS.mpB * 100}/${SEMESTER_WEIGHTS.exam * 100} w/ exam`
                  : "quarter average"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
