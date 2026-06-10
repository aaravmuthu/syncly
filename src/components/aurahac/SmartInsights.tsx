import { motion } from "motion/react";
import { useHac } from "@/lib/hac/store";
import { topInsights, type GradeInsight } from "@/lib/hac/insights";
import { Sparkles, TrendingUp, ShieldCheck, Trophy, ChevronRight } from "lucide-react";

function toneStyle(tone: GradeInsight["tone"]): { color: string; Icon: typeof TrendingUp } {
  if (tone === "hold") return { color: "var(--warning)", Icon: ShieldCheck };
  if (tone === "ace") return { color: "var(--success)", Icon: Trophy };
  return { color: "var(--primary)", Icon: TrendingUp };
}

/**
 * Friendly, actionable grade insights. Tapping one jumps straight into that
 * course's What-If simulator so the student can see what pushes them over.
 */
export function SmartInsights() {
  const { data, courseCustom, setCourseNav } = useHac();
  if (!data) return null;

  const insights = topInsights(data.courses, courseCustom, 4);
  if (!insights.length) return null;

  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Smart Insights
        </h2>
      </div>
      <div className="space-y-2">
        {insights.map((ins, i) => {
          const { color, Icon } = toneStyle(ins.tone);
          return (
            <motion.button
              key={ins.courseId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, type: "spring", stiffness: 300, damping: 28 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setCourseNav({ courseId: ins.courseId, sub: "whatif" })}
              className="liquid w-full rounded-2xl p-3.5 flex items-center gap-3 text-left"
              style={{ border: `1px solid color-mix(in oklab, ${color} 28%, transparent)` }}
            >
              <span
                className="h-10 w-10 shrink-0 rounded-xl grid place-items-center"
                style={{
                  background: `color-mix(in oklab, ${color} 18%, transparent)`,
                  boxShadow: `0 0 18px -8px ${color}`,
                }}
              >
                {ins.emoji ? (
                  <span className="text-lg">{ins.emoji}</span>
                ) : (
                  <Icon className="h-5 w-5" style={{ color }} />
                )}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-foreground leading-snug">{ins.message}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{ins.hint}</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}
