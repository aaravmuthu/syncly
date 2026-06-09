import { useState } from "react";
import { ChevronDown, User, MapPin } from "lucide-react";
import { GlassCard } from "./GlassCard";
import { GradeBadge } from "./GradeBadge";
import { useGradeway } from "@/lib/gradeway/store";
import { courseAverage } from "@/lib/gradeway/gpa";
import type { Course } from "@/lib/gradeway/types";
import { cn } from "@/lib/utils";

export function ClassCard({ course }: { course: Course }) {
  const { overrides } = useGradeway();
  const [open, setOpen] = useState(false);
  const pct = courseAverage(course, overrides);

  return (
    <GlassCard className="p-5">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-start justify-between gap-4 text-left">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded-md border border-border bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{course.tier}</span>
            <span className="text-xs text-muted-foreground">Period {course.period}</span>
          </div>
          <h3 className="mt-2 truncate text-lg font-semibold">{course.name}</h3>
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><User className="h-3 w-3" />{course.teacher}</span>
            <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />Room {course.room}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="text-2xl font-bold tabular-nums text-gradient">{pct.toFixed(1)}%</div>
          <div className="flex items-center gap-2">
            <GradeBadge percent={pct} />
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
          </div>
        </div>
      </button>
      <div className={cn("grid transition-all duration-300", open ? "mt-4 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
        <div className="overflow-hidden">
          <div className="border-t border-border pt-4">
            <div className="mb-3 flex flex-wrap gap-2">
              {course.categories.map((c) => (
                <span key={c.name} className="rounded-full border border-border bg-white/5 px-3 py-1 text-xs">
                  {c.name} <span className="text-muted-foreground">· {Math.round(c.weight * 100)}%</span>
                </span>
              ))}
            </div>
            <ul className="divide-y divide-border">
              {course.assignments.map((a) => {
                const score = a.outOf ? (a.score / a.outOf) * 100 : 0;
                return (
                  <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{a.name}</span>
                        {a.missing && (
                          <span className="rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-300">Missing</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">{a.category}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground tabular-nums">{a.score}/{a.outOf}</span>
                      <span className="w-12 text-right text-sm font-semibold tabular-nums">{score.toFixed(0)}%</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}