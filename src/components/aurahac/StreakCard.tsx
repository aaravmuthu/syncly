import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useHac } from "@/lib/hac/store";
import { currentYearGPA } from "@/lib/hac/gpa";
import { STREAK_THRESHOLD, streakMilestone } from "@/lib/hac/streaks";
import { Flame, Trophy } from "lucide-react";

/**
 * Academic streak card. Counts consecutive on-track days and celebrates
 * milestones. A day is "on track" when the weighted GPA is at/above the
 * threshold OR every planner task is checked off.
 */
export function StreakCard() {
  const { data, streak, recordStreak, completed, userEvents } = useHac();
  const recorded = useRef(false);

  // Determine "on track" and record a check-in once per mount/day.
  useEffect(() => {
    if (!data || recorded.current) return;
    recorded.current = true;
    const gpa = currentYearGPA(data.courses, true);
    const totalTasks = userEvents.length;
    const doneTasks = userEvents.filter((e) => completed[e.id]).length;
    const allTasksDone = totalTasks > 0 && doneTasks === totalTasks;
    const onTrack = gpa >= STREAK_THRESHOLD || allTasksDone;
    recordStreak(onTrack);
  }, [data, userEvents, completed, recordStreak]);

  if (!data) return null;

  const count = streak.count;
  const milestone = streakMilestone(count);
  const active = count > 0;

  return (
    <div
      className="liquid rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden"
      style={{ border: "1px solid color-mix(in oklab, var(--primary) 22%, transparent)" }}
    >
      {/* Warm ember glow when the streak is alive */}
      {active ? (
        <div
          aria-hidden
          className="absolute inset-0 -z-10 pointer-events-none"
          style={{
            background:
              "radial-gradient(60% 80% at 12% 50%, color-mix(in oklab, #f97316 22%, transparent), transparent 70%)",
          }}
        />
      ) : null}

      <motion.div
        animate={active ? { scale: [1, 1.12, 1] } : {}}
        transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
        className="h-14 w-14 shrink-0 rounded-2xl grid place-items-center relative"
        style={{
          background: active
            ? "linear-gradient(135deg,#f97316,#ef4444)"
            : "color-mix(in oklab, var(--muted-foreground) 14%, transparent)",
          boxShadow: active ? "0 0 28px -6px #f97316" : "none",
        }}
      >
        <Flame className="h-7 w-7" style={{ color: active ? "#fff" : "var(--muted-foreground)" }} />
      </motion.div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <AnimatePresence mode="popLayout">
            <motion.span
              key={count}
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -8, opacity: 0 }}
              className="text-3xl font-bold tabular-nums text-foreground"
            >
              {count}
            </motion.span>
          </AnimatePresence>
          <span className="text-sm font-semibold text-muted-foreground">
            day{count === 1 ? "" : "s"} streak
          </span>
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5">
          {active
            ? "Stay above a 3.5 GPA or finish all tasks to keep it going."
            : "Check in on-track today to start a streak 🔥"}
        </div>
      </div>

      <div className="shrink-0 flex flex-col items-end gap-1">
        {milestone ? (
          <span
            className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full text-white"
            style={{ background: "linear-gradient(135deg,#f97316,#ef4444)" }}
          >
            {milestone}
          </span>
        ) : null}
        <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
          <Trophy className="h-3 w-3" /> Best {streak.best}
        </span>
      </div>
    </div>
  );
}
