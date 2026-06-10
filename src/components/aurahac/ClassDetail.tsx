import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { GradeRing } from "./GradeRing";
import { AnimatedNumber } from "./AnimatedNumber";
import { categoryAveragesFromAssignments } from "@/lib/hac/gpa";
import type { Course, Assignment, AssignmentCategory } from "@/lib/hac/types";
import { ArrowLeft, ChevronDown } from "lucide-react";

type SubTab = "grades" | "analysis" | "whatif";

const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: "grades", label: "Grades" },
  { id: "analysis", label: "Analysis" },
  { id: "whatif", label: "What If" },
];

/** Category accent: Assessment = violet/purple, Progress Check = blue. */
function catColor(cat: AssignmentCategory): string {
  if (cat === "Assessment" || cat === "Summative") return "var(--primary)";
  if (cat === "Progress Check" || cat === "Formative") return "var(--chart-2)";
  return "var(--muted-foreground)";
}

function pct(a: Assignment): number | null {
  return a.percent ?? (a.score !== null && a.totalPoints ? (a.score / a.totalPoints) * 100 : null);
}

/** Weighted overall from a list of assignments + category weights. */
function overallFrom(course: Course, assignments: Assignment[]): number | null {
  const weights: Record<string, number> = {};
  for (const ca of course.categoryAverages) if (ca.weight) weights[ca.category] = ca.weight;
  const byCat: Record<string, { sum: number; n: number }> = {};
  for (const a of assignments) {
    const p = pct(a);
    if (p === null) continue;
    if (!byCat[a.category]) byCat[a.category] = { sum: 0, n: 0 };
    byCat[a.category].sum += p;
    byCat[a.category].n += 1;
  }
  let total = 0;
  let den = 0;
  for (const cat of Object.keys(byCat)) {
    const { sum, n } = byCat[cat];
    if (!n) continue;
    const w = weights[cat] ?? 1;
    total += (sum / n) * w;
    den += w;
  }
  return den ? total / den : null;
}

type CatStats = { weights: Record<string, number>; byCat: Record<string, { sum: number; n: number }> };

function statsByCat(course: Course): CatStats {
  const weights: Record<string, number> = {};
  for (const ca of course.categoryAverages) if (ca.weight) weights[ca.category] = ca.weight;
  const byCat: Record<string, { sum: number; n: number }> = {};
  for (const a of course.assignments) {
    const p = pct(a);
    if (p === null) continue;
    byCat[a.category] ??= { sum: 0, n: 0 };
    byCat[a.category].sum += p;
    byCat[a.category].n += 1;
  }
  return { weights, byCat };
}

/** Weighted overall if category `cat` had `extra` additional scores of `value` each. */
function overallWith(course: Course, cat: string, extra: number, value: number): number {
  const { weights, byCat } = statsByCat(course);
  const cats = new Set(Object.keys(byCat));
  cats.add(cat);
  let total = 0;
  let den = 0;
  for (const k of cats) {
    const w = weights[k] ?? 1;
    const base = byCat[k] ?? { sum: 0, n: 0 };
    const sum = k === cat ? base.sum + extra * value : base.sum;
    const n = k === cat ? base.n + extra : base.n;
    if (n === 0) continue;
    total += (sum / n) * w;
    den += w;
  }
  return den ? total / den : 0;
}

/**
 * Exact score needed on ONE more assignment in `cat` to reach `target` overall.
 * Returns the raw number (may be <0 or >100 to signal feasibility).
 */
function scoreNeeded(course: Course, target: number, cat: string): number {
  const { weights, byCat } = statsByCat(course);
  const cats = new Set(Object.keys(byCat));
  cats.add(cat);
  let W = 0;
  let otherSum = 0;
  for (const k of cats) {
    const w = weights[k] ?? 1;
    W += w;
    if (k !== cat) {
      const b = byCat[k];
      const avg = b ? b.sum / b.n : 0;
      otherSum += w * avg;
    }
  }
  const wc = weights[cat] ?? 1;
  const base = byCat[cat] ?? { sum: 0, n: 0 };
  const avgNeeded = (target * W - otherSum) / wc;
  return avgNeeded * (base.n + 1) - base.sum;
}

/** Fewest perfect (100) scores in `cat` to reach `target`, capped at a sane max. */
function perfectsNeeded(course: Course, target: number, cat: string): number | null {
  for (let m = 1; m <= 20; m++) {
    if (overallWith(course, cat, m, 100) >= target - 1e-9) return m;
  }
  return null;
}


