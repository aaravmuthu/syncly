import { useReducedMotion } from "motion/react";

/** The app's strong ease-out (`--ease-out` in styles.css) as a Motion curve. */
export const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/**
 * Entrance/exit props for small chat surfaces (new bubble, typing bubble,
 * jump pill). transform + opacity only; reduced motion keeps the fade and
 * drops the movement.
 */
export function useRise(distance = 8, duration = 0.18) {
  const reduce = useReducedMotion();
  const y = reduce ? 0 : distance;
  return {
    initial: { opacity: 0, transform: `translateY(${y}px)` },
    animate: { opacity: 1, transform: "translateY(0px)" },
    exit: { opacity: 0, transform: `translateY(${y}px)` },
    transition: { duration: reduce ? 0.12 : duration, ease: EASE_OUT },
  } as const;
}

/** Spring for gesture settle: critically damped, carries release velocity. */
export const SETTLE = { bounceStiffness: 600, bounceDamping: 50 } as const;
