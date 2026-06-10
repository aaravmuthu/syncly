import { useState } from "react";
import { motion } from "motion/react";
import { useHac } from "@/lib/hac/store";
import { ClassDetail } from "../ClassDetail";
import type { Course } from "@/lib/hac/types";
import { ChevronRight } from "lucide-react";

function pillColor(avg: number, isDominos: boolean) {
  if (isDominos) return "var(--chart-2)"; // lighter accent blue
  if (avg >= 90) return "var(--success)";
  if (avg >= 80) return "var(--primary)";
  if (avg >= 70) return "var(--warning)";
  return "var(--destructive)";
}

export function GradesTab() {
  const { data } = useHac();
  const [open, setOpen] = useState<Course | null>(null);
  if (!data) return null;

  return (
    <div className="space-y-4 pb-32">
      <header className="pt-2">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Marking Period 4</div>
        <h1 className="text-2xl font-bold tracking-tight">Your Classes</h1>
      </header>

      <div className="space-y-3">
        {data.courses.map((c) => {
          const v = c.average ?? 0;
          const isDominos = c.id === "mth2300b-1";
          const color = pillColor(v, isDominos);
          return (
            <motion.button
              key={c.id}
              onClick={() => setOpen(c)}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.985 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              className="glass spotlight w-full px-4 py-4 flex items-center gap-3 text-left rounded-2xl"
              style={{ backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
            >
              <div className="flex-1 min-w-0">
                <div className="text-base font-bold truncate">{c.name}</div>
                <div className="text-xs text-muted-foreground/80 truncate mt-0.5" style={{ color: "color-mix(in oklab, var(--primary) 45%, var(--muted-foreground))" }}>
                  {c.code ?? c.teacher ?? ""}
                </div>
              </div>
              <div
                className="shrink-0 px-3.5 py-1.5 rounded-full font-bold tabular-nums text-sm"
                style={{
                  background: `color-mix(in oklab, ${color} 20%, transparent)`,
                  color,
                  border: `1px solid color-mix(in oklab, ${color} 45%, transparent)`,
                  boxShadow: `0 0 18px -6px ${color}`,
                }}
              >
                {c.average !== null ? c.average.toFixed(2) : "—"}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </motion.button>
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
