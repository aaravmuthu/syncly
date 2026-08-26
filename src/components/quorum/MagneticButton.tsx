import { useRef, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { motion, useMotionValue, useSpring } from "motion/react";
import { prefersReducedMotion } from "@/lib/quorum/haptics";

type Props = {
  children: ReactNode;
  className?: string;
  to?: string;
  href?: string;
  search?: Record<string, unknown>;
};

// Stiff and lightly damped so the pull reads as tactile snap, not float.
const PULL_SPRING = { stiffness: 500, damping: 30, mass: 0.4 };
const TAP_SPRING = { type: "spring", stiffness: 500, damping: 24, mass: 0.4 } as const;
// Clamped in px, independent of button size or cursor distance — "a few
// pixels," matching Linear/Stripe's restraint rather than a floaty drift.
const MAX_PULL = 6;

/**
 * "Magnetic floating HUD button": on fine-pointer devices the button nudges
 * a few px toward the cursor while hovered, and snaps back on tap/click.
 * Touch devices only get the tap feedback — no cursor to react to.
 */
export function MagneticButton({ children, className, to, href, search }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const x = useSpring(useMotionValue(0), PULL_SPRING);
  const y = useSpring(useMotionValue(0), PULL_SPRING);

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    // Fine-pointer devices only — no magnetic drift on touch.
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (prefersReducedMotion()) return;
    const r = el.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    x.set(Math.max(-MAX_PULL, Math.min(MAX_PULL, dx * 0.3)));
    y.set(Math.max(-MAX_PULL, Math.min(MAX_PULL, dy * 0.3)));
  };
  const reset = () => {
    x.set(0);
    y.set(0);
  };

  const inner = (
    <motion.span
      ref={ref}
      style={{ x, y }}
      whileTap={{ scale: 0.97 }}
      transition={TAP_SPRING}
      className="inline-flex will-change-transform"
    >
      {children}
    </motion.span>
  );

  const shared = {
    className,
    onMouseMove: onMove,
    onMouseLeave: reset,
  };

  if (to) {
    return (
      <Link to={to} search={search as never} {...shared}>
        {inner}
      </Link>
    );
  }
  return (
    <a href={href ?? "#"} {...shared}>
      {inner}
    </a>
  );
}
