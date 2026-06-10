import { useHac } from "@/lib/hac/store";
import { cumulativeGPA, currentYearGPA } from "@/lib/hac/gpa";
import { AlertOctagon, RefreshCcw, GraduationCap, BarChart3 } from "lucide-react";

export function OverviewTab() {
  const { data, refresh, loading } = useHac();
  if (!data) return null;
  const weighted = currentYearGPA(data.courses, true);
  const cum = cumulativeGPA(data.transcript, true);
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
        <button
          onClick={refresh}
          disabled={loading}
          className="glass h-10 w-10 grid place-items-center active:scale-95 transition-all"
        >
          <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <div className="glass p-4">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Weighted GPA</div>
          <div className="text-3xl font-bold tabular-nums mt-1 text-gradient">{weighted.toFixed(2)}</div>
        </div>
        <div className="glass p-4">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Cumulative</div>
          <div className="text-3xl font-bold tabular-nums mt-1">{cum.toFixed(2)}</div>
        </div>
        <div className="glass p-4">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1">
            <GraduationCap className="h-3 w-3" /> Courses
          </div>
          <div className="text-3xl font-bold tabular-nums mt-1">{data.courses.length}</div>
        </div>
        <div className="glass p-4">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1">
            <BarChart3 className="h-3 w-3" /> Avg Class
          </div>
          <div className="text-3xl font-bold tabular-nums mt-1">
            {(
              data.courses.reduce((s, c) => s + (c.average ?? 0), 0) /
              Math.max(1, data.courses.filter((c) => c.average !== null).length)
            ).toFixed(1)}
          </div>
        </div>
      </div>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">High Alert</h2>
          <span className="text-[10px] text-muted-foreground">{missing.length} items</span>
        </div>
        <div className="space-y-2">
          {missing.length === 0 ? (
            <div className="glass p-4 text-sm text-muted-foreground">No missing assignments. You're caught up.</div>
          ) : (
            missing.slice(0, 10).map((m, i) => (
              <div
                key={i}
                className="glass p-3 flex items-center gap-3 border-l-2 border-destructive shadow-[0_0_24px_-8px_oklch(0.68_0.24_25)]"
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
            ))
          )}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-2">Top Classes</h2>
        <div className="space-y-2">
          {data.courses.slice(0, 4).map((c) => (
            <div key={c.id} className="glass p-3 flex items-center justify-between">
              <div className="min-w-0 mr-3">
                <div className="text-sm font-medium truncate">{c.name}</div>
                <div className="text-[11px] text-muted-foreground truncate">{c.teacher ?? ""}</div>
              </div>
              <div
                className="text-xl font-bold tabular-nums"
                style={{
                  color:
                    (c.average ?? 0) >= 90
                      ? "var(--success)"
                      : (c.average ?? 0) >= 80
                        ? "var(--primary)"
                        : (c.average ?? 0) >= 70
                          ? "var(--warning)"
                          : "var(--destructive)",
                }}
              >
                {c.average !== null ? c.average.toFixed(1) : "—"}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}