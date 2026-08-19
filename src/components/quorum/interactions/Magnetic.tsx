import { useRef, type ReactNode } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";
import { cn } from "@/lib/utils";
import { haptic, isFinePointer, prefersReducedMotion } from "@/lib/quorum/haptics";

const spring = { stiffness: 320, damping: 20, mass: 0.4 };

/**
 * Magnetic wrapper: the child drifts toward the cursor while hovered and
 * snaps back with spring physics. Touch devices get tap physics only.
 */
export function Magnetic({
  children,
  className,
  strength = 0.32,
  radius = 90,
}: {
  children: ReactNode;
  className?: string;
  strength?: number;
  radius?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const x = useSpring(useMotionValue(0), spring);
  const y = useSpring(useMotionValue(0), spring);

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el || !isFinePointer() || prefersReducedMotion()) return;
    const r = el.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const dist = Math.hypot(dx, dy);
    if (dist > radius + Math.max(r.width, r.height) / 2) {
      x.set(0);
      y.set(0);
      return;
    }
    x.set(dx * strength);
    y.set(dy * strength);
  };

  return (
    <motion.span
      ref={ref}
      style={{ x, y }}
      onMouseMove={onMove}
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
      onPointerDown={() => haptic("tap")}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.94 }}
      transition={{ type: "spring", stiffness: 400, damping: 24 }}
      className={cn("inline-flex will-change-transform", className)}
    >
      {children}
    </motion.span>
  );
}
