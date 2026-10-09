import { useRef, useState, type ReactNode } from "react";
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { isFinePointer, prefersReducedMotion } from "@/lib/quorum/haptics";

const spring = { stiffness: 240, damping: 22, mass: 0.5 };

/**
 * Frosted-glass surface with a cursor-tracking radial glow and an optional
 * gentle 3D parallax tilt. Both effects are fine-pointer only.
 */
export function SpotlightCard({
  children,
  className,
  tilt = false,
  intensity = 0.16,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  tilt?: boolean;
  intensity?: number;
  as?: "div" | "article" | "section";
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const gx = useMotionValue(50);
  const gy = useMotionValue(50);
  const rx = useSpring(useMotionValue(0), spring);
  const ry = useSpring(useMotionValue(0), spring);
  const glow = useTransform(
    [gx, gy],
    ([x, y]: number[]) =>
      `radial-gradient(340px circle at ${x}% ${y}%, color-mix(in oklab, var(--primary) ${Math.round(
        intensity * 100,
      )}%, transparent), transparent 62%)`,
  );

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el || !isFinePointer() || reduce) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    gx.set(px * 100);
    gy.set(py * 100);
    if (tilt && !prefersReducedMotion()) {
      ry.set((px - 0.5) * 10);
      rx.set(-(py - 0.5) * 10);
    }
    if (!active) setActive(true);
  };

  const onLeave = () => {
    setActive(false);
    rx.set(0);
    ry.set(0);
  };

  const MotionTag = motion[as] as typeof motion.div;

  return (
    <MotionTag
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={tilt && !reduce ? { rotateX: rx, rotateY: ry, transformPerspective: 900 } : undefined}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className={cn("relative isolate", className)}
    >
      <motion.span
        aria-hidden
        style={{ backgroundImage: glow, opacity: active ? 1 : 0 }}
        className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] transition-opacity duration-300"
      />
      {children}
    </MotionTag>
  );
}
