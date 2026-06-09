import { cn } from "@/lib/utils";
import { letterFromPercent } from "@/lib/gradeway/gpa";

export function GradeBadge({ percent, size = "md" }: { percent: number; size?: "sm" | "md" | "lg" }) {
  const l = letterFromPercent(percent);
  const color =
    l === "A" ? "from-emerald-400/30 to-emerald-400/5 text-emerald-300 border-emerald-400/30" :
    l === "B" ? "from-cyan-400/30 to-cyan-400/5 text-cyan-300 border-cyan-400/30" :
    l === "C" ? "from-amber-400/30 to-amber-400/5 text-amber-300 border-amber-400/30" :
    l === "D" ? "from-orange-400/30 to-orange-400/5 text-orange-300 border-orange-400/30" :
    "from-red-500/30 to-red-500/5 text-red-300 border-red-500/30";
  const sz = size === "lg" ? "h-10 w-10 text-lg" : size === "sm" ? "h-6 w-6 text-xs" : "h-8 w-8 text-sm";
  return (
    <div className={cn("inline-flex items-center justify-center rounded-lg border bg-gradient-to-br font-bold tabular-nums", color, sz)}>
      {l}
    </div>
  );
}