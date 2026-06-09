import { createFileRoute } from "@tanstack/react-router";
import { GpaRing } from "@/components/gradeway/GpaRing";
import { GlassCard } from "@/components/gradeway/GlassCard";
import { ClassCard } from "@/components/gradeway/ClassCard";
import { Sparkline } from "@/components/gradeway/Sparkline";
import { useCourseRows, useCumulativeGpa, useGradeway } from "@/lib/gradeway/store";
import { mockTrend } from "@/lib/gradeway/mockData";
import { AlertTriangle, Clock, TrendingUp, Award, BookOpen } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard · Gradeway" },
      { name: "description", content: "Your real-time grade overview, GPA, and class breakdown." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { studentName, weighted } = useGradeway();
  const gpa = useCumulativeGpa();
  const rows = useCourseRows();
  const courses = rows.map((r) => r.course);
  const missing = courses.reduce((n, c) => n + c.assignments.filter((a) => a.missing).length, 0);
  const next = courses[0];
  const trendDelta = mockTrend[mockTrend.length - 1] - mockTrend[0];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Welcome back</div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{studentName}</h1>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Semester · Spring 2026</div>
          <div className="text-sm">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</div>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-3">
        <GlassCard className="lg:col-span-1 flex flex-col items-center justify-center p-8">
          <GpaRing value={weighted ? gpa.weighted : gpa.unweighted} max={weighted ? 6 : 4} label={weighted ? "Weighted GPA" : "Unweighted GPA"} />
          <div className="mt-6 grid w-full grid-cols-2 gap-3 text-center">
            <div className="rounded-xl border border-border bg-white/5 p-3">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Unweighted</div>
              <div className="text-lg font-semibold tabular-nums">{gpa.unweighted.toFixed(2)}</div>
            </div>
            <div className="rounded-xl border border-border bg-white/5 p-3">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Weighted</div>
              <div className="text-lg font-semibold tabular-nums">{gpa.weighted.toFixed(2)}</div>
            </div>
          </div>
        </GlassCard>

        <div className="lg:col-span-2 grid gap-4 sm:grid-cols-2">
          <StatCard icon={<Award className="h-4 w-4" />} label="Class Rank" value="14" sub="of 482 · Top 3%" />
          <StatCard icon={<BookOpen className="h-4 w-4" />} label="Total Credits" value={gpa.totalCredits.toFixed(1)} sub="Cumulative earned" />
          <StatCard
            icon={<Clock className="h-4 w-4" />}
            label="Next Class"
            value={next ? next.name.split(" ").slice(0, 2).join(" ") : "—"}
            sub={next ? `Room ${next.room} · Period ${next.period}` : ""}
          />
          <StatCard
            icon={<AlertTriangle className="h-4 w-4" />}
            label="Alerts"
            value={String(missing)}
            sub={missing ? "Missing assignments" : "All caught up"}
            tone={missing > 0 ? "warn" : "ok"}
          />
          <GlassCard className="p-5 sm:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                  <TrendingUp className="h-3.5 w-3.5" /> 7-Day Trend
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <div className="text-2xl font-semibold tabular-nums">{mockTrend[mockTrend.length - 1].toFixed(1)}%</div>
                  <div className={`text-xs font-medium ${trendDelta >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                    {trendDelta >= 0 ? "▲" : "▼"} {Math.abs(trendDelta).toFixed(1)}
                  </div>
                </div>
              </div>
              <Sparkline data={mockTrend} width={220} height={60} />
            </div>
          </GlassCard>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Active Classes</h2>
          <span className="text-xs text-muted-foreground">{courses.length} courses</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((c) => (
            <ClassCard key={c.id} course={c} />
          ))}
        </div>
      </section>
    </div>
  );
}

function StatCard({ icon, label, value, sub, tone = "neutral" }: { icon: React.ReactNode; label: string; value: string; sub: string; tone?: "neutral" | "warn" | "ok" }) {
  const accent = tone === "warn" ? "text-amber-300" : tone === "ok" ? "text-emerald-300" : "text-foreground";
  return (
    <GlassCard className="p-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
        {icon} {label}
      </div>
      <div className={`mt-3 text-2xl font-bold tabular-nums ${accent}`}>{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
    </GlassCard>
  );
}
