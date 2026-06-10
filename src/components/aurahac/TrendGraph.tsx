import { useId } from "react";
import { motion } from "motion/react";

export interface TrendPoint {
  label: string;
  value: number;
}

/**
 * Clean animated line graph showing a value's trajectory over time
 * (e.g. GPA across marking periods). Pure SVG — no external chart lib.
 */
export function TrendGraph({
  points,
  max,
  min = 0,
  height = 140,
  accent = "var(--primary)",
}: {
  points: TrendPoint[];
  max: number;
  min?: number;
  height?: number;
  accent?: string;
}) {
  const uid = useId().replace(/[:]/g, "");
  const W = 300;
  const H = height;
  const padX = 14;
  const padY = 18;

  if (points.length < 2) {
    return (
      <div className="h-[140px] grid place-items-center text-xs text-muted-foreground">
        Not enough history yet — check back after the next marking period.
      </div>
    );
  }

  const span = Math.max(0.0001, max - min);
  const xFor = (i: number) => padX + (i / (points.length - 1)) * (W - padX * 2);
  const yFor = (v: number) => padY + (1 - (Math.max(min, Math.min(max, v)) - min) / span) * (H - padY * 2);

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(p.value)}`).join(" ");
  const areaPath = `${linePath} L ${xFor(points.length - 1)} ${H - padY} L ${xFor(0)} ${H - padY} Z`;

  const first = points[0].value;
  const last = points[points.length - 1].value;
  const rising = last >= first;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }} preserveAspectRatio="none">
        <defs>
          <linearGradient id={`fill-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.32" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Subtle gridlines */}
        {[0.25, 0.5, 0.75].map((g) => (
          <line
            key={g}
            x1={padX}
            x2={W - padX}
            y1={padY + g * (H - padY * 2)}
            y2={padY + g * (H - padY * 2)}
            stroke="currentColor"
            strokeOpacity="0.06"
            strokeWidth="1"
          />
        ))}

        <motion.path
          d={areaPath}
          fill={`url(#fill-${uid})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
        />
        <motion.path
          d={linePath}
          fill="none"
          stroke={accent}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, ease: "easeInOut" }}
          style={{ filter: `drop-shadow(0 0 6px color-mix(in oklab, ${accent} 60%, transparent))` }}
        />

        {points.map((p, i) => (
          <motion.circle
            key={i}
            cx={xFor(i)}
            cy={yFor(p.value)}
            r={i === points.length - 1 ? 4 : 2.5}
            fill={i === points.length - 1 ? accent : "var(--background)"}
            stroke={accent}
            strokeWidth="2"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3 + i * 0.08, type: "spring", stiffness: 400, damping: 20 }}
          />
        ))}
      </svg>

      <div className="flex justify-between mt-1 px-1">
        {points.map((p, i) => (
          <span key={i} className="text-[9px] uppercase tracking-wider text-muted-foreground">
            {p.label}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between mt-2 text-[11px]">
        <span className="text-muted-foreground">Trajectory</span>
        <span
          className="font-bold tabular-nums"
          style={{ color: rising ? "var(--success)" : "var(--destructive)" }}
        >
          {rising ? "▲" : "▼"} {(last - first >= 0 ? "+" : "") + (last - first).toFixed(2)}
        </span>
      </div>
    </div>
  );
}
