import { useCallback, useRef } from "react";
import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from "react";

const DELAY_MS = 350;
/** Finger travel that turns a press into a scroll or swipe. */
const SLOP_PX = 8;

/**
 * Touch long-press + desktop right-click, deduped. Android fires `contextmenu`
 * shortly after a long-press timer already opened the menu; without the
 * `firedAt` guard that second event closes it again.
 */
export function useLongPress(onOpen: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const firedAt = useRef(0);

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    origin.current = null;
  }, []);

  const fire = useCallback(() => {
    firedAt.current = performance.now();
    onOpen();
  }, [onOpen]);

  return {
    /** True for ~600ms after a long-press opened the menu: swallow the click. */
    justFired: () => performance.now() - firedAt.current < 600,
    handlers: {
      onPointerDown: (e: ReactPointerEvent) => {
        if (e.pointerType === "mouse") return;
        origin.current = { x: e.clientX, y: e.clientY };
        timer.current = setTimeout(() => {
          timer.current = null;
          fire();
        }, DELAY_MS);
      },
      onPointerMove: (e: ReactPointerEvent) => {
        const o = origin.current;
        if (o && Math.hypot(e.clientX - o.x, e.clientY - o.y) > SLOP_PX) clear();
      },
      onPointerUp: clear,
      onPointerCancel: clear,
      onContextMenu: (e: ReactMouseEvent) => {
        e.preventDefault();
        if (performance.now() - firedAt.current > 800) fire();
      },
    },
  };
}
