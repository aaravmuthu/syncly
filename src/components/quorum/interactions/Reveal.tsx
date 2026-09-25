import type { ElementType, ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

const spring = { type: "spring", stiffness: 380, damping: 36, mass: 0.7 } as const;

/**
 * Scroll-triggered reveal: children rise, fade and settle with spring physics
 * the first time they enter the viewport. Honours reduced-motion.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 14,
  blur = true,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  blur?: boolean;
  as?: "div" | "section" | "li" | "h2" | "p" | "figure" | "ol";
}) {
  const reduce = useReducedMotion();
  const Tag = motion[as as ElementType as "div"];

  if (reduce) return <Tag className={className}>{children}</Tag>;

  return (
    <Tag
      initial={{ opacity: 0, y, filter: blur ? "blur(6px)" : "blur(0px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-12% 0px -8% 0px" }}
      transition={{ ...spring, delay }}
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
        hidden: { opacity: 0, y: 12, scale: 0.98, filter: "blur(4px)" },
        show: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)", transition: spring },
      }}
      whileHover={lift ? { y: -2 } : undefined}
      transition={spring}
      className={cn(className)}
    >
      {children}
    </Tag>
  );
}
