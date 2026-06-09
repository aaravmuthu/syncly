import { createFileRoute } from "@tanstack/react-router";
import { GlassCard } from "@/components/gradeway/GlassCard";
import { GradeBadge } from "@/components/gradeway/GradeBadge";
import { useGradeway } from "@/lib/gradeway/store";
import { semesterGpaFromCourses } from "@/lib/gradeway/gpa";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, Area, AreaChart, CartesianGrid } from "recharts";

export const Route = createFileRoute("/transcript")({
  head: () => ({
    meta: [
      { title: "Transcript · Gradeway" },
      { name: "description", content: "An interactive academic transcript with GPA trajectory and semester-by-semester breakdown." },
    ],
  }),
  component: TranscriptPage,
});

function TranscriptPage() {
  const { semesters } = useGradeway();

  const trajectory = semesters.map((s) => {
    const g = semesterGpaFromCourses(s.courses.map((c) => ({ percent: c.finalGrade, tier: c.tier, credits: c.credits })));
    return { label: `${s.year === 9 ? "Fr" : s.year === 10 ? "So" : s.year === 11 ? "Jr" : "Sr"} ${s.term}`, gpa: +g.weighted.toFixed(3), unweighted: +g.unweighted.toFixed(3) };
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Academic History</div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Transcript</h1>
      </header>

      <GlassCard className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">GPA Trajectory</div>
            <div className="text-sm">Weighted vs Unweighted</div>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--color-primary)]" /> Weighted</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--color-accent)]" /> Unweighted</span>
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trajectory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gW" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gU" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="oklch(1 0 0 / 0.05)" vertical={false} />
              <XAxis dataKey="label" stroke="oklch(1 0 0 / 0.4)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis domain={[3, 6]} stroke="oklch(1 0 0 / 0.4)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: "rgba(15,20,30,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, backdropFilter: "blur(12px)" }}
                labelStyle={{ color: "#fff" }}
              />
              <Area type="monotone" dataKey="gpa" stroke="var(--color-primary)" strokeWidth={2.5} fill="url(#gW)" />
              <Area type="monotone" dataKey="unweighted" stroke="var(--color-accent)" strokeWidth={2} fill="url(#gU)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      <section className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-px bg-gradient-to-b from-primary/40 via-accent/30 to-transparent md:left-6" />
        <div className="space-y-5">
          {semesters.map((s) => {
            const g = semesterGpaFromCourses(s.courses.map((c) => ({ percent: c.finalGrade, tier: c.tier, credits: c.credits })));
            return (
              <div key={s.id} className="relative pl-10 md:pl-14">
                <span className="absolute left-2 top-6 h-3 w-3 rounded-full bg-gradient-to-br from-primary to-accent glow-primary md:left-4" />
                <GlassCard className="p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <h3 className="text-lg font-semibold">{s.label}</h3>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>UW <span className="text-foreground font-semibold tabular-nums">{g.unweighted.toFixed(2)}</span></span>
                      <span>W <span className="text-foreground font-semibold tabular-nums">{g.weighted.toFixed(2)}</span></span>
                      <span>{g.totalCredits.toFixed(1)} cr</span>
                    </div>
                  </div>
                  <table className="mt-4 w-full text-sm">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-widest text-muted-foreground">
                        <th className="py-2 font-medium">Course</th>
                        <th className="py-2 font-medium">Tier</th>
                        <th className="py-2 font-medium text-right">Credits</th>
                        <th className="py-2 font-medium text-right">Final</th>
                        <th className="py-2 font-medium text-right">Grade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {s.courses.map((c) => (
                        <tr key={c.id}>
                          <td className="py-2.5 font-medium">{c.name}</td>
                          <td className="py-2.5 text-muted-foreground">{c.tier}</td>
                          <td className="py-2.5 text-right tabular-nums">{c.credits.toFixed(1)}</td>
                          <td className="py-2.5 text-right tabular-nums">{c.finalGrade}%</td>
                          <td className="py-2.5"><div className="flex justify-end"><GradeBadge percent={c.finalGrade} size="sm" /></div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </GlassCard>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}