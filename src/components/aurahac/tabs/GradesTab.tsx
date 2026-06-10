import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useHac } from "@/lib/hac/store";
import { ClassDetail } from "../ClassDetail";
import { CustomizeClassModal } from "../CustomizeClassModal";
import type { Course } from "@/lib/hac/types";
import type { CourseSubTab } from "@/lib/hac/store";
import { courseDisplay } from "@/lib/hac/customize";
import { courseForPeriod } from "@/lib/hac/marking";
import { MarkingPeriodSlider } from "../MarkingPeriodSlider";
import { ChevronRight, Palette } from "lucide-react";

function pillColor(avg: number, isDominos: boolean) {
  if (isDominos) return "var(--chart-2)"; // lighter accent blue
  if (avg >= 90) return "var(--success)";
  if (avg >= 80) return "var(--primary)";
  if (avg >= 70) return "var(--warning)";
  return "var(--destructive)";
}

export function GradesTab() {
  const { data, courseNav, setCourseNav, courseCustom } = useHac();
  const [open, setOpen] = useState<Course | null>(null);
  const [customizing, setCustomizing] = useState<Course | null>(null);
  const [initialSub, setInitialSub] = useState<CourseSubTab>("grades");

  useEffect(() => {
    if (courseNav && data) {
      const c = data.courses.find((x) => x.id === courseNav.courseId);
      if (c) {
        setOpen(c);
        setInitialSub(courseNav.sub);
      }
      setCourseNav(null);
    }
  }, [courseNav, data, setCourseNav]);

  if (!data) return null;

  return (
    <div className="space-y-4 pb-32">
      <header className="pt-2">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Marking Period 4</div>
        <h1 className="text-2xl font-bold tracking-tight">Your Classes</h1>
        <p className="text-xs text-muted-foreground mt-1">Tap the palette to rename a class or pick an emoji &amp; color.</p>
      </header>

      <div className="space-y-3">
        {data.courses.map((c) => {
          const v = c.average ?? 0;
          const isDominos = c.id === "mth2300b-1";
          const color = pillColor(v, isDominos);
          const d = courseDisplay(c, courseCustom[c.id]);
          return (
            <motion.div
              key={c.id}
              whileHover={{ y: -2 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              className="glass spotlight w-full rounded-2xl flex items-stretch overflow-hidden"
              style={{ backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
            >
              <button
                onClick={() => {
                  setInitialSub("grades");
                  setOpen(c);
                }}
                className="flex-1 min-w-0 px-4 py-5 min-h-[76px] flex items-center gap-3 text-left"
              >
                <div
                  className="shrink-0 h-11 w-11 rounded-xl grid place-items-center text-xl"
                  style={{
                    background: d.gradient ?? "color-mix(in oklab, var(--primary) 14%, transparent)",
                  }}
                >
                  {d.emoji ?? "🎓"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-base font-bold truncate">{d.name}</div>
                  <div className="text-xs text-muted-foreground/80 truncate mt-0.5" style={{ color: "color-mix(in oklab, var(--primary) 45%, var(--muted-foreground))" }}>
                    {c.code ?? c.teacher ?? ""}
                  </div>
                </div>
                <div
                  className="shrink-0 px-3.5 py-1.5 rounded-full font-bold tabular-nums text-sm"
                  style={{
                    background: `color-mix(in oklab, ${color} 20%, transparent)`,
                    color,
                    border: `1px solid color-mix(in oklab, ${color} 45%, transparent)`,
                    boxShadow: `0 0 18px -6px ${color}`,
                  }}
                >
                  {c.average !== null ? c.average.toFixed(2) : "—"}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
              <button
                onClick={() => setCustomizing(c)}
                aria-label="Customize class"
                className="shrink-0 px-3 grid place-items-center text-muted-foreground hover:text-primary border-l border-white/5"
              >
                <Palette className="h-4 w-4" />
              </button>
            </motion.div>
          );
        })}
        {data.courses.length === 0 ? (
          <div className="glass p-6 text-center text-sm text-muted-foreground">
            No courses parsed from your portal. Try refreshing on the Overview tab.
          </div>
        ) : null}
      </div>

      {open ? <ClassDetail course={open} initialSub={initialSub} onClose={() => setOpen(null)} /> : null}
      {customizing ? <CustomizeClassModal course={customizing} onClose={() => setCustomizing(null)} /> : null}
    </div>
  );
}