export function ClassDetail({
  course,
  onClose,
  initialSub = "grades",
}: {
  course: Course;
  onClose: () => void;
  initialSub?: SubTab;
}) {
  const [sub, setSub] = useState<SubTab>(initialSub);
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [expanded, setExpanded] = useState<string | null>(null);

  const goalCats = useMemo(() => {
    const list = course.categoryAverages.map((c) => c.category);
    if (list.length) return list;
    return Array.from(new Set(course.assignments.map((a) => a.category)));
  }, [course]);
  const [goalCat, setGoalCat] = useState<string>(goalCats[0] ?? "Assessment");
  const [goalText, setGoalText] = useState<string>("");

  const liveCats = useMemo(() => categoryAveragesFromAssignments(course, overrides), [course, overrides]);
  const summative = course.categoryAverages.find((c) => c.category === "Assessment" || c.category === "Summative");
  const formative = course.categoryAverages.find((c) => c.category === "Progress Check" || c.category === "Formative");
  const sumLabel = summative?.category ?? "Assessment of Learning";
  const formLabel = formative?.category ?? "Progress Check for Learning";

  const simAssignments = useMemo<Assignment[]>(
    () => course.assignments.map((a) => (overrides[a.name] !== undefined ? { ...a, percent: overrides[a.name] } : a)),
    [course.assignments, overrides],
  );
  const dirty = Object.keys(overrides).length > 0;
  const overall = dirty ? overallFrom(course, simAssignments) ?? course.average : course.average;
  const sumAvg = (dirty ? liveCats[summative?.category ?? ""] : undefined) ?? summative?.average ?? null;
  const formAvg = (dirty ? liveCats[formative?.category ?? ""] : undefined) ?? formative?.average ?? null;

  // Impact analysis: how much each assignment moves the overall grade.
  const impacts = useMemo(() => {
    const base = overallFrom(course, course.assignments);
    return course.assignments.map((a) => {
      const without = course.assignments.filter((x) => x.name !== a.name);
      const wo = overallFrom(course, without);
      const delta = base !== null && wo !== null ? base - wo : 0;
      return { a, delta };
    });
  }, [course]);

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <motion.div
        initial={{ y: 60, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        className="glass-strong w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[92vh] flex flex-col"
        style={{ backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
      >
        <header className="flex items-start gap-3 p-5 pb-3 shrink-0">
          <button onClick={onClose} className="glass h-9 w-9 grid place-items-center active:scale-95 rounded-xl">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold truncate">{course.name}</h2>
            <div className="text-xs text-muted-foreground truncate">
              {course.code ?? ""} {course.teacher ? `· ${course.teacher}` : ""}
            </div>
          </div>
        </header>

        {/* Sub-tab pill container */}
        <div className="px-5 shrink-0">
          <div className="relative flex p-1 rounded-2xl bg-white/[0.04] border border-white/10">
            {SUB_TABS.map((t) => {
              const active = sub === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setSub(t.id)}
                  className={`relative flex-1 py-2 text-xs font-semibold rounded-xl transition-colors z-10 ${
                    active ? "text-white" : "text-muted-foreground"
                  }`}
                >
                  {active ? (
                    <motion.span
                      layoutId="subtab-pill"
                      className="absolute inset-0 rounded-xl"
                      style={{ background: "var(--primary)", boxShadow: "0 0 20px -6px var(--primary)" }}
                      transition={{ type: "spring", stiffness: 500, damping: 34 }}
                    />
                  ) : null}
                  <span className="relative z-10">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-6 pt-4 space-y-3">
          {sub === "grades" ? (
            <>
              {/* Top metrics grid */}
              <div className="grid grid-cols-[auto_1fr] gap-3 items-stretch">
                <div className="glass rounded-2xl grid place-items-center p-2" style={{ backdropFilter: "blur(12px)" }}>
                  <GradeRing value={overall} size={150} label="Overall" />
                </div>
                <div className="flex flex-col gap-3">
                  <MetricRow label={sumLabel} value={sumAvg} color={catColor("Assessment")} />
                  <MetricRow label={formLabel} value={formAvg} color={catColor("Progress Check")} />
                </div>
              </div>

              {/* Assignment feed */}
              <div className="space-y-2 pt-1">
                {course.assignments.map((a, i) => (
                  <div
                    key={i}
                    className="glass rounded-2xl p-3 pl-2 flex items-center gap-3"
                    style={{ backdropFilter: "blur(12px)" }}
                  >
                    <span className="w-1.5 self-stretch rounded-full shrink-0" style={{ background: catColor(a.category) }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{a.name}</div>
                      <div className="text-[11px] text-muted-foreground">{a.dueDate}</div>
                    </div>
                    <div className="shrink-0 px-3 py-1.5 rounded-xl text-sm font-semibold tabular-nums bg-white/[0.08] text-foreground">
                      {(pct(a) ?? 0).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          {sub === "analysis" ? (
            <>
              <div className="glass rounded-2xl p-4" style={{ backdropFilter: "blur(12px)" }}>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
                  Score Over Marking Period
                </div>
                <div className="flex items-end gap-2 h-40">
                  {[...course.assignments].reverse().map((a, i) => {
                    const p = pct(a) ?? 0;
                    const h = Math.max(4, ((Math.min(100, Math.max(70, p)) - 70) / 30) * 100);
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1.5">
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${h}%` }}
                          transition={{ type: "spring", stiffness: 200, damping: 24, delay: i * 0.04 }}
                          className="w-full rounded-t-md"
                          style={{ background: "var(--primary)", boxShadow: "0 0 14px -4px var(--primary)" }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-[9px] text-muted-foreground mt-2">
                  <span>70</span>
                  <span>Scaled 70–100</span>
                  <span>100</span>
                </div>
              </div>

              <div className="text-[10px] uppercase tracking-widest text-muted-foreground pt-1">Impact By Grade</div>
              <div className="space-y-2">
                {impacts.map(({ a, delta }, i) => {
                  const positive = delta >= 0;
                  const color = positive ? "var(--success)" : "var(--destructive)";
                  return (
                    <div
                      key={i}
                      className="glass rounded-2xl p-3 pl-2 flex items-center gap-3"
                      style={{ backdropFilter: "blur(12px)" }}
                    >
                      <span className="w-1.5 self-stretch rounded-full shrink-0" style={{ background: catColor(a.category) }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{a.name}</div>
                        <div className="text-[11px] text-muted-foreground">{a.dueDate}</div>
                      </div>
                      <div
                        className="shrink-0 px-3 py-1.5 rounded-xl text-sm font-bold tabular-nums"
                        style={{
                          background: `color-mix(in oklab, ${color} 18%, transparent)`,
                          color,
                          border: `1px solid color-mix(in oklab, ${color} 40%, transparent)`,
                        }}
                      >
                        {positive ? "+" : ""}
                        {delta.toFixed(2)}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}

          {sub === "whatif" ? (
            <>
              <div className="grid grid-cols-[auto_1fr] gap-3 items-center">
                <div className="glass rounded-2xl grid place-items-center p-2">
                  <GradeRing value={overall} size={140} label={dirty ? "Simulated" : "Overall"} />
                </div>
                <div className="space-y-2">
                  <MetricRow label={sumLabel} value={sumAvg} color={catColor("Assessment")} />
                  <MetricRow label={formLabel} value={formAvg} color={catColor("Progress Check")} />
                  {dirty ? (
                    <button onClick={() => setOverrides({})} className="text-primary uppercase text-[10px] tracking-widest">
                      Reset simulation
                    </button>
                  ) : null}
                </div>
              </div>

              <GoalSeeker
                course={course}
                cats={goalCats}
                goalCat={goalCat}
                setGoalCat={setGoalCat}
                goalText={goalText}
                setGoalText={setGoalText}
              />



              <div className="space-y-2 pt-1">
                {course.assignments.map((a, i) => {
                  const baseline = pct(a) ?? 0;
                  const current = overrides[a.name] ?? baseline;
                  const isOpen = expanded === a.name;
                  return (
                    <div key={i} className="glass rounded-2xl p-3 pl-2" style={{ backdropFilter: "blur(12px)" }}>
                      <button
                        className="w-full flex items-center gap-3 text-left"
                        onClick={() => setExpanded(isOpen ? null : a.name)}
                      >
                        <span className="w-1.5 self-stretch rounded-full shrink-0" style={{ background: catColor(a.category) }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{a.name}</div>
                          <div className="text-[11px] text-muted-foreground">{a.dueDate}</div>
                        </div>
                        <span className="text-sm font-bold tabular-nums text-primary">
                          <AnimatedNumber value={Number.isFinite(current) ? current : 0} decimals={0} />
                        </span>
                        <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ type: "spring", stiffness: 400, damping: 26 }}>
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        </motion.span>
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
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>
      </motion.div>
    </div>
  );
}

function MetricRow({ label, value, color }: { label: string; value: number | null; color: string }) {
  return (
    <div className="glass rounded-2xl p-3 flex items-center gap-3" style={{ backdropFilter: "blur(12px)" }}>
      <span
        className="h-9 w-9 rounded-lg shrink-0"
        style={{ background: `color-mix(in oklab, ${color} 35%, transparent)`, border: `1px solid ${color}`, boxShadow: `0 0 16px -4px ${color}` }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-muted-foreground truncate">{label}</div>
        <div className="text-xl font-bold tabular-nums">
          {value !== null ? <AnimatedNumber value={value} decimals={2} /> : "—"}
        </div>
      </div>
    </div>
  );
}
