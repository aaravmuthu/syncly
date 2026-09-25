import { useRef, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { motion, useMotionValue, animate } from "motion/react";
import { haptic, prefersReducedMotion } from "@/lib/quorum/haptics";

const EDGE_ZONE = 24; // iOS's own edge-swipe-to-back hitbox is similarly narrow
const TRIGGER_RATIO = 0.32; // fraction of viewport width that commits the pop

/**
 * iOS-style edge-swipe-to-go-back for drill-in screens (plan/group detail).
 * Owns the whole outgoing animation itself — on a committed swipe it finishes
 * sliding the page off-screen before calling history.back(), so there's no
 * handoff glitch with RouteTransition (which independently animates the
 * *incoming* page for every backward navigation, swipe-triggered or not).
 */
export function SwipeBack({ children }: { children: ReactNode }) {
  const router = useRouter();
  const x = useMotionValue(0);
  const startX = useRef<number | null>(null);
  const dragging = useRef(false);
  const viewportWidth = useRef(typeof window !== "undefined" ? window.innerWidth : 375);

  const onTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch || touch.clientX > EDGE_ZONE) return;
    startX.current = touch.clientX;
    dragging.current = false;
    viewportWidth.current = window.innerWidth;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (startX.current == null) return;
    const touch = e.touches[0];
    if (!touch) return;
    const dx = touch.clientX - startX.current;
    if (dx <= 0) {
      x.set(0);
      return;
    }
    dragging.current = true;
    x.set(Math.min(dx, viewportWidth.current));
  };

  const onTouchEnd = () => {
    if (startX.current == null) return;
    startX.current = null;
    const dx = x.get();
    const committed = dragging.current && dx > viewportWidth.current * TRIGGER_RATIO;
    dragging.current = false;

    if (committed) {
      haptic("select");
      void animate(x, viewportWidth.current, { duration: 0.18, ease: "easeOut" }).then(() => {
        router.history.back();
      });
    } else {
      void animate(x, 0, { type: "spring", stiffness: 420, damping: 34 });
    }
  };

  if (prefersReducedMotion()) return <>{children}</>;

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      <motion.div style={{ x }}>{children}</motion.div>
    </div>
  );
}
