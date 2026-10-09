import { AnimatePresence, motion } from "motion/react";
import { CircleAlert } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  clearInlineError,
  getInlineError,
  subscribeInlineError,
  type InlineError,
} from "@/lib/quorum/inline-error";

const EDGE = 12;
const GAP = 8;
const uiEaseOut = [0.23, 1, 0.32, 1] as const;

/** Reading time: a beat for the title plus ~50ms per character of reason. */
function lifetime(e: InlineError) {
  const words = [e.title, e.description].filter((t) => typeof t === "string").join(" ");
  const ms = 2400 + words.length * 50;
  return Math.min(e.action ? Math.max(ms, 6000) : ms, 8000);
}

/**
 * Renders the current inline error (lib/quorum/inline-error.ts): a tinted
 * face laid over the button that failed, which says what went wrong, and,
 * when there's more to say, the reason hanging just under it.
 */
export function InlineErrorLayer() {
  const error = useSyncExternalStore(subscribeInlineError, getInlineError, () => null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!error) return;
    const { anchor, id } = error;
    const timer = window.setTimeout(() => clearInlineError(id), lifetime(error));
    // Pressing the button again is a retry: get out of its way.
    const onPress = (e: Event) => {
      if (e.target instanceof Node && anchor.contains(e.target)) clearInlineError(id);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearInlineError(id);
    };
    document.addEventListener("pointerdown", onPress, true);
    document.addEventListener("keydown", onKey);
    // A nudge, unless the button is already mid-animation of its own.
    const nudge = getComputedStyle(anchor).animationName === "none";
    if (nudge) anchor.setAttribute("data-inline-error", "");
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointerdown", onPress, true);
      document.removeEventListener("keydown", onKey);
      if (nudge) anchor.removeAttribute("data-inline-error");
    };
  }, [error]);

  if (!mounted) return null;
  return createPortal(
    <>
      <span className="sr-only" role="alert">
        {error ? (
          <>
            {error.title}
            {error.description ? <>. {error.description}</> : null}
          </>
        ) : null}
      </span>
      <AnimatePresence>{error ? <ErrorFace key={error.id} error={error} /> : null}</AnimatePresence>
    </>,
    document.body,
  );
}

type Box = { top: number; left: number; width: number; height: number };

function ErrorFace({ error }: { error: InlineError }) {
  const { anchor } = error;
  const [box, setBox] = useState<Box | null>(null);
  const [shape] = useState(() => {
    const s = getComputedStyle(anchor);
    return {
      radius: s.borderRadius,
      fontSize: Math.min(Math.max(parseFloat(s.fontSize) || 14, 12), 15),
    };
  });
  const titleRef = useRef<HTMLSpanElement>(null);
  const captionRef = useRef<HTMLDivElement>(null);
  const [titleClipped, setTitleClipped] = useState(false);
  const [captionSize, setCaptionSize] = useState({ width: 0, height: 0 });

  // Follow the button through scrolling, sheet springs and the nudge.
  useLayoutEffect(() => {
    let raf = 0;
    const track = () => {
      if (!anchor.isConnected) return clearInlineError(error.id);
      const r = anchor.getBoundingClientRect();
      setBox((b) =>
        b && b.top === r.top && b.left === r.left && b.width === r.width && b.height === r.height
          ? b
          : { top: r.top, left: r.left, width: r.width, height: r.height },
      );
      raf = requestAnimationFrame(track);
    };
    track();
    return () => cancelAnimationFrame(raf);
  }, [anchor, error.id]);

  // Small buttons only have room for the icon; the words move to the caption.
  const iconOnly = (box?.width ?? 0) < 88;
  useLayoutEffect(() => {
    const t = titleRef.current;
    setTitleClipped(iconOnly || (!!t && t.scrollWidth > t.clientWidth + 1));
  }, [iconOnly, box?.width]);

  const hasCaption = titleClipped || !!error.description || !!error.action;
  const placed = box !== null;
  useLayoutEffect(() => {
    const c = captionRef.current;
    if (c) setCaptionSize({ width: c.offsetWidth, height: c.offsetHeight });
  }, [hasCaption, titleClipped, placed]);

  if (!box) return null;
  const vw = window.innerWidth;
  const vh = window.visualViewport?.height ?? window.innerHeight;
  const below = box.top + box.height + GAP + captionSize.height <= vh - EDGE;
  const captionTop = below ? box.top + box.height + GAP : box.top - GAP - captionSize.height;
  const captionLeft = Math.min(
    Math.max(box.left + box.width / 2 - captionSize.width / 2, EDGE),
    vw - EDGE - captionSize.width,
  );

  return (
    <>
      <motion.div
        aria-hidden
        className="inline-error-face pointer-events-none fixed z-[1000] flex items-center justify-center gap-1.5 overflow-hidden px-3 font-semibold"
        style={{
          top: box.top,
          left: box.left,
          width: box.width,
          height: box.height,
          borderRadius: shape.radius,
          fontSize: shape.fontSize,
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16, ease: uiEaseOut }}
      >
        <CircleAlert className="size-[1.1em] shrink-0" strokeWidth={2.25} />
        {iconOnly ? null : (
          <span ref={titleRef} className="min-w-0 truncate">
            {error.title}
          </span>
        )}
      </motion.div>
      {hasCaption ? (
        <motion.div
          ref={captionRef}
          role="presentation"
          className="inline-error-caption fixed z-[1000] w-max max-w-[min(20rem,calc(100vw-1.5rem))] rounded-xl px-3 py-2 text-caption"
          style={{
            top: captionTop,
            left: captionLeft,
            visibility: captionSize.width ? "visible" : "hidden",
            pointerEvents: error.action ? "auto" : "none",
          }}
          initial={{ opacity: 0, y: below ? -4 : 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: below ? -4 : 4 }}
          transition={{ duration: 0.18, ease: uiEaseOut }}
        >
          {titleClipped ? <p className="font-semibold text-foreground">{error.title}</p> : null}
          {error.description ? <p className="text-muted-foreground">{error.description}</p> : null}
          {error.action ? (
            <button
              type="button"
              className="mt-1 font-semibold text-primary underline-offset-2 hover:underline"
              onClick={() => {
                error.action?.onClick();
                clearInlineError(error.id);
              }}
            >
              {error.action.label}
            </button>
          ) : null}
        </motion.div>
      ) : null}
    </>
  );
}
