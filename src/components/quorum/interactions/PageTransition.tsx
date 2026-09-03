import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRouterState } from "@tanstack/react-router";

// A soft, quick ease — springs on route content read as "bouncy/laggy" because
// the whole screen is in flight. iOS uses a short eased cross-dissolve instead.
const ease = [0.32, 0.72, 0, 1] as const;

/**
 * iOS-style route transition: the outgoing screen dips and fades while the new
 * one rises into place. Honours reduced-motion by cross-fading instead.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const reduce = useReducedMotion();

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={pathname}
        // NOTE: no filter/scale here — a persistent non-identity filter or
        // transform on this wrapper would make it the containing block for
        // position:fixed descendants (PlanWizard, ChatDrawer, LongPress).
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
        animate={
          reduce
            ? { opacity: 1, transition: { duration: 0.15 } }
            : { opacity: 1, y: 0, transition: { duration: 0.28, ease } }
        }
        exit={
          reduce
            ? { opacity: 0, transition: { duration: 0.1 } }
            : { opacity: 0, y: -4, transition: { duration: 0.14, ease } }
        }
        style={{ willChange: "opacity, transform" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
