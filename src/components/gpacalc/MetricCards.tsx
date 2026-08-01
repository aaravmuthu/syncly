import { motion } from "motion/react";
import { GraduationCap, Layers, Sparkles, TrendingUp } from "lucide-react";
import type { GpaResult, ResolvedScale } from "@/lib/gpacalc/engine";

interface Props {
  cumulative: GpaResult;
  current: GpaResult;
  scale: ResolvedScale;
  display: "points" | "percent";
  activeYear: string;
}

function fmt(result: GpaResult, key: "weighted" | "unweighted", display: "points" | "percent") {
  if (!result.entries) return "—";
  if (display === "percent") return `${result.percent.toFixed(2)}%`;
  return result[key].toFixed(3);
}

export function MetricCards({ cumulative, current, scale, display, activeYear }: Props) {
  const cards = [
    {
      label: "Cumulative Weighted",
      sub: `${cumulative.credits.toFixed(1)} credits · all years`,
      value: fmt(cumulative, "weighted", display),
      icon: Sparkles,
      max: display === "percent" ? "of 100" : `of ${scale.maxPoints.toFixed(1)}`,
    },
    {
      label: "Cumulative Unweighted",
      sub: "all years on record",
      value: fmt(cumulative, "unweighted", display),
      icon: Layers,
      max: display === "percent" ? "of 100" : "of 4.0",
    },
    {
      label: "Current Year Weighted",
      sub: activeYear || "no active year",
      value: fmt(current, "weighted", display),
      icon: TrendingUp,
      max: display === "percent" ? "of 100" : `of ${scale.maxPoints.toFixed(1)}`,
    },
    {
      label: "Current Year Unweighted",
      sub: `${current.credits.toFixed(1)} credits this year`,
      value: fmt(current, "unweighted", display),
      icon: GraduationCap,
      max: display === "percent" ? "of 100" : "of 4.0",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((c, i) => (
        <motion.div
          key={c.label}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06, duration: 0.4, ease: "easeOut" }}
          className="group relative overflow-hidden rounded-2xl border border-border bg-card/70 p-5 backdrop-blur-xl transition-all duration-300 hover:border-primary/60"
        >
          <div className="pointer-events-none absolute -right-10 -top-10 size-28 rounded-full bg-primary/20 blur-3xl transition-opacity duration-500 group-hover:opacity-100 opacity-60" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {c.label}
            </span>
            <c.icon className="size-4 text-primary" />
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-4xl font-semibold tabular-nums tracking-tight text-foreground">
              {c.value}
            </span>
            <span className="text-xs text-muted-foreground">{c.max}</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{c.sub}</p>
        </motion.div>
      ))}
    </div>
  );
}
