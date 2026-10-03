import { useRef, useState, type ReactNode } from "react";
import { animate, motion, useMotionValue, type AnimationPlaybackControls } from "motion/react";
import { haptic } from "@/lib/quorum/haptics";
import { cn } from "@/lib/utils";
import { EASE_OUT } from "./shared";

/*
 * Locking a plan in is the one commit in the demo, so it asks for a deliberate
 * press: the fill runs linear while you hold (so you can see how long is left)
 * and drains fast on release. Keyboard and assistive tech skip the hold: their
 * click arrives with detail 0 and confirms straight away.
 */
export function HoldButton({
  onConfirm,
  holdMs = 650,
  className,
  children,
}: {
  onConfirm: () => void;
  holdMs?: number;
  className?: string;
  children: ReactNode;
}) {
  const fill = useMotionValue(0);
  const run = useRef<AnimationPlaybackControls | null>(null);
  const finished = useRef(false);
  const [short, setShort] = useState(false);

  const confirm = () => {
    if (finished.current) return;
    finished.current = true;
    haptic("success");
    onConfirm();
  };

  const start = () => {
    finished.current = false;
    setShort(false);
    haptic("tap");
    run.current?.stop();
    run.current = animate(fill, 1, {
      duration: holdMs / 1000,
      ease: "linear",
      onComplete: confirm,
    });
  };

  const release = () => {
    if (finished.current) return;
    const progress = fill.get();
    run.current?.stop();
    animate(fill, 0, { duration: 0.22, ease: EASE_OUT });
    if (progress > 0.04) setShort(true);
  };

  return (
    <motion.button
      type="button"
      aria-label="Lock it in. Press and hold."
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        start();
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onClick={(e) => {
        if (e.detail === 0) confirm();
      }}
      onContextMenu={(e) => e.preventDefault()}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.14, ease: EASE_OUT }}
      className={cn(
        "relative inline-flex touch-none items-center gap-2 overflow-hidden rounded-full bg-primary text-sm font-semibold text-primary-foreground select-none",
        className,
      )}
    >
      <motion.span
        aria-hidden
        style={{ scaleX: fill }}
        className="absolute inset-0 origin-left bg-primary-foreground/25"
      />
      <span className="relative z-10 inline-flex items-center gap-2">
        {short ? "Keep holding" : children}
      </span>
    </motion.button>
  );
}
