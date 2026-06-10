import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useHac } from "@/lib/hac/store";
import { cumulativeGPA, currentYearGPA } from "@/lib/hac/gpa";
import { AnimatedNumber } from "../AnimatedNumber";
import { SpotlightCard } from "../SpotlightCard";
import { RecentGradesBanner } from "../RecentGradesBanner";
import { AlertOctagon, RefreshCcw, GraduationCap, BarChart3, ChevronUp, Bell } from "lucide-react";

export function OverviewTab() {
  const { data, refresh, loading } = useHac();
  const [bannerOpen, setBannerOpen] = useState(true);
  if (!data) return null;
  const weighted = currentYearGPA(data.courses, true);
  const cum = cumulativeGPA(data.transcript, true);
  const avgClass =
    data.courses.reduce((s, c) => s + (c.average ?? 0), 0) /
    Math.max(1, data.courses.filter((c) => c.average !== null).length);
  const missing = data.courses.flatMap((c) =>
    c.assignments.filter((a) => a.missing || a.absent).map((a) => ({ course: c.name, ...a })),
  );

  return (
    <div className="space-y-5 pb-32">
      <header className="flex items-start justify-between gap-3 pt-2">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Welcome back</div>
          <h1 className="text-2xl font-bold tracking-tight">{data.student.name}</h1>
          <div className="text-xs text-muted-foreground mt-0.5">
            {data.student.school ?? "—"} {data.student.grade ? `· Grade ${data.student.grade}` : ""}
          </div>
        </div>
        <motion.button
          onClick={refresh}
          disabled={loading}
          whileTap={{ scale: 0.9 }}
          className="glass h-10 w-10 grid place-items-center"
        >
          <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </motion.button>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <SpotlightCard className="p-4">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Weighted GPA</div>
          <div className="text-3xl font-bold tabular-nums mt-1 text-gradient"><AnimatedNumber value={weighted} decimals={2} /></div>
        </SpotlightCard>
        <SpotlightCard className="p-4">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Cumulative</div>
          <div className="text-3xl font-bold tabular-nums mt-1"><AnimatedNumber value={cum} decimals={2} /></div>
        </SpotlightCard>
        <SpotlightCard className="p-4">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1">
            <GraduationCap className="h-3 w-3" /> Courses
          </div>
          <div className="text-3xl font-bold tabular-nums mt-1">{data.courses.length}</div>
        </SpotlightCard>
        <SpotlightCard className="p-4">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1">
            <BarChart3 className="h-3 w-3" /> Avg Class
          </div>
          <div className="text-3xl font-bold tabular-nums mt-1"><AnimatedNumber value={avgClass} decimals={1} /></div>
        </SpotlightCard>
      </div>

      {missing.length > 0 ? (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Missing / Action Required</h2>
            <button
              onClick={() => setBannerOpen((o) => !o)}
              className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-destructive active:scale-95"
            >
              {bannerOpen ? (
                <>
                  Collapse <ChevronUp className="h-3.5 w-3.5" />
                </>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-destructive/15 border border-destructive/30 pulse-coral">
                  <Bell className="h-3 w-3" /> {missing.length}
                </span>
              )}
            </button>
          </div>
          <AnimatePresence initial={false}>
            {bannerOpen ? (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 320, damping: 32 }}
                className="overflow-hidden"
              >
                <div className="space-y-2">
                  {missing.slice(0, 10).map((m, i) => (
                    <div
                      key={i}
                      className="glass p-3 flex items-center gap-3 border-l-2 border-destructive pulse-coral"
                    >
                      <AlertOctagon className="h-4 w-4 text-destructive shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{m.name}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{m.course}</div>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-destructive bg-destructive/15 px-2 py-1 rounded">
                        {m.absent ? "ABS" : "MISS"}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </section>
      ) : (
        <div className="glass p-4 text-sm text-muted-foreground">No missing assignments. You're caught up.</div>
      )}

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-2">Top Classes</h2>
        <div className="space-y-2">
          {data.courses.slice(0, 4).map((c) => {
            const avg = c.average ?? 0;
            const perfect = avg >= 100;
            return (
              <SpotlightCard key={c.id} className={`p-3 flex items-center justify-between ${perfect ? "aura-electric" : ""}`}>
                <div className="min-w-0 mr-3">
                  <div className="text-sm font-medium truncate">{c.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{c.teacher ?? ""}</div>
                </div>
                <div
                  className="text-xl font-bold tabular-nums"
                  style={{
                    color:
                      avg >= 90
                        ? "var(--success)"
                        : avg >= 80
                          ? "var(--primary)"
                          : avg >= 70
                            ? "var(--warning)"
                            : "var(--destructive)",
                  }}
                >
                  {c.average !== null ? c.average.toFixed(1) : "—"}
                </div>
              </SpotlightCard>
            );
          })}
        </div>
      </section>
    </div>
  );
}
