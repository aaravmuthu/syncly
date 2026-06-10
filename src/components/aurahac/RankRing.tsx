import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { tierProgress, type TierId } from "@/lib/hac/tiers";

interface Props {
  gpa: number;
  size?: number;
}

/** Liquid-glass academic rank progression ring (Location A — GPA dashboard). */
export function RankRing({ gpa, size = 260 }: Props) {
  // Re-evaluate the tier whenever the (possibly simulated) GPA changes.
  const { tier, next, fill, toNext } = useMemo(() => tierProgress(gpa), [gpa]);
  const [hover, setHover] = useState(false);
  const [pop, setPop] = useState(false);
  const prevTier = useRef<TierId | null>(null);

  // Heavy spring pop + glow flash whenever the tier rank increases.
  useEffect(() => {
    const order = ["vanguard", "lucid", "zenith", "radiant", "apex"];
    const prev = prevTier.current;
    if (prev && prev !== tier.id && order.indexOf(tier.id) > order.indexOf(prev)) {
      setPop(true);
      const t = setTimeout(() => setPop(false), 900);
      prevTier.current = tier.id;
      return () => clearTimeout(t);
    }
    prevTier.current = tier.id;
  }, [tier.id]);

  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - fill);
  const isApex = tier.id === "apex";

  return (
    <div className="relative grid place-items-center select-none" style={{ minHeight: size + 20 }}>
      {/* Tier-tinted ambient aura behind the ring */}
      <div
        aria-hidden
        className="absolute rounded-full pointer-events-none"
        style={{
          width: size * 0.92,
          height: size * 0.92,
          background: tier.background,
          filter: "blur(2px)",
          opacity: 0.5,
          boxShadow: tier.glow,
        }}
      />
      {isApex ? (
        <div
          aria-hidden
          className="absolute rounded-full pointer-events-none tier-spin"
          style={{
            width: size * 0.99,
            height: size * 0.99,
            background:
              "conic-gradient(from 0deg, transparent, rgba(199,154,58,0.55), transparent 30%, rgba(192,132,252,0.6), transparent 60%, rgba(199,154,58,0.5), transparent)",
            filter: "blur(6px)",
          }}
        />
      ) : null}

      <motion.div
        className="relative"
        style={{ width: size, height: size }}
        animate={pop ? { scale: [1, 1.05, 1] } : { scale: 1 }}
        transition={pop ? { type: "spring", stiffness: 320, damping: 12, duration: 0.9 } : { type: "spring", stiffness: 300, damping: 26 }}
        onHoverStart={() => setHover(true)}
        onHoverEnd={() => setHover(false)}
        onTapStart={() => setHover(true)}
        onTap={() => setHover((h) => !h)}
      >
        <svg width={size} height={size} className={`-rotate-90 ${isApex ? "tier-spin" : ""}`}>
          <circle cx={size / 2} cy={size / 2} r={r} stroke="oklch(1 0 0 / 0.07)" strokeWidth={stroke} fill="none" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={tier.accent}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={c}
            strokeDashoffset={offset}
            style={{
              transition: "stroke-dashoffset 800ms cubic-bezier(0.34,1.56,0.64,1), stroke 400ms ease",
              filter: `drop-shadow(0 0 12px ${tier.accent})`,
            }}
          />
        </svg>

        {/* Center readout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.div
            animate={{ opacity: hover ? 0.25 : 1 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col items-center"
          >
            <div
              className="text-[3.4rem] leading-none font-bold tabular-nums"
              style={{ color: lightText ? "#0b1020" : "#ffffff", textShadow: lightText ? "none" : "0 2px 18px rgba(0,0,0,0.45)" }}
            >
              {gpa.toFixed(2)}
            </div>
            <div
              className="mt-2 text-[11px] font-bold uppercase"
              style={{ letterSpacing: "0.32em", color: tier.accent, marginRight: "-0.32em" }}
            >
              {tier.name} Tier
            </div>
          </motion.div>

          {/* Hover tooltip */}
          <AnimatePresence>
            {hover ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 6 }}
                transition={{ type: "spring", stiffness: 420, damping: 26 }}
                className="absolute glass-strong rounded-2xl px-4 py-3 text-center pointer-events-none"
              >
                {next ? (
                  <>
                    <div className="text-2xl font-bold tabular-nums" style={{ color: next.accent }}>
                      +{toNext.toFixed(2)}
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-0.5">
                      GPA to {next.name} Tier
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-base font-bold" style={{ color: tier.accent }}>Apex reached</div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-0.5">
                      Peak academic tier
                    </div>
                  </>
                )}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
