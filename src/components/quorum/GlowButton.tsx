import type { MouseEvent, ReactNode } from "react";
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
  /** Runs before navigation; call preventDefault() to take it over. */
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
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
export function GlowButton({
  children,
  className,
  to,
  href,
  search,
  glow = "primary",
  onClick,
}: Props) {
  const gestures = {
    whileHover: {
      y: -3,
      boxShadow: GLOW_SHADOW[glow],
      transition: { duration: 0.18, ease: [0.23, 1, 0.32, 1] as const },
    },
    whileTap: { scale: 0.97, transition: { duration: 0.1, ease: [0.23, 1, 0.32, 1] as const } },
  };

  if (to) {
    return (
      <MotionLink
        to={to}
        search={search as never}
        className={className}
        onClick={onClick}
        {...gestures}
      >
        {children}
      </MotionLink>
    );
  }
  return (
    <motion.a href={href ?? "#"} className={className} onClick={onClick} {...gestures}>
      {children}
    </motion.a>
  );
}
