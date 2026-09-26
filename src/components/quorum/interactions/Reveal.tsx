import type { ElementType, ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { EASE_OUT, REVEAL_RISE, REVEAL_TRANSITION } from "@/lib/motion";

// Hover is felt many times a visit, so it answers faster than the entrance.
const hoverLift = { y: -2, transition: { duration: 0.2, ease: EASE_OUT } } as const;

/**
 * Scroll-triggered reveal: children rise and fade in on the shared ease-out
 * the first time they enter the viewport. Transform and opacity only, so it
 * stays on the compositor. Honours reduced-motion by rendering in place.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  y = REVEAL_RISE,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  as?: "div" | "section" | "li" | "h2" | "p" | "figure" | "ol";
}) {
  const reduce = useReducedMotion();
  const Tag = motion[as as ElementType as "div"];

  if (reduce) return <Tag className={className}>{children}</Tag>;

  return (
    <Tag
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-12% 0px -8% 0px" }}
      transition={{ ...REVEAL_TRANSITION, delay }}
      className={className}
    >
      {children}
    </Tag>
  );
}

/** Parent that staggers its RevealItem children as the group scrolls in. */
export function RevealGroup({
  children,
  className,
  stagger = 0.08,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
  as?: "div" | "section" | "ul" | "ol";
}) {
  const reduce = useReducedMotion();
  const Tag = motion[as as ElementType as "div"];
  if (reduce) return <Tag className={className}>{children}</Tag>;
  return (
    <Tag
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-10% 0px -6% 0px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: stagger } } }}
      className={className}
    >
      {children}
    </Tag>
  );
}

export function RevealItem({
  children,
  className,
  as = "div",
  lift = true,
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "li" | "figure" | "article";
  lift?: boolean;
}) {
  const reduce = useReducedMotion();
  const Tag = motion[as as ElementType as "div"];
  if (reduce) return <Tag className={className}>{children}</Tag>;
  return (
    <Tag
      variants={{
        hidden: { opacity: 0, y: REVEAL_RISE, scale: 0.98 },
        show: { opacity: 1, y: 0, scale: 1, transition: REVEAL_TRANSITION },
      }}
      whileHover={lift ? hoverLift : undefined}
      className={cn(className)}
    >
      {children}
    </Tag>
  );
}
