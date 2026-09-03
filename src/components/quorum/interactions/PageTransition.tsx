import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRouterState } from "@tanstack/react-router";

const spring = { type: "spring", stiffness: 300, damping: 30, mass: 0.8 } as const;

/**
 * iOS-style route transition: the outgoing screen dips and fades while the new
 * one rises into place. Honours reduced-motion by cross-fading instead.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const reduce = useReducedMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        // NOTE: no filter/scale here — a persistent non-identity filter or
        // transform on this wrapper would make it the containing block for
        // position:fixed descendants (PlanWizard, ChatDrawer, LongPress).
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
        animate={
          reduce
            ? { opacity: 1, transition: { duration: 0.18 } }
            : { opacity: 1, y: 0, transition: spring }
        }
        exit={
          reduce
            ? { opacity: 0, transition: { duration: 0.12 } }
            : { opacity: 0, y: -8, scale: 0.99, transition: { duration: 0.16 } }
        }
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
