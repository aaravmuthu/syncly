import { useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Loader2, ArrowDown } from "lucide-react";

const THRESHOLD = 70; // px the user must pull before a refresh fires
const MAX_PULL = 110;

/**
 * Wraps a scrollable region and triggers `onRefresh` when the user pulls down
 * from the very top. Pulls live data instead of relying on cached info.
 */
export function PullToRefresh({
  onRefresh,
  refreshing,
  children,
  className,
}: {
  onRefresh: () => void;
  refreshing: boolean;
  children: ReactNode;
  className?: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const startY = useRef<number | null>(null);
  const [pull, setPull] = useState(0);

  function onTouchStart(e: React.TouchEvent) {
    if (scroller.current && scroller.current.scrollTop <= 0) {
      startY.current = e.touches[0].clientY;
    } else {
      startY.current = null;
    }
  }

  function onTouchMove(e: React.TouchEvent) {
    if (startY.current === null || refreshing) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0 && (scroller.current?.scrollTop ?? 0) <= 0) {
      // Rubber-band resistance.
      const eased = Math.min(MAX_PULL, delta * 0.5);
      setPull(eased);
    }
  }

  function onTouchEnd() {
    if (pull >= THRESHOLD && !refreshing) {
      onRefresh();
    }
    setPull(0);
    startY.current = null;
  }

  const active = refreshing || pull > 4;
  const progress = Math.min(1, pull / THRESHOLD);

  return (
    <div className="relative h-full">
      <AnimatePresence>
        {active ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute left-1/2 z-20 -translate-x-1/2 pointer-events-none"
            style={{ top: refreshing ? 14 : Math.max(6, pull - 24) }}
          >
            <div
              className="h-9 w-9 grid place-items-center rounded-full glass-strong"
              style={{ boxShadow: "0 8px 24px -8px var(--primary)" }}
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 text-primary animate-spin" />
              ) : (
                <ArrowDown
                  className="h-4 w-4 text-primary transition-transform"
                  style={{ transform: `rotate(${progress >= 1 ? 180 : 0}deg)` }}
                />
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div
        ref={scroller}
        className={className}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          transform: pull ? `translateY(${pull}px)` : undefined,
          transition: pull ? "none" : "transform 0.25s ease",
          height: "100%",
        }}
      >
        {children}
      </div>
    </div>
  );
}
