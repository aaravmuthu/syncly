import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { GlassCard } from "@/components/gradeway/GlassCard";
import { GpaRing } from "@/components/gradeway/GpaRing";
import { GradeBadge } from "@/components/gradeway/GradeBadge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useGradeway } from "@/lib/gradeway/store";
import { courseAverage, cumulativeGpa, unweightedPoints, weightedPoints } from "@/lib/gradeway/gpa";
import type { Tier } from "@/lib/gradeway/types";
import { RotateCcw, Wand2 } from "lucide-react";

export const Route = createFileRoute("/calculator")({
  head: () => ({
    meta: [
      { title: "GPA Simulator · Gradeway" },
      { name: "description", content: "Run perfect what-if scenarios on your grades with weighted and unweighted GPA calculations." },
    ],
  }),
  component: CalculatorPage,
});

function CalculatorPage() {
  const { courses, overrides, setOverride, resetOverrides, tierOverrides, setTierOverride, weighted, setWeighted, semesters } = useGradeway();
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = courses.map((c) => {
    const tier: Tier = tierOverrides[c.id] ?? c.tier;
    const percent = courseAverage(c, overrides);
    return { course: c, tier, percent, credits: c.credits };
  });

  const semGpa = useMemo(() => {
    let uw = 0, w = 0, cr = 0;
    for (const r of rows) {
      uw += unweightedPoints(r.percent) * r.credits;
      w += weightedPoints(r.percent, r.tier) * r.credits;
      cr += r.credits;
    }
    return { unweighted: cr ? uw / cr : 0, weighted: cr ? w / cr : 0, credits: cr };
  }, [rows]);

  const cum = cumulativeGpa(
    semesters.flatMap((s) => s.courses),
    rows.map((r) => ({ percent: r.percent, tier: r.tier, credits: r.credits })),
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Simulator</div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Perfect GPA Calculator</h1>
          <p className="mt-1 text-sm text-muted-foreground">Tweak any score, switch course tiers, and watch your semester and cumulative GPA update instantly.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="glass flex items-center gap-3 px-4 py-2">
            <span className={`text-xs font-medium ${!weighted ? "text-foreground" : "text-muted-foreground"}`}>Unweighted</span>
            <Switch checked={weighted} onCheckedChange={setWeighted} />
            <span className={`text-xs font-medium ${weighted ? "text-foreground" : "text-muted-foreground"}`}>Weighted</span>
          </div>
          <Button variant="ghost" onClick={resetOverrides} className="gap-2"><RotateCcw className="h-4 w-4" /> Reset</Button>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-3">
        <GlassCard className="p-6 flex flex-col items-center">
          <GpaRing value={weighted ? semGpa.weighted : semGpa.unweighted} max={weighted ? 6 : 4} label="This Semester" />
          <div className="mt-3 text-xs text-muted-foreground">{semGpa.credits.toFixed(1)} credit hours</div>
        </GlassCard>
        <GlassCard className="p-6 flex flex-col items-center">
          <GpaRing value={weighted ? cum.weighted : cum.unweighted} max={weighted ? 6 : 4} label="Cumulative" />
          <div className="mt-3 text-xs text-muted-foreground">{cum.totalCredits.toFixed(1)} total credits</div>
        </GlassCard>
        <GlassCard className="p-6">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <Wand2 className="h-3.5 w-3.5" /> Live impact
          </div>
          <ul className="mt-4 space-y-3 text-sm">
            {rows.map((r) => (
              <li key={r.course.id} className="flex items-center justify-between gap-3">
                <span className="truncate text-muted-foreground">{r.course.name}</span>
                <div className="flex items-center gap-2">
                  <span className="tabular-nums">{r.percent.toFixed(1)}%</span>
                  <GradeBadge percent={r.percent} size="sm" />
                  <span className="tabular-nums text-xs text-muted-foreground">{(weighted ? weightedPoints(r.percent, r.tier) : unweightedPoints(r.percent)).toFixed(2)}</span>
                </div>
              </li>
            ))}
          </ul>
        </GlassCard>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Course controls</h2>
        <GlassCard className="p-2" interactive={false}>
          <div className="divide-y divide-border">
            {rows.map((r) => {
              const expanded = openId === r.course.id;
              return (
                <div key={r.course.id} className="p-3">
                  <div className="grid grid-cols-12 items-center gap-3">
                    <div className="col-span-12 md:col-span-4">
                      <div className="font-medium">{r.course.name}</div>
                      <div className="text-xs text-muted-foreground">{r.course.teacher} · {r.credits} cr</div>
                    </div>
                    <div className="col-span-6 md:col-span-3">
                      <Select value={r.tier} onValueChange={(v) => setTierOverride(r.course.id, v as Tier)}>
                        <SelectTrigger className="bg-white/5 border-white/10 h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Regular">Regular / Academic</SelectItem>
                          <SelectItem value="Honors">Honors / Pre-AP (+0.5)</SelectItem>
                          <SelectItem value="AP">AP / IB (+1.0)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3 md:col-span-2 text-right">
                      <div className="text-lg font-semibold tabular-nums text-gradient">{r.percent.toFixed(1)}%</div>
                    </div>
                    <div className="col-span-3 md:col-span-2 flex items-center justify-end gap-2">
                      <GradeBadge percent={r.percent} />
                      <span className="tabular-nums text-sm text-muted-foreground">{(weighted ? weightedPoints(r.percent, r.tier) : unweightedPoints(r.percent)).toFixed(2)}</span>
                    </div>
                    <div className="col-span-12 md:col-span-1 text-right">
                      <Button size="sm" variant="ghost" onClick={() => setOpenId(expanded ? null : r.course.id)}>
                        {expanded ? "Close" : "What-if"}
                      </Button>
                    </div>
                  </div>

                  {expanded && (
                    <div className="mt-4 rounded-xl border border-border bg-white/5 p-4">
                      <div className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">Simulate assignment scores</div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {r.course.assignments.map((a) => {
                          const original = a.outOf ? (a.score / a.outOf) * 100 : 0;
                          const current = overrides[a.id] ?? original;
                          return (
                            <div key={a.id} className="rounded-lg border border-border bg-black/20 p-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-medium">{a.name}</div>
                                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{a.category}</div>
                                </div>
                                <div className="text-sm font-semibold tabular-nums">{current.toFixed(0)}%</div>
                              </div>
                              <Slider
                                className="mt-3"
                                min={0}
                                max={100}
                                step={1}
                                value={[current]}
                                onValueChange={(v) => setOverride(a.id, v[0])}
                              />
                              {overrides[a.id] !== undefined && (
                                <button onClick={() => setOverride(a.id, null)} className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground">
                                  Reset to {original.toFixed(0)}%
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </GlassCard>
      </section>
    </div>
  );
}