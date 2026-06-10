import { useMemo } from "react";
import { motion } from "motion/react";
import { useHac } from "@/lib/hac/store";
import { courseDisplay } from "@/lib/hac/customize";
import { Sparkles, CalendarClock, ChevronRight, GraduationCap, FileText, FlaskConical } from "lucide-react";

function parseSlash(s: string | null): number | null {
  if (!s) return null;
  const [m, d, y] = s.split("/").map(Number);
  if (!m || !d || !y) return null;
  return new Date(y, m - 1, d).getTime();
}

function parseIso(s: string): number | null {
  const t = new Date(s + "T00:00:00").getTime();
  return Number.isFinite(t) ? t : null;
}

function relDays(ts: number): string {
  const days = Math.round((ts - Date.now()) / 86_400_000);
  if (days < 0) return `${Math.abs(days)}d ago`;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 7) return `In ${days}d`;
  return `In ${Math.round(days / 7)}w`;
}

function scoreColor(v: number): string {
  if (v >= 95) return "var(--primary)";
  if (v >= 90) return "var(--success)";
  if (v >= 80) return "var(--warning)";
  return "var(--destructive)";
}

/**
 * Desktop-only intelligence rail. Surfaces freshly-updated grades and upcoming
 * work so students see what changed without clicking into each sub-menu.
 * Hidden below the lg breakpoint where the mobile bottom-nav takes over.
 */
export function DesktopSidebar() {
  const { data, userEvents, completed, courseCustom, setCourseNav } = useHac();

  const recent = useMemo(() => {
    if (!data) return [];
    return data.courses
      .flatMap((c) =>
        c.assignments
          .filter((a) => a.percent !== null && a.dueDate)
          .map((a) => ({ course: c, a, ts: parseSlash(a.dueDate) ?? 0 })),
      )
      .sort((x, y) => y.ts - x.ts)
      .slice(0, 6);
  }, [data]);

  const upcoming = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const floor = start.getTime();
    const items = userEvents
      .filter((e) => !completed[e.id])
      .map((e) => ({ e, ts: parseIso(e.date) ?? 0 }))
      .filter((x) => x.ts >= floor)
      .sort((a, b) => a.ts - b.ts)
      .slice(0, 8);
    return items;
  }, [userEvents, completed]);

  if (!data) return null;

  return (
    <aside className="hidden lg:flex flex-col w-[300px] shrink-0 h-full border-r border-white/10 overflow-y-auto px-4 py-6 gap-6">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-1">
        <div
          className="h-9 w-9 rounded-xl grid place-items-center"
          style={{
            background: "color-mix(in oklab, var(--primary) 18%, transparent)",
            border: "1px solid color-mix(in oklab, var(--primary) 40%, transparent)",
            boxShadow: "0 0 18px -6px var(--primary)",
          }}
        >
          <GraduationCap className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold tracking-tight truncate">{data.student.name}</div>
          <div className="text-[11px] text-muted-foreground truncate">{data.student.school ?? "AuraHAC"}</div>
        </div>
      </div>

      {/* Grades updated today */}
      <section>
        <div className="flex items-center gap-1.5 mb-2.5 px-1">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Recently Updated
          </h2>
        </div>
        <div className="space-y-1.5">
          {recent.length ? (
            recent.map(({ course, a, ts }, i) => {
              const v = a.percent ?? 0;
              const color = scoreColor(v);
              const disp = courseDisplay(course, courseCustom[course.id]);
              return (
                <motion.button
                  key={`${course.id}-${a.name}-${i}`}
                  whileHover={{ x: 2 }}
                  onClick={() => setCourseNav({ courseId: course.id, sub: "analysis" })}
                  className="w-full liquid rounded-xl p-2.5 flex items-center gap-2.5 text-left min-h-[56px]"
                  style={{ border: "1px solid rgba(255,255,255,0.05)" }}
                >
                  <span
                    className="shrink-0 px-2 py-1.5 rounded-lg font-bold tabular-nums text-xs grid place-items-center min-w-[44px]"
                    style={{
                      background: `color-mix(in oklab, ${color} 20%, transparent)`,
                      color,
                      border: `1px solid color-mix(in oklab, ${color} 45%, transparent)`,
                    }}
                  >
                    {v.toFixed(0)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold truncate">{a.name}</span>
                    <span className="block text-[10px] text-muted-foreground truncate">
                      {disp.emoji ? `${disp.emoji} ` : ""}{disp.name} · {ts ? relDays(ts) : ""}
                    </span>
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </motion.button>
              );
            })
          ) : (
            <div className="liquid rounded-xl p-3 text-[11px] text-muted-foreground">No grades yet.</div>
          )}
        </div>
      </section>

      {/* Upcoming assignments */}
      <section>
        <div className="flex items-center gap-1.5 mb-2.5 px-1">
          <CalendarClock className="h-3.5 w-3.5 text-primary" />
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Upcoming
          </h2>
        </div>
        <div className="space-y-1.5">
          {upcoming.length ? (
            upcoming.map(({ e, ts }) => {
              const exam = e.type === "exam";
              const Icon = exam ? FlaskConical : FileText;
              const color = exam ? "var(--primary)" : "var(--chart-2)";
              return (
                <div
                  key={e.id}
                  className="w-full liquid rounded-xl p-2.5 flex items-center gap-2.5 min-h-[56px]"
                  style={{ border: "1px solid rgba(255,255,255,0.05)" }}
                >
                  <span
                    className="shrink-0 h-8 w-8 rounded-lg grid place-items-center"
                    style={{ background: `color-mix(in oklab, ${color} 18%, transparent)` }}
                  >
                    <Icon className="h-4 w-4" style={{ color }} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold truncate">{e.title}</span>
                    <span className="block text-[10px] text-muted-foreground truncate">
                      {e.course ?? "Personal"}
                    </span>
                  </span>
                  <span
                    className="shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-md"
                    style={{ background: `color-mix(in oklab, ${color} 16%, transparent)`, color }}
                  >
                    {ts ? relDays(ts) : ""}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="liquid rounded-xl p-3 text-[11px] text-muted-foreground">
              Nothing scheduled. Add work in the Calendar tab.
            </div>
          )}
        </div>
      </section>
    </aside>
  );
}
