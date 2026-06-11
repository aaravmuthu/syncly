import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { tierProgress } from "@/lib/hac/tiers";

/** Miniature high-gloss rank emblem for the Overview header (Location B). */
export function RankBadge({ gpa }: { gpa: number }) {
  // Subscribe to the live tier object; recompute only when the GPA changes.
  const { tier, next, toNext } = useMemo(() => tierProgress(gpa), [gpa]);
  const [open, setOpen] = useState(false);
  const isApex = tier.id === "apex";

  return (
    <div className="relative">
      <motion.button
        onClick={() => setOpen((o) => !o)}
        whileTap={{ scale: 0.9 }}
        whileHover={{ scale: 1.06 }}
        transition={{ type: "spring", stiffness: 460, damping: 20 }}
        aria-label={`${tier.name} tier`}
        className={`h-11 w-11 grid place-items-center rounded-2xl relative overflow-hidden ${isApex ? "tier-spin" : ""}`}
        style={{
          background: tier.background,
          border: tier.border,
          boxShadow: tier.glow,
        }}
      >
        <span
          className="text-[15px] font-black"
          style={{ color: "#fff", textShadow: "0 1px 6px rgba(0,0,0,0.4)" }}
        >
          {tier.name[0]}
        </span>
      </motion.button>

      <AnimatePresence>
        {open ? (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 420, damping: 26 }}
              className="absolute right-0 top-13 z-50 w-60 glass-strong rounded-2xl p-4"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`h-10 w-10 rounded-xl grid place-items-center shrink-0 ${isApex ? "tier-spin" : ""}`}
                  style={{ background: tier.background, border: tier.border, boxShadow: tier.glow }}
                >
                  <span className="text-sm font-black" style={{ color: "#fff" }}>
                    {tier.name[0]}
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Academic Tier</div>
                  <div className="text-base font-bold" style={{ color: tier.accent }}>{tier.name}</div>
                </div>
                <div className="ml-auto text-right">
                  <div className="text-[9px] uppercase tracking-widest text-muted-foreground">GPA</div>
                  <div className="text-lg font-bold tabular-nums">{gpa.toFixed(2)}</div>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">{tier.blurb}</p>
              {next ? (
                <div className="mt-3 pt-3 border-t border-white/10 text-[11px] flex items-center justify-between">
                  <span className="text-muted-foreground">Next: {next.name}</span>
                  <span className="font-bold tabular-nums" style={{ color: next.accent }}>+{toNext.toFixed(2)}</span>
                </div>
              ) : (
                <div className="mt-3 pt-3 border-t border-white/10 text-[11px] text-center font-bold" style={{ color: tier.accent }}>
                  Peak tier achieved
                </div>
              )}
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
