import { useState } from "react";
import { useHac } from "@/lib/hac/store";
import { ClassDetail } from "../ClassDetail";
import type { Course } from "@/lib/hac/types";
import { ChevronRight } from "lucide-react";

export function GradesTab() {
  const { data } = useHac();
  const [open, setOpen] = useState<Course | null>(null);
  if (!data) return null;

  return (
    <div className="space-y-4 pb-32">
      <header className="pt-2">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Live Gradebook</div>
        <h1 className="text-2xl font-bold tracking-tight">Your Classes</h1>
      </header>

      <div className="space-y-2">
        {data.courses.map((c) => {
          const v = c.average ?? 0;
          const color =
            v >= 90 ? "var(--success)" : v >= 80 ? "var(--primary)" : v >= 70 ? "var(--warning)" : "var(--destructive)";
          return (
            <button
              key={c.id}
              onClick={() => setOpen(c)}
              className="glass w-full p-4 flex items-center gap-3 text-left active:scale-[0.98] transition-all duration-200 hover:bg-white/[0.04]"
            >
              <div
                className="h-12 w-12 rounded-2xl grid place-items-center shrink-0"
                style={{ background: `color-mix(in oklab, ${color} 18%, transparent)`, boxShadow: `0 0 24px -6px ${color}` }}
              >
                <span className="font-bold tabular-nums text-sm" style={{ color }}>
                  {c.average !== null ? c.average.toFixed(0) : "—"}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{c.name}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {c.teacher ?? ""} {c.period ? `· P${c.period}` : ""}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{c.assignments.length} assignments</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          );
        })}
        {data.courses.length === 0 ? (
          <div className="glass p-6 text-center text-sm text-muted-foreground">
            No courses parsed from your portal. Try refreshing on the Overview tab.
          </div>
        ) : null}
      </div>

      {open ? <ClassDetail course={open} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}