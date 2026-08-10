import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useHac } from "@/lib/hac/store";
import { cumulativeGPA, currentYearGPA } from "@/lib/hac/gpa";
import { courseForPeriod } from "@/lib/hac/marking";
import { AnimatedNumber } from "../AnimatedNumber";
import { UtilityMenu } from "../UtilityMenu";
import { RankBadge } from "../RankBadge";
import { StreakCard } from "../StreakCard";
import { SmartInsights } from "../SmartInsights";
import { TrendGraph, type TrendPoint } from "../TrendGraph";
import { LivePeriodWidget } from "../LivePeriodWidget";
import { AuraAvatar } from "../AuraAvatar";
import { ProfileDrawer } from "../ProfileDrawer";
import { AlertOctagon, GraduationCap, BarChart3, ChevronUp, Bell, LineChart } from "lucide-react";

function fullDate(): string {
  return new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function OverviewTab() {
  const { data, profile } = useHac();
  const [missingOpen, setMissingOpen] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  if (!data) return null;


  const weighted = currentYearGPA(data.courses, true);
  const cum = cumulativeGPA(data.transcript, true);
  const cumUnweighted = cumulativeGPA(data.transcript, false);
  const avgClass =
    data.courses.reduce((s, c) => s + (c.average ?? 0), 0) /
    Math.max(1, data.courses.filter((c) => c.average !== null).length);
  const missing = data.courses.flatMap((c) =>
    c.assignments.filter((a) => a.missing || a.absent).map((a) => ({ course: c.name, ...a })),
  );

  // Weighted-GPA trajectory across marking periods for the trend line graph.
  const trend: TrendPoint[] = (data.markingPeriodGPAs.length
    ? data.markingPeriodGPAs
    : (["MP1", "MP2", "MP3", "MP4"] as const)
        .map((mp) => {
          const periodCourses = data.courses.map((c) => courseForPeriod(c, mp)).filter((c) => c.average !== null);
          if (!periodCourses.length) return null;
          return { mp, gpa: currentYearGPA(periodCourses, true) };
        })
        .filter((m): m is { mp: "MP1" | "MP2" | "MP3" | "MP4"; gpa: number } => m !== null)
  ).map((m) => ({ label: m.mp, value: m.gpa }));
  const trendMax = Math.max(6, ...trend.map((t) => t.value));
  const trendMin = Math.max(0, Math.min(...trend.map((t) => t.value)) - 0.4);

  return (
    <div className="relative space-y-5 pb-32">
      {/* Ambient electric-purple mesh light behind the header */}
      <div
        aria-hidden
        className="absolute -top-10 left-1/2 -translate-x-1/2 w-[120%] h-64 pointer-events-none -z-10"
        style={{
          background:
            "radial-gradient(45% 60% at 30% 20%, color-mix(in oklab, var(--primary) 28%, transparent), transparent 70%), radial-gradient(40% 50% at 85% 30%, color-mix(in oklab, var(--accent) 18%, transparent), transparent 70%)",
          filter: "blur(40px)",
        }}
      />

      {/* Header */}
      <header className="flex items-start justify-between gap-3 pt-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Overview</h1>
          <div
            className="text-xs uppercase tracking-[0.18em] mt-1"
            style={{ color: "color-mix(in oklab, var(--primary) 28%, var(--muted-foreground))" }}
          >
            {fullDate()}
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <RankBadge gpa={cum > 0 ? cum : weighted} />
          <button
            onClick={() => setProfileOpen(true)}
            aria-label="Open student profile"
            className="active:scale-95 transition-transform"
          >
            <AuraAvatar profile={profile} fallbackName={data.student.name} size={46} />
          </button>
        </div>


      </header>

      <ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} />

      {/* Student profile card */}
      <button
        onClick={() => setProfileOpen(true)}
        className="w-full liquid rounded-2xl p-4 flex items-center gap-4 text-left active:scale-[0.99] transition-transform"
      >
        <AuraAvatar profile={profile} fallbackName={data.student.name} size={60} />
        <div className="min-w-0 flex-1">
          <div className="text-base font-bold truncate">
            {profile.displayName || data.student.name}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {profile.schoolName || data.student.school || "—"}
            {data.student.grade ? ` · Grade ${data.student.grade}` : ""}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1 flex gap-2">
            {profile.gradYear ? <span>Class of {profile.gradYear}</span> : null}
            {profile.badgeId ? <span className="font-mono">#{profile.badgeId}</span> : null}
            <span className="text-primary">Customize →</span>
          </div>
        </div>
      </button>

      {/* Live "Tardy Burner" passing-period countdown */}
      <LivePeriodWidget />


      {/* Academic streak */}
      <StreakCard />

      {/* Friendly, actionable grade insights */}
      <SmartInsights />



      {/* Missing assignments */}
      {missing.length > 0 ? (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Missing</h2>
            <button
              onClick={() => setMissingOpen((o) => !o)}
              className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-destructive active:scale-95"
            >
              {missingOpen ? (
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
            {missingOpen ? (
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
                      className="liquid rounded-2xl p-3.5 flex items-center gap-3"
                      style={{ border: "1px solid rgba(255,255,255,0.05)" }}
                    >
                      <AlertOctagon className="h-4 w-4 text-destructive shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{m.name}</div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {m.course}
                          {m.dueDate ? <span className="opacity-70"> · {m.dueDate}</span> : null}
                        </div>
                      </div>
                      <span
                        className="shrink-0 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg text-white"
                        style={{
                          background: "linear-gradient(135deg, #ff6b6b, #f43f5e)",
                          boxShadow: "0 0 18px -4px #f43f5e",
                        }}
                      >
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
        <div className="liquid rounded-2xl p-4 text-sm text-muted-foreground">No missing assignments. You're caught up.</div>
      )}

      {/* Snapshot stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="liquid rounded-2xl p-4">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Weighted GPA</div>
          <div className="text-3xl font-bold tabular-nums mt-1 text-gradient"><AnimatedNumber value={weighted} decimals={2} /></div>
        </div>
        <div className="liquid rounded-2xl p-4">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Cum. Weighted</div>
          <div className="text-3xl font-bold tabular-nums mt-1"><AnimatedNumber value={cum} decimals={2} /></div>
          <div className="text-[10px] text-muted-foreground mt-1">all years on record</div>
        </div>
        <div className="liquid rounded-2xl p-4">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Cum. Unweighted</div>
          <div className="text-3xl font-bold tabular-nums mt-1"><AnimatedNumber value={cumUnweighted} decimals={2} /></div>
          <div className="text-[10px] text-muted-foreground mt-1">4.0 scale · all years</div>
        </div>
        <div className="liquid rounded-2xl p-4">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1">
            <GraduationCap className="h-3 w-3" /> Courses
          </div>
          <div className="text-3xl font-bold tabular-nums mt-1">{data.courses.length}</div>
        </div>
        <div className="liquid rounded-2xl p-4">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1">
            <BarChart3 className="h-3 w-3" /> Avg Class
          </div>
          <div className="text-3xl font-bold tabular-nums mt-1"><AnimatedNumber value={avgClass} decimals={1} /></div>
        </div>
      </div>

      {/* Weighted-GPA trend over the semester */}
      <section className="liquid rounded-2xl p-4">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1.5 mb-3">
          <LineChart className="h-3 w-3" /> GPA Trend
        </div>
        <TrendGraph points={trend} max={trendMax} min={trendMin} />
      </section>

      {/* Utility navigation grid */}
      <UtilityMenu />
    </div>
  );
}
