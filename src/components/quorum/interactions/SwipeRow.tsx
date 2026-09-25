import { useState, type ReactNode } from "react";
import { motion, useMotionValue, useTransform, animate } from "motion/react";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/quorum/haptics";

export type SwipeAction = {
  label: string;
  icon?: ReactNode;
  /** Tone drives the revealed track colour behind the card. */
  tone?: "primary" | "danger" | "muted";
  onAction: () => void;
};

const TONES: Record<string, string> = {
  primary: "bg-emerald-500/85 text-black",
  danger: "bg-destructive/85 text-destructive-foreground",
  muted: "bg-secondary text-secondary-foreground",
};

const spring = { type: "spring", stiffness: 420, damping: 34 } as const;

/**
 * iOS-style swipeable row. Drag right past the threshold to fire the primary
 * action, drag left to reveal (and commit) the secondary action.
 */
export function SwipeRow({
  children,
  left,
  right,
  className,
  disabled = false,
  threshold = 96,
}: {
  children: ReactNode;
  /** Fired by swiping right (revealed on the left edge). */
  left?: SwipeAction;
  /** Fired by swiping left (revealed on the right edge). */
  right?: SwipeAction;
  className?: string;
  disabled?: boolean;
  threshold?: number;
}) {
  const x = useMotionValue(0);
  const [armed, setArmed] = useState<"left" | "right" | null>(null);
  const leftOpacity = useTransform(x, [0, threshold], [0, 1]);
  const rightOpacity = useTransform(x, [-threshold, 0], [1, 0]);

  if (disabled || (!left && !right)) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={cn("relative overflow-hidden rounded-[28px]", className)}>
      {left ? (
        <motion.button
          type="button"
          style={{ opacity: leftOpacity }}
          onClick={() => left.onAction()}
          className={cn(
            "absolute inset-y-0 left-0 flex w-32 items-center gap-2 rounded-l-[28px] px-5 text-sm font-semibold",
            TONES[left.tone ?? "primary"],
          )}
        >
          {left.icon}
          {left.label}
        </motion.button>
      ) : null}
      {right ? (
        <motion.button
          type="button"
          style={{ opacity: rightOpacity }}
          onClick={() => right.onAction()}
          className={cn(
            "absolute inset-y-0 right-0 flex w-32 items-center justify-end gap-2 rounded-r-[28px] px-5 text-sm font-semibold",
            TONES[right.tone ?? "muted"],
          )}
        >
          {right.icon}
          {right.label}
        </motion.button>
      ) : null}

      <motion.div
        drag="x"
        style={{ x }}
        dragElastic={0.18}
        dragMomentum={false}
        dragConstraints={{
          left: right ? -threshold * 1.35 : 0,
          right: left ? threshold * 1.35 : 0,
        }}
        onDrag={(_, info) => {
          const next =
            info.offset.x > threshold ? "left" : info.offset.x < -threshold ? "right" : null;
          if (next !== armed) {
            if (next) haptic("select");
            setArmed(next);
          }
        }}
        onDragEnd={(_, info) => {
          const dx = info.offset.x;
          if (left && dx > threshold) {
            haptic("success");
            left.onAction();
          } else if (right && dx < -threshold) {
            haptic("warn");
            right.onAction();
          }
          setArmed(null);
          void animate(x, 0, spring);
        }}
        className="relative touch-pan-y will-change-transform"
      >
        {children}
      </motion.div>
    </div>
  );
}
