import type { ReactNode } from "react";
import { motion } from "motion/react";
import { prefersReducedMotion } from "@/lib/quorum/haptics";

/**
 * iOS-style "push" entrance for a drill-in sub-page (Settings' new
 * Profile/Account/Planning/Info sub-pages): slides in from the right while
 * fading in, transform+opacity only so it's cheap at the route level. Going
 * back reuses SwipeBack's existing edge-swipe exit animation, or is instant
 * on a tap of the sub-page's own back button -- matching how plan/group
 * detail already handle backward navigation elsewhere in the app, so this
 * only adds the missing forward half instead of inventing a new pattern.
 */
export function PushEnter({ children }: { children: ReactNode }) {
  if (prefersReducedMotion()) return <>{children}</>;
  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 420, damping: 38 }}
    >
      {children}
    </motion.div>
  );
}
