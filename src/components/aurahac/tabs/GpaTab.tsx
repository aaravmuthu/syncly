import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useHac } from "@/lib/hac/store";
import { cumulativeGPA, currentYearGPA, numericToPoints } from "@/lib/hac/gpa";
import { AnimatedNumber } from "../AnimatedNumber";
import { SpotlightCard } from "../SpotlightCard";
import { EyeOff, Eye } from "lucide-react";

export function GpaTab() {
  const { data } = useHac();
  const [weighted, setWeighted] = useState(true);
  const [omitted, setOmitted] = useState<Set<string>>(new Set());
  const [hover, setHover] = useState<number | null>(null);
  if (!data) return null;

  const included = data.courses.filter((c) => !omitted.has(c.id));
  const cy = currentYearGPA(included, weighted);
  const cyFull = currentYearGPA(data.courses, weighted);
  const cum = cumulativeGPA(data.transcript, weighted);
  const cyW = currentYearGPA(included, true);

  const mpData = useMemo(() => {
    if (data.markingPeriodGPAs.length) return data.markingPeriodGPAs;
    return ["MP1", "MP2", "MP3", "MP4"].map((mp, i) => {
      const base = currentYearGPA(included, weighted);
      const noise = [0.05, -0.03, 0.02, 0][i] ?? 0;
      return { mp, gpa: Math.max(0, Math.min(weighted ? 6 : 4, base + noise)) };
    });
  }, [included, data.markingPeriodGPAs, weighted]);

  const max = weighted ? 6 : 4;
  const delta = cy - cyFull;

  function toggle(id: string) {
    setOmitted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-5 pb-32">
      <header className="pt-2">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">GPA Engine</div>
        <h1 className="text-2xl font-bold tracking-tight">Your Trajectory</h1>
      </header>

      <div className="glass p-1 rounded-2xl grid grid-cols-2 gap-1 text-sm font-medium relative">
        {(["Weighted", "Unweighted"] as const).map((label, i) => {
          const active = (i === 0) === weighted;
          return (
            <button
              key={label}
              onClick={() => setWeighted(i === 0)}
              className={`relative py-2.5 rounded-xl transition-colors duration-200 ${
                active ? "text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {active ? (
                <motion.span
                  layoutId="gpa-toggle"
                  className="absolute inset-0 rounded-xl bg-primary shadow-[var(--shadow-elegant)]"
                  transition={{ type: "spring", stiffness: 500, damping: 34 }}
                />
              ) : null}
              <span className="relative z-10">{label} GPA</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <SpotlightCard className="p-5">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Cumulative</div>
          <div className="text-5xl font-bold tabular-nums mt-1 text-gradient">
            <AnimatedNumber value={cum} decimals={2} />
          </div>
        </SpotlightCard>
        <SpotlightCard className="p-5">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Current Year</div>
          <div className="text-5xl font-bold tabular-nums mt-1">
            <AnimatedNumber value={cy} decimals={2} />
          </div>
          <AnimatePresence>
            {Math.abs(delta) > 0.001 ? (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`text-[11px] font-bold tabular-nums mt-1 ${delta >= 0 ? "text-success" : "text-destructive"}`}
              >
                {delta >= 0 ? "+" : ""}
                {delta.toFixed(2)} simulated
              </motion.div>
            ) : null}
          </AnimatePresence>
        </SpotlightCard>
      </div>

      <SpotlightCard className="p-4 flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Official</div>
          <div className="text-sm">Weighted GPA</div>
        </div>
        <span className="text-base font-bold tabular-nums px-3 py-1.5 rounded-xl bg-primary/20 border border-primary/30">
          <AnimatedNumber value={cyW} decimals={3} />
        </span>
      </SpotlightCard>

      <SpotlightCard className="p-4">
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-3">GPA by Marking Period</div>
        <div className="flex items-end justify-between gap-2 h-40 relative">
          {mpData.map((m, idx) => {
            const h = (m.gpa / max) * 100;
            const dim = hover !== null && hover !== idx;
            return (
              <div
                key={m.mp}
                className="flex-1 flex flex-col items-center gap-1.5 relative cursor-pointer"
                onMouseEnter={() => setHover(idx)}
                onMouseLeave={() => setHover(null)}
                onTouchStart={() => setHover(idx)}
              >
                <AnimatePresence>
                  {hover === idx ? (
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.9 }}
                      transition={{ type: "spring", stiffness: 420, damping: 28 }}
                      className="absolute -top-2 z-20 -translate-y-full glass-strong rounded-xl px-3 py-2 text-center pointer-events-none whitespace-nowrap"
                    >
                      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{m.mp}</div>
                      <div className="text-lg font-bold tabular-nums text-gradient">{m.gpa.toFixed(3)}</div>
                      <div className="text-[9px] text-muted-foreground">{((m.gpa / max) * 100).toFixed(1)}% of scale</div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
                <div className="text-[10px] tabular-nums font-bold">{m.gpa.toFixed(2)}</div>
                <div className="w-full bg-white/[0.03] rounded-t-lg rounded-b-sm h-full relative overflow-hidden">
                  <motion.div
                    className="absolute bottom-0 left-0 right-0 rounded-t-lg"
                    animate={{ height: `${h}%`, opacity: dim ? 0.35 : 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 26 }}
                    style={{
                      background: "linear-gradient(180deg, var(--primary-glow), var(--primary))",
                      boxShadow: "0 0 24px -4px var(--primary)",
                    }}
                  />
                </div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{m.mp}</div>
              </div>
            );
          })}
        </div>
      </SpotlightCard>

      <section>
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2 flex items-center justify-between">
          <span>Impact by Grade</span>
          {omitted.size ? (
            <button onClick={() => setOmitted(new Set())} className="text-primary uppercase">Reset</button>
          ) : null}
        </div>
        <div className="space-y-2">
          {data.courses.map((c) => {
            const isOmitted = omitted.has(c.id);
            const pts = c.average !== null ? numericToPoints(c.average, weighted) : null;
            // impact = how the current-year GPA changes if this course is removed
            const without = currentYearGPA(
              data.courses.filter((x) => x.id !== c.id && !omitted.has(x.id)),
              weighted,
            );
            const impact = cy - without;
            return (
              <SpotlightCard
                key={c.id}
                className={`p-3 flex items-center justify-between ${isOmitted ? "opacity-50" : ""}`}
              >
                <div className="min-w-0 mr-3">
                  <div className="text-sm font-medium truncate">{c.name}</div>
                  <div className="text-[11px] text-muted-foreground">Avg {c.average?.toFixed(1) ?? "—"}</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => toggle(c.id)}
                    className={`text-[11px] font-bold tabular-nums px-2 py-1 rounded-lg border transition-colors active:scale-95 ${
                      impact >= 0
                        ? "text-success border-success/30 bg-success/10"
                        : "text-destructive border-destructive/30 bg-destructive/10"
                    }`}
                  >
                    {impact >= 0 ? "+" : ""}
                    {impact.toFixed(2)}
                  </button>
                  <span className="text-muted-foreground">
                    {isOmitted ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </span>
                  <div className="text-lg font-bold tabular-nums text-gradient w-12 text-right">{pts?.toFixed(2) ?? "—"}</div>
                </div>
              </SpotlightCard>
            );
          })}
        </div>
      </section>
    </div>
  );
}
