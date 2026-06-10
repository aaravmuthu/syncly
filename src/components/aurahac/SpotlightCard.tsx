import { useRef, type ReactNode, type CSSProperties } from "react";
import { motion, type HTMLMotionProps } from "motion/react";

interface Props extends HTMLMotionProps<"div"> {
  children: ReactNode;
  /** extra classes appended after the base glass + spotlight classes */
  className?: string;
  strong?: boolean;
}

/**
 * Glassmorphic card whose border gradient tracks the cursor (or touch),
 * with a subtle spring lift on hover and tactile press on tap.
 */
export function SpotlightCard({ children, className = "", strong = false, style, ...rest }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  function track(clientX: number, clientY: number) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${clientX - r.left}px`);
    el.style.setProperty("--my", `${clientY - r.top}px`);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={(e) => track(e.clientX, e.clientY)}
      onTouchMove={(e) => {
        const t = e.touches[0];
        if (t) track(t.clientX, t.clientY);
      }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className={`${strong ? "glass-strong" : "glass"} spotlight ${className}`}
      style={style as CSSProperties}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
