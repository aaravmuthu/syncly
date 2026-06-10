import { useEffect } from "react";
import { useMotionValue, useSpring, useTransform, motion } from "motion/react";

interface Props {
  value: number;
  decimals?: number;
  className?: string;
  style?: React.CSSProperties;
}

/** Smoothly counts to `value` using spring physics. */
export function AnimatedNumber({ value, decimals = 1, className, style }: Props) {
  const mv = useMotionValue(value);
  const spring = useSpring(mv, { stiffness: 140, damping: 22, mass: 0.6 });
  const text = useTransform(spring, (v) => (Number.isFinite(v) ? v.toFixed(decimals) : "—"));

  useEffect(() => {
    mv.set(value);
  }, [value, mv]);

  return (
    <motion.span className={className} style={style}>
      {text}
    </motion.span>
  );
}
