import { motion } from "motion/react";
import { MARKING_PERIODS, type MarkingPeriod } from "@/lib/hac/marking";

/**
 * Glassmorphic horizontal slider track for the four marking periods. A neon
 * accent capsule slides behind the active segment with a smooth spring layout
 * animation. `layoutKey` keeps the capsule unique when multiple sliders mount.
 */
export function MarkingPeriodSlider({
  value,
  onChange,
  layoutKey = "mp-pill",
}: {
  value: MarkingPeriod;
  onChange: (p: MarkingPeriod) => void;
  layoutKey?: string;
}) {
  return (
    <div
      className="relative flex p-1 rounded-2xl bg-white/[0.04] border border-white/10"
      style={{ backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
    >
      {MARKING_PERIODS.map((p) => {
        const active = value === p;
        return (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`relative flex-1 py-2 text-xs font-semibold rounded-xl transition-colors z-10 ${
              active ? "text-[#090915]" : "text-muted-foreground"
            }`}
          >
            {active ? (
              <motion.span
                layoutId={layoutKey}
                className="absolute inset-0 rounded-xl"
                style={{ background: "var(--primary)", boxShadow: "0 0 14px -3px var(--primary)" }}
                transition={{ type: "spring", stiffness: 500, damping: 34 }}
              />
            ) : null}
            <span className="relative z-10">{p}</span>
          </button>
        );
      })}
    </div>
  );
}
