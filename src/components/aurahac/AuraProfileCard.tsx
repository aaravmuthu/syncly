import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "motion/react";
import confetti from "canvas-confetti";
import { useHac } from "@/lib/hac/store";
import { totalAura, auraTierProgress } from "@/lib/hac/aura";
import { streakMilestone } from "@/lib/hac/streaks";
import { Zap, Flame, Sparkles } from "lucide-react";

/** Crisp neon AP counter that scales up + shimmers on every increase. */
function AuraCounter({ value, onGain }: { value: number; onGain: () => void }) {
  const mv = useMotionValue(value);
  const spring = useSpring(mv, { stiffness: 90, damping: 20, mass: 0.8 });
  const text = useTransform(spring, (v) =>
    Math.round(v).toLocaleString("en-US"),
  );
  const prev = useRef(value);
  const [pop, setPop] = useState(false);

  useEffect(() => {
    mv.set(value);
    if (value > prev.current) {
      setPop(true);
      onGain();
      const t = window.setTimeout(() => setPop(false), 520);
      prev.current = value;
      return () => window.clearTimeout(t);
    }
    prev.current = value;
  }, [value, mv, onGain]);

  return (
    <motion.div
      animate={{ scale: pop ? 1.1 : 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 16 }}
      className="inline-flex items-baseline gap-1.5 will-change-transform"
    >
      <motion.span className="text-5xl font-black tabular-nums text-gradient leading-none">
        {text}
      </motion.span>
      <span className="text-lg font-black tracking-tight" style={{ color: "var(--primary)" }}>
        AP
      </span>
    </motion.div>
  );
}

export function AuraProfileCard() {
  const { data, streak } = useHac();
  const counterRef = useRef<HTMLDivElement>(null);
  const [levelUp, setLevelUp] = useState<{ from: string; to: string } | null>(null);
  const lastTierRef = useRef<string | null>(null);

  if (!data) return null;

  const ap = totalAura(data.courses);
  const prog = auraTierProgress(ap);
  const tier = prog.tier;

  // Detect a rank promotion across renders → trigger breakout overlay.
  useEffect(() => {
    const id = prog.tier.id;
    if (lastTierRef.current && lastTierRef.current !== id) {
      const fromTier = lastTierRef.current;
      setLevelUp({ from: fromTier, to: prog.tier.name });
      const t = window.setTimeout(() => setLevelUp(null), 2000);
      lastTierRef.current = id;
      return () => window.clearTimeout(t);
    }
    lastTierRef.current = id;
  }, [prog.tier.id, prog.tier.name]);

  // Particle shimmer fired by the counter whenever AP rises.
  function flash() {
    const el = counterRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const origin = {
      x: (r.left + r.width / 2) / window.innerWidth,
      y: (r.top + r.height / 2) / window.innerHeight,
    };
    confetti({
      particleCount: 36,
      startVelocity: 22,
      ticks: 90,
      gravity: 0.6,
      scalar: 0.7,
      spread: 360,
      origin,
      colors: [tier.accent, "#ffffff", "#c4b5fd"],
      zIndex: 60,
      disableForReducedMotion: true,
    });
  }

  const milestone = streakMilestone(streak.count);
  const streakLabel =
    streak.count > 0
      ? `${streak.count} Week${streak.count === 1 ? "" : "s"} Consistent A/B Average`
      : "Start your streak — check in daily";

  return (
    <>
      <section
        className="relative rounded-3xl p-5 overflow-hidden"
        style={{
          background: "var(--card)",
          border: tier.border,
          boxShadow: tier.glow,
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
      >
        {/* Tier-tinted ambient wash */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 pointer-events-none opacity-60"
          style={{
            background: `radial-gradient(80% 90% at 80% 0%, color-mix(in oklab, ${tier.accent} 24%, transparent), transparent 70%)`,
          }}
        />

        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2">
            <span
              className="h-8 w-8 grid place-items-center rounded-xl shrink-0"
              style={{ background: tier.background, border: tier.border, boxShadow: tier.glow }}
            >
              <Sparkles className="h-4 w-4" style={{ color: "#fff" }} />
            </span>
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Aura Profile</div>
              <div className="text-sm font-bold" style={{ color: tier.accent }}>
                {tier.name} Tier
              </div>
            </div>
          </div>

          {/* Streak tracker indicator */}
          <div
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full"
            style={{
              background: "color-mix(in oklab, #f59e0b 14%, transparent)",
              border: "1px solid color-mix(in oklab, #f59e0b 38%, transparent)",
              boxShadow: streak.count > 0 ? "0 0 18px -6px #f59e0b" : "none",
            }}
          >
            <Flame className="h-3.5 w-3.5" style={{ color: "#f59e0b" }} />
            <span className="text-[11px] font-bold tabular-nums" style={{ color: "#fbbf24" }}>
              {streak.count}
            </span>
          </div>
        </div>

        {/* Total AP neon counter */}
        <div ref={counterRef} className="mt-4">
          <AuraCounter value={ap} onGain={flash} />
        </div>

        {/* Micro-progression bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
            <span>{tier.name}</span>
            <span>{prog.next ? prog.next.name : "Peak Tier"}</span>
          </div>
          <div
            className="h-1.5 rounded-full overflow-hidden"
            style={{ background: "color-mix(in oklab, var(--foreground) 8%, transparent)" }}
          >
            <motion.div
              className="h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${Math.round(prog.fill * 100)}%` }}
              transition={{ type: "spring", stiffness: 120, damping: 22 }}
              style={{
                background: `linear-gradient(90deg, ${tier.accent}, color-mix(in oklab, ${tier.accent} 40%, #ffffff))`,
                boxShadow: `0 0 14px -2px ${tier.accent}`,
              }}
            />
          </div>
          <div className="mt-1.5 text-[10px] text-muted-foreground tabular-nums">
            {prog.next ? (
              <>
                <span className="font-bold" style={{ color: tier.accent }}>
                  {prog.toNext.toLocaleString("en-US")} AP
                </span>{" "}
                to {prog.next.name}
              </>
            ) : (
              <span className="font-bold" style={{ color: tier.accent }}>
                Maximum rank achieved
              </span>
            )}
          </div>
        </div>

        {/* Streak descriptive subtext */}
        <div className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Zap className="h-3 w-3" style={{ color: "#fbbf24" }} />
          {streakLabel}
          {milestone ? (
            <span className="font-bold" style={{ color: "#fbbf24" }}>
              · {milestone}
            </span>
          ) : null}
        </div>
      </section>

      {/* Rank milestone breakout overlay */}
      <AnimatePresence>
        {levelUp ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="fixed inset-0 z-[80] grid place-items-center pointer-events-none"
            style={{
              background: "color-mix(in oklab, #090915 55%, transparent)",
              backdropFilter: "blur(14px)",
              WebkitBackdropFilter: "blur(14px)",
            }}
          >
            <motion.div
              initial={{ scale: 0.85, y: 16, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 22 }}
              className="text-center px-8"
            >
              <div className="text-[11px] uppercase tracking-[0.4em] text-muted-foreground mb-3">
                Rank Promotion
              </div>
              <motion.div
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                className="text-6xl font-black text-gradient"
              >
                {levelUp.to}
              </motion.div>
              <div className="mt-4 mx-auto h-px w-40" style={{ background: `linear-gradient(90deg, transparent, ${tier.accent}, transparent)` }} />
              <div className="mt-3 text-sm text-muted-foreground">{tier.blurb}</div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
