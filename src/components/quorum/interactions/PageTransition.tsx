import type { ReactNode } from "react";

/**
 * Keep tab navigation synchronous. Animating the complete route subtree makes
 * data-heavy screens such as Radar feel delayed and also creates containing
 * blocks that interfere with viewport-fixed controls.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
