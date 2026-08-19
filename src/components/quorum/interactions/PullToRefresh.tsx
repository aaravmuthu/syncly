import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useMotionValue, useTransform, animate } from "motion/react";
import { RefreshCw } from "lucide-react";
import { haptic } from "@/lib/quorum/haptics";

const MAX = 110;
const TRIGGER = 72;

/**
 * iOS-style springy pull-to-refresh. Only engages when the page is already
 * scrolled to the top and the gesture is a genuine downward drag.
 */
export function PullToRefresh({
  onRefresh,
  children,
}: {
  onRefresh: () => Promise<unknown> | unknown;
  children: ReactNode;
}) {
  const y = useMotionValue(0);
  const [busy, setBusy] = useState(false);
  const startY = useRef<number | null>(null);
  const armed = useRef(false);
  const scope = useRef<HTMLDivElement>(null);

  const spinnerScale = useTransform(y, [0, TRIGGER], [0.5, 1]);
  const spinnerOpacity = useTransform(y, [8, TRIGGER], [0, 1]);
  const spinnerRotate = useTransform(y, [0, MAX], [0, 320]);

  useEffect(() => {
    const el = scope.current;
    if (!el) return;

    const onStart = (e: TouchEvent) => {
      if (busy) return;
      if (window.scrollY > 2) return;
      startY.current = e.touches[0]?.clientY ?? null;
      armed.current = false;
    };
    const onMove = (e: TouchEvent) => {
      if (startY.current == null || busy) return;
      const dy = (e.touches[0]?.clientY ?? 0) - startY.current;
      if (dy <= 0 || window.scrollY > 2) {
        y.set(0);
        return;
      }
      // Rubber-band resistance, capped so it always feels springy.
      const pulled = Math.min(MAX, dy * 0.55);
      y.set(pulled);
      if (!armed.current && pulled >= TRIGGER) {
        armed.current = true;
        haptic("select");
      }
    };
    const onEnd = async () => {
      const pulled = y.get();
      startY.current = null;
      if (pulled >= TRIGGER && !busy) {
        setBusy(true);
        haptic("success");
        void animate(y, 56, { type: "spring", stiffness: 320, damping: 30 });
        try {
          await onRefresh();
        } finally {
          setBusy(false);
          void animate(y, 0, { type: "spring", stiffness: 320, damping: 30 });
        }
      } else {
        void animate(y, 0, { type: "spring", stiffness: 420, damping: 34 });
      }
      armed.current = false;
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [busy, onRefresh, y]);

  return (
    <div ref={scope} className="relative">
      <motion.div
        style={{ opacity: spinnerOpacity, scale: spinnerScale, y: useTransform(y, (v) => v * 0.4) }}
        className="pointer-events-none absolute inset-x-0 -top-9 z-20 flex justify-center"
        aria-hidden
      >
        <motion.span
          style={{ rotate: busy ? undefined : spinnerRotate }}
          className="grid size-9 place-items-center rounded-full border border-white/10 bg-card/70 backdrop-blur-xl"
        >
          <RefreshCw className={`size-4 text-primary ${busy ? "animate-spin" : ""}`} />
        </motion.span>
      </motion.div>

      <motion.div style={{ y }} className="will-change-transform">
        {children}
      </motion.div>
    </div>
  );
}
