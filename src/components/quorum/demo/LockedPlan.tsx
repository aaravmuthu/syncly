import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Check, Copy, Share2 } from "lucide-react";
import { haptic } from "@/lib/quorum/haptics";
import { estimateCost } from "@/lib/quorum/cost";
import type { ScoredOption } from "@/lib/quorum/engine";
import type { DemoMember } from "@/lib/quorum/demo-group";
import { SPRING, clockRange, joinNames } from "./shared";

/** One burst from each side, skipped for anyone who asked for less motion. */
async function celebrate() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  try {
    const { default: confetti } = await import("canvas-confetti");
    const base = { particleCount: 70, spread: 62, startVelocity: 46, ticks: 180, scalar: 0.9 };
    confetti({ ...base, angle: 60, origin: { x: 0, y: 0.8 } });
    confetti({ ...base, angle: 120, origin: { x: 1, y: 0.8 } });
  } catch {
    /* the celebration is a nicety, never a blocker */
  }
}

export function LockedPlan({
  members,
  plan,
  onUnlock,
}: {
  members: DemoMember[];
  plan: ScoredOption;
  onUnlock: () => void;
}) {
  const reduce = useReducedMotion();
  const [copied, setCopied] = useState(false);
  const { option } = plan;
  const cost = estimateCost({
    costMin: option.costMin,
    costMax: option.costMax,
    travelMinutes: option.travelMinutes,
    category: "hangout",
    headcount: members.length,
    requiresDriving: option.requiresDriving,
  });
  const names = joinNames(members.map((m) => m.name));
  const message = `${names}: it's ${option.title}, ${clockRange(option.start, option.end)}, about $${cost.perPersonMin}–${cost.perPersonMax} each. It works for all ${members.length} of us. Planned with Syncly.`;

  useEffect(() => {
    haptic("success");
    void celebrate();
  }, []);

  const share = async () => {
    haptic("tap");
    try {
      if (navigator.share) {
        await navigator.share({ text: message });
        return;
      }
    } catch {
      return; // dismissed the sheet
    }
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked: nothing useful to do */
    }
  };

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, scale: 0.94, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={SPRING}
      className="surface overflow-hidden p-0 ring-1 ring-primary/40"
    >
      <div className="bg-primary/10 px-5 pt-6 pb-5 text-center sm:px-6">
        <motion.div
          initial={reduce ? false : { scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.12, type: "spring", stiffness: 360, damping: 14 }}
          className="mx-auto grid size-14 place-items-center rounded-full bg-primary text-primary-foreground"
        >
          <Check className="size-7" strokeWidth={3} />
        </motion.div>
        <div className="mt-3 text-sm font-medium text-primary">Locked in</div>
        <h2 className="mt-1 text-2xl leading-tight font-semibold tracking-tight sm:text-[1.75rem]">
          {option.title}
        </h2>
        <p className="mt-1 text-base text-muted-foreground tabular-nums">
          {clockRange(option.start, option.end)} · ${cost.perPersonMin}–{cost.perPersonMax} each
        </p>
        <div className="mt-4 flex justify-center -space-x-2" aria-hidden>
          {members.map((m, i) => (
            <motion.span
              key={m.id}
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + i * 0.08, ...SPRING }}
              className="grid size-10 place-items-center rounded-full border-2 border-card bg-secondary text-lg"
            >
              {m.emoji}
            </motion.span>
          ))}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{names}. Everyone's in.</p>
      </div>
      <div className="flex flex-col gap-2 p-4 sm:flex-row">
        <button
          type="button"
          onClick={share}
          className="pressable active:pressable-active inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-5 text-base font-semibold text-primary-foreground"
        >
          {copied ? (
            <>
              <Copy className="size-4" /> Copied
            </>
          ) : (
            <>
              <Share2 className="size-4" /> Send to the group chat
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onUnlock}
          className="tap-target rounded-full px-4 text-sm text-muted-foreground hover:text-foreground"
        >
          Keep playing
        </button>
      </div>
    </motion.div>
  );
}
