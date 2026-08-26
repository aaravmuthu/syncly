import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";

type Props = {
  children: ReactNode;
  className?: string;
  to?: string;
  href?: string;
  search?: Record<string, unknown>;
  /** Hover glow tint — emerald for the primary CTA, a soft neutral glow
   * for dark/secondary buttons. */
  glow?: "primary" | "neutral";
};

const GLOW_SHADOW: Record<NonNullable<Props["glow"]>, string> = {
  primary: "0 14px 32px -10px color-mix(in oklab, var(--primary) 55%, transparent)",
  neutral: "0 12px 28px -12px color-mix(in oklab, var(--foreground) 20%, transparent)",
};

const MotionLink = motion.create(Link);

/**
 * Hero CTA: on hover it lifts a couple px and its glow intensifies; on
 * press it scales down for tactile feedback. Pure hover/press state —
 * no cursor-position tracking of any kind.
 */
export function GlowButton({ children, className, to, href, search, glow = "primary" }: Props) {
  const gestures = {
    whileHover: { y: -3, boxShadow: GLOW_SHADOW[glow], transition: { duration: 0.18, ease: "easeOut" as const } },
    whileTap: { scale: 0.97, transition: { duration: 0.1, ease: "easeOut" as const } },
  };

  if (to) {
    return (
      <MotionLink to={to} search={search as never} className={className} {...gestures}>
        {children}
      </MotionLink>
    );
  }
  return (
    <motion.a href={href ?? "#"} className={className} {...gestures}>
      {children}
    </motion.a>
  );
}
