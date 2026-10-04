import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "@/lib/quorum/haptics";

/** Within this many px of the bottom still counts as "following the thread". */
const PIN_SLOP = 72;

/**
 * Keeps a chat transcript pinned to the newest message without ever yanking
 * someone who scrolled up to read. Handles first paint (instant), new
 * messages (smooth, only when pinned or when I just sent), late layout growth
 * (images, typing bubble, keyboard) via ResizeObserver, and the "jump to
 * latest" state.
 */
export function useChatScroll(count: number) {
  const ref = useRef<HTMLDivElement | null>(null);
  const pinned = useRef(true);
  const prevCount = useRef(0);
  const force = useRef(false);
  const ignoreScrollUntil = useRef(0);
  const [away, setAway] = useState(false);
  const [unseen, setUnseen] = useState(0);

  const scrollToBottom = useCallback((smooth = true) => {
    const el = ref.current;
    if (!el) return;
    pinned.current = true;
    // A smooth scroll fires scroll events from far away; don't read those as
    // the reader leaving the bottom.
    ignoreScrollUntil.current = performance.now() + (smooth ? 500 : 0);
    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth && !prefersReducedMotion() ? "smooth" : "auto",
    });
    setAway(false);
    setUnseen(0);
  }, []);

  const onScroll = useCallback(() => {
    const el = ref.current;
    if (!el || performance.now() < ignoreScrollUntil.current) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < PIN_SLOP;
    pinned.current = near;
    setAway(!near);
    if (near) setUnseen(0);
  }, []);

  /** Call right before adding my own message so it always scrolls into view. */
  const stick = useCallback(() => {
    force.current = true;
  }, []);

  useLayoutEffect(() => {
    const delta = count - prevCount.current;
    const first = prevCount.current === 0;
    prevCount.current = count;
    if (delta <= 0) return;
    if (first) scrollToBottom(false);
    else if (force.current || pinned.current) scrollToBottom(true);
    else setUnseen((n) => n + delta);
    force.current = false;
  }, [count, scrollToBottom]);

  // Late growth (image decode, typing bubble, composer grow, keyboard) keeps
  // the reader at the bottom if that is where they were.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (pinned.current) el.scrollTop = el.scrollHeight;
    });
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, []);

  return { ref, onScroll, away, unseen, scrollToBottom, stick };
}
