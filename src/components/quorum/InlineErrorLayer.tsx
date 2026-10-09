import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CircleAlert } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { haptic } from "@/lib/quorum/haptics";
import {
  clearInlineError,
  getInlineError,
  subscribeInlineError,
  type InlineError,
} from "@/lib/quorum/inline-error";

const EDGE = 12;
const GAP = 10;
const ARROW_INSET = 16;
const uiEaseOut = [0.23, 1, 0.32, 1] as const;
const uiEaseInOut = [0.77, 0, 0.175, 1] as const;

/** Reading time: a beat for the title plus ~50ms per character of reason. */
function lifetime(e: InlineError) {
  const words = [e.title, e.description].filter((t) => typeof t === "string").join(" ");
  const ms = 2400 + words.length * 50;
  return Math.min(e.action ? Math.max(ms, 6000) : ms, 8000);
}

/**
 * Renders the current inline error (lib/quorum/inline-error.ts). The tint
 * floods the failed button outward from where the finger landed, the label
 * morphs to the error the way DynamicButton morphs its labels, and the reason
 * rises out of the button on a glass caption that points back at it. A
 * hairline along the bottom runs down until it lets go.
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
    // The nudge and the buzz land on the same frame as the tint. Skip the
    // nudge if the button is already mid-animation of its own.
    const nudge = getComputedStyle(anchor).animationName === "none";
    if (nudge) anchor.setAttribute("data-inline-error", "");
    haptic("warn");
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
      <AnimatePresence>
        {error ? <ErrorFace key={error.id} error={error} life={lifetime(error)} /> : null}
      </AnimatePresence>
    </>,
    document.body,
  );
}

type Box = { top: number; left: number; width: number; height: number };

function ErrorFace({ error, life }: { error: InlineError; life: number }) {
  const { anchor } = error;
  const reduce = useReducedMotion();
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

  // The flood starts under the finger (keyboard presses start at the
  // center). 142% of the circle() reference radius is the full diagonal, so
  // it covers the button from any starting point.
  const ox = Math.min(Math.max(error.origin?.x ?? 0.5, 0), 1) * 100;
  const oy = Math.min(Math.max(error.origin?.y ?? 0.5, 0), 1) * 100;
  const closed = `circle(0% at ${ox}% ${oy}%)`;
  const open = `circle(142% at ${ox}% ${oy}%)`;

  const vw = window.innerWidth;
  const vh = window.visualViewport?.height ?? window.innerHeight;
  const below = box.top + box.height + GAP + captionSize.height <= vh - EDGE;
  const captionTop = below ? box.top + box.height + GAP : box.top - GAP - captionSize.height;
  const captionLeft = Math.min(
    Math.max(box.left + box.width / 2 - captionSize.width / 2, EDGE),
    vw - EDGE - captionSize.width,
  );
  const arrowX = Math.min(
    Math.max(box.left + box.width / 2 - captionLeft, ARROW_INSET),
    captionSize.width - ARROW_INSET,
  );
  const measured = captionSize.width > 0;
  const rise = below ? -6 : 6;

  const caption = (
    <>
      <span
        aria-hidden
        className="inline-error-arrow absolute size-2.5"
        data-side={below ? "top" : "bottom"}
        style={{ left: arrowX - 5 }}
      />
      {titleClipped ? (
        <p className="font-semibold tracking-[-0.006em] text-foreground">{error.title}</p>
      ) : null}
      {error.description ? <p className="text-pretty text-muted-foreground">{error.description}</p> : null}
      {error.action ? (
        <button
          type="button"
          className="mt-1.5 font-semibold text-primary underline-offset-2 hover:underline"
          onClick={() => {
            error.action?.onClick();
            clearInlineError(error.id);
          }}
        >
          {error.action.label}
        </button>
      ) : null}
    </>
  );
  const captionClass =
    "inline-error-caption fixed z-[1000] w-max max-w-[min(20rem,calc(100vw-1.5rem))] rounded-xl px-3 py-2 text-caption leading-snug";

  return (
    <>
      <motion.div
        aria-hidden
        className="inline-error-face pointer-events-none fixed z-[1000] overflow-hidden"
        style={{
          top: box.top,
          left: box.left,
          width: box.width,
          height: box.height,
          borderRadius: shape.radius,
          fontSize: shape.fontSize,
        }}
        initial={reduce ? { opacity: 0 } : { clipPath: closed }}
        animate={reduce ? { opacity: 1 } : { clipPath: open }}
        exit={
          reduce
            ? { opacity: 0, transition: { duration: 0.16, ease: uiEaseOut } }
            : { clipPath: closed, transition: { duration: 0.26, ease: uiEaseInOut } }
        }
        transition={{ duration: reduce ? 0.16 : 0.32, ease: uiEaseOut }}
      >
        <motion.div
          className="flex size-full items-center justify-center gap-1.5 px-3 font-semibold tracking-[-0.011em]"
          initial={
            reduce
              ? { opacity: 0 }
              : { opacity: 0, transform: "translateY(8px)", filter: "blur(4px)" }
          }
          animate={{ opacity: 1, transform: "translateY(0px)", filter: "blur(0px)" }}
          exit={
            reduce
              ? { opacity: 0 }
              : { opacity: 0, transform: "translateY(-8px)", filter: "blur(4px)" }
          }
          transition={{ duration: 0.22, ease: uiEaseOut, delay: reduce ? 0 : 0.06 }}
        >
          <CircleAlert className="size-[1.1em] shrink-0" strokeWidth={2.25} />
          {iconOnly ? null : (
            <span ref={titleRef} className="min-w-0 truncate">
              {error.title}
            </span>
          )}
        </motion.div>
        {/* Time left before it lets go. */}
        <motion.span
          className="inline-error-timer absolute inset-x-0 bottom-0 h-[2px] origin-left"
          initial={{ transform: "scaleX(1)" }}
          animate={{ transform: "scaleX(0)" }}
          transition={{ duration: life / 1000, ease: "linear" }}
        />
      </motion.div>
      {hasCaption && !measured ? (
        // Measured first, invisibly, so it knows which side it fits on before
        // it starts moving.
        <div
          ref={captionRef}
          aria-hidden
          className={captionClass}
          style={{ top: 0, left: 0, visibility: "hidden" }}
        >
          {caption}
        </div>
      ) : null}
      {hasCaption && measured ? (
        <motion.div
          ref={captionRef}
          role="presentation"
          className={captionClass}
          style={{
            top: captionTop,
            left: captionLeft,
            transformOrigin: `${arrowX}px ${below ? "0%" : "100%"}`,
            pointerEvents: error.action ? "auto" : "none",
          }}
          initial={
            reduce ? { opacity: 0 } : { opacity: 0, transform: `translateY(${rise}px) scale(0.94)` }
          }
          animate={{ opacity: 1, transform: "translateY(0px) scale(1)" }}
          exit={
            reduce
              ? { opacity: 0, transition: { duration: 0.14 } }
              : {
                  opacity: 0,
                  transform: `translateY(${rise * 0.6}px) scale(0.97)`,
                  transition: { duration: 0.16, ease: uiEaseOut },
                }
          }
          transition={{
            transform: { type: "spring", duration: 0.38, bounce: 0, delay: 0.08 },
            opacity: { duration: 0.2, ease: uiEaseOut, delay: 0.08 },
          }}
        >
          {caption}
        </motion.div>
      ) : null}
    </>
  );
}
