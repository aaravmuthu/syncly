import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
  animate,
  useReducedMotion,
} from "motion/react";
import { CircleAlert, RefreshCw } from "lucide-react";
import { ThinkingOrb } from "thinking-orbs";
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
  const reduce = useReducedMotion();
  const refresh = useRef(onRefresh);
  useEffect(() => {
    refresh.current = onRefresh;
  }, [onRefresh]);
  const y = useMotionValue(0);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!failed) return;
    const t = window.setTimeout(() => setFailed(false), 4000);
    return () => window.clearTimeout(t);
  }, [failed]);
  const refreshing = useRef(false);
  const startX = useRef(0);
  const startY = useRef<number | null>(null);
  const armed = useRef(false);
  const scope = useRef<HTMLDivElement>(null);

  const spinnerScale = useTransform(y, [0, TRIGGER], [0.5, 1]);
  const spinnerOpacity = useTransform(y, [8, TRIGGER], [0, 1]);
  const spinnerRotate = useTransform(y, [0, MAX], [0, 320]);

  useEffect(() => {
    const el = scope.current;
    if (!el) return;
    let mounted = true;
    const settle = (value: number) =>
      void animate(
        y,
        value,
        reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 },
      );

    const onStart = (e: TouchEvent) => {
      if (refreshing.current || e.touches.length !== 1) return;
      if (window.scrollY > 2) return;
      const target = e.target as HTMLElement;
      if (
        target.closest(
          'input, textarea, select, button, a, [role="slider"], [data-no-pull-refresh]',
        )
      )
        return;
      // Nested transcripts/sheets own their scrolling; don't pull the page through them.
      for (let parent = target; parent && parent !== el; parent = parent.parentElement!) {
        if (
          parent.scrollHeight > parent.clientHeight &&
          /auto|scroll/.test(getComputedStyle(parent).overflowY)
        )
          return;
      }
      startY.current = e.touches[0]?.clientY ?? null;
      startX.current = e.touches[0]?.clientX ?? 0;
      armed.current = false;
    };
    const onMove = (e: TouchEvent) => {
      if (startY.current == null || refreshing.current) return;
      if (e.touches.length !== 1 || Math.abs((e.touches[0]?.clientX ?? 0) - startX.current) > 24) {
        startY.current = null;
        y.set(0);
        return;
      }
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
      if (startY.current == null) return;
      const pulled = y.get();
      startY.current = null;
      if (pulled >= TRIGGER && !refreshing.current) {
        refreshing.current = true;
        setBusy(true);
        haptic("success");
        settle(56);
        setFailed(false);
        try {
          await refresh.current();
        } catch {
          haptic("warn");
          if (mounted) setFailed(true);
        } finally {
          refreshing.current = false;
          if (mounted) {
            setBusy(false);
            settle(0);
          }
        }
      } else {
        settle(0);
      }
      armed.current = false;
    };

    const onCancel = () => {
      startY.current = null;
      armed.current = false;
      if (!refreshing.current) settle(0);
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onCancel);
    return () => {
      mounted = false;
      startY.current = null;
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onCancel);
    };
  }, [reduce, y]);

  return (
    <div ref={scope} className="relative" aria-busy={busy || undefined}>
      <span className="sr-only" role="status">
        {busy ? "Refreshing…" : ""}
      </span>
      <motion.div
        style={{ opacity: spinnerOpacity, scale: spinnerScale, y: useTransform(y, (v) => v * 0.4) }}
        className="pointer-events-none absolute inset-x-0 -top-9 z-20 flex justify-center"
        aria-hidden
      >
        <motion.span
          style={{ rotate: busy ? undefined : spinnerRotate }}
          className="grid size-9 place-items-center rounded-full border border-white/10 bg-card/70 backdrop-blur-xl"
        >
          {busy ? (
            <ThinkingOrb state="working" size={20} aria-label="Refreshing" />
          ) : (
            <RefreshCw className="size-4 text-primary" />
          )}
        </motion.span>
      </motion.div>

      <motion.div style={{ y }}>
        {/* A failed refresh says so where the pull happened, not in a popup. */}
        <AnimatePresence initial={false}>
          {failed ? (
            <motion.p
              role="alert"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              className="flex items-center justify-center gap-1.5 overflow-hidden text-caption font-medium text-destructive"
            >
              <CircleAlert className="size-3.5 shrink-0" />
              <span className="py-2">Couldn't refresh. Check your connection and pull again.</span>
            </motion.p>
          ) : null}
        </AnimatePresence>
        {children}
      </motion.div>
    </div>
  );
}
