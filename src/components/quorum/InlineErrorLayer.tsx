import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, CircleAlert, Info, X } from "lucide-react";
import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { haptic } from "@/lib/quorum/haptics";
import {
  clearInlineError,
  getInlineError,
  subscribeInlineError,
  type InlineError,
} from "@/lib/quorum/inline-error";

const ease = [0.23, 1, 0.32, 1] as const;
type Box = { top: number; left: number; width: number; height: number; radius: string };

/** Shared outcomes: animate the control, keep failures readable until dismissed. */
export function InlineErrorLayer() {
  const outcome = useSyncExternalStore(subscribeInlineError, getInlineError, () => null);
  const [mounted, setMounted] = useState(false);
  const [portal, setPortal] = useState<Element | null>(null);
  useEffect(() => setMounted(true), []);
  useLayoutEffect(() => {
    const update = () =>
      setPortal(
        (outcome?.anchor?.isConnected ? outcome.anchor.closest('[role="dialog"]') : null) ??
          document.querySelector('[role="dialog"][data-state="open"]') ??
          document.body,
      );
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [outcome]);

  useEffect(() => {
    if (!outcome) return;
    const { anchor, id, tone } = outcome;
    const words = [outcome.title, outcome.description]
      .filter((v) => typeof v === "string")
      .join(" ");
    const timer =
      tone === "error" || outcome.action
        ? undefined
        : window.setTimeout(
            () => clearInlineError(id),
            Math.min(8000, Math.max(3500, words.length * 60)),
          );
    const onPress = (event: Event) => {
      if (event.target instanceof Node && anchor?.contains(event.target)) clearInlineError(id);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") clearInlineError(id);
      if (
        (event.key === "Enter" || event.key === " ") &&
        event.target instanceof Node &&
        anchor?.contains(event.target)
      )
        clearInlineError(id);
    };
    document.addEventListener("pointerdown", onPress, true);
    document.addEventListener("keydown", onKey);
    haptic(tone === "error" ? "warn" : tone === "success" ? "success" : "tap");
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener("pointerdown", onPress, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [outcome]);

  if (!mounted || !portal) return null;
  // Keep announcements and recovery controls inside the modal focus scope.
  return createPortal(
    <>
      <span className="sr-only" role="alert" aria-atomic="true">
        {outcome?.tone === "error" ? (
          <>
            {outcome.title}. {outcome.description}
          </>
        ) : null}
      </span>
      <span className="sr-only" role="status" aria-atomic="true">
        {outcome && outcome.tone !== "error" ? (
          <>
            {outcome.title}. {outcome.description}
          </>
        ) : null}
      </span>
      <AnimatePresence mode="wait">
        {outcome ? <Outcome key={outcome.id} outcome={outcome} portal={portal} /> : null}
      </AnimatePresence>
    </>,
    portal,
  );
}

function Outcome({ outcome, portal }: { outcome: InlineError; portal: Element }) {
  const reduce = useReducedMotion();
  const [box, setBox] = useState<Box | null>(null);
  const [caption, setCaption] = useState<HTMLDivElement | null>(null);
  const [captionHeight, setCaptionHeight] = useState(0);
  const [viewport, setViewport] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
    top: 0,
    left: 0,
  });

  useLayoutEffect(() => {
    let frame = 0;
    const measure = () => {
      const vv = window.visualViewport;
      // A transformed sheet establishes its own fixed-position coordinate space.
      let containing: Element | null = portal;
      while (
        containing &&
        getComputedStyle(containing).transform === "none" &&
        !/(transform|filter|perspective)/.test(getComputedStyle(containing).willChange) &&
        getComputedStyle(containing).filter === "none" &&
        getComputedStyle(containing).backdropFilter === "none" &&
        !/(paint|layout|strict|content)/.test(getComputedStyle(containing).contain) &&
        getComputedStyle(containing).perspective === "none"
      )
        containing = containing.parentElement;
      const origin = containing?.getBoundingClientRect();
      const offsetX = origin?.left ?? 0;
      const offsetY = origin?.top ?? 0;
      const scope = portal === document.body ? null : portal.getBoundingClientRect();
      const viewportTop = Math.max(vv?.offsetTop ?? 0, scope?.top ?? 0);
      const viewportLeft = Math.max(vv?.offsetLeft ?? 0, scope?.left ?? 0);
      const viewportBottom = Math.min(
        (vv?.offsetTop ?? 0) + (vv?.height ?? window.innerHeight),
        scope?.bottom ?? Infinity,
      );
      const viewportRight = Math.min(
        (vv?.offsetLeft ?? 0) + (vv?.width ?? window.innerWidth),
        scope?.right ?? Infinity,
      );
      setViewport({
        width: Math.max(48, viewportRight - viewportLeft),
        height: Math.max(48, viewportBottom - viewportTop),
        top: viewportTop - offsetY,
        left: viewportLeft - offsetX,
      });
      const anchor = outcome.anchor;
      const rect = anchor?.isConnected ? anchor.getBoundingClientRect() : null;
      const visible =
        rect &&
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom > 0 &&
        rect.top < window.innerHeight;
      setBox(
        visible
          ? {
              top: rect.top - offsetY,
              left: rect.left - offsetX,
              width: rect.width,
              height: rect.height,
              radius: getComputedStyle(anchor!).borderRadius,
            }
          : null,
      );
    };
    // Follow the initial button/sheet transition, then measure only on changes.
    const until = performance.now() + 500;
    const follow = () => {
      measure();
      if (performance.now() < until) frame = requestAnimationFrame(follow);
    };
    follow();
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    if (outcome.anchor) observer.observe(outcome.anchor);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("scroll", measure);
    // Navigation and closing a sheet can remove a control without a resize.
    const changes = new MutationObserver(() => {
      if (!outcome.anchor?.isConnected) measure();
    });
    changes.observe(document.body, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      changes.disconnect();
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("scroll", measure);
    };
  }, [outcome.anchor, portal]);

  useLayoutEffect(() => {
    if (!caption) return;
    const observer = new ResizeObserver(() => setCaptionHeight(caption.offsetHeight));
    observer.observe(caption);
    setCaptionHeight(caption.offsetHeight);
    return () => observer.disconnect();
  }, [caption]);

  const Icon = outcome.tone === "success" ? Check : outcome.tone === "error" ? CircleAlert : Info;
  const width = Math.min(320, viewport.width - 24);
  const below =
    box && box.top + box.height + 10 + captionHeight <= viewport.top + viewport.height - 12;
  const left = box
    ? Math.max(
        viewport.left + 12,
        Math.min(box.left + box.width / 2 - width / 2, viewport.left + viewport.width - width - 12),
      )
    : viewport.left + (viewport.width - width) / 2;
  const top = box
    ? Math.max(
        viewport.top + 12,
        Math.min(
          below ? box.top + box.height + 10 : box.top - captionHeight - 10,
          viewport.top + viewport.height - captionHeight - 12,
        ),
      )
    : viewport.top + Math.max(12, (viewport.height - captionHeight) / 2);
  const label =
    outcome.tone === "success" ? "Done" : outcome.tone === "error" ? "Try again" : "Updated";
  const descriptionId = `action-outcome-${outcome.id}`;

  useEffect(() => {
    const anchor = outcome.anchor;
    if (!anchor) return;
    const previous = anchor.getAttribute("aria-describedby");
    anchor.setAttribute("aria-describedby", [previous, descriptionId].filter(Boolean).join(" "));
    return () => {
      if (previous === null) anchor.removeAttribute("aria-describedby");
      else anchor.setAttribute("aria-describedby", previous);
    };
  }, [outcome.anchor, descriptionId]);

  return (
    <>
      {box ? (
        <motion.div
          aria-hidden="true"
          className="action-outcome-face pointer-events-none fixed z-[1000] flex items-center justify-center gap-2 overflow-hidden px-2 text-sm font-semibold"
          data-tone={outcome.tone}
          style={{
            top: box.top,
            left: box.left,
            width: box.width,
            height: box.height,
            borderRadius: box.radius,
          }}
          initial={{ opacity: 0, transform: reduce ? "none" : "scale(0.96)" }}
          animate={{ opacity: 1, transform: "scale(1)" }}
          exit={{ opacity: 0, transform: reduce ? "none" : "scale(0.96)" }}
          transition={{ duration: 0.2, ease }}
        >
          <Icon className="size-5 shrink-0" strokeWidth={2.5} />
          {box.width >= 100 ? <span className="truncate">{label}</span> : null}
        </motion.div>
      ) : null}
      <motion.div
        ref={setCaption}
        id={descriptionId}
        className={`action-outcome-caption fixed z-[1000] ${box ? "rounded-2xl bg-card p-3" : "rounded-3xl bg-background p-5 text-center"}`}
        data-tone={outcome.tone}
        style={{ top, left, width, maxHeight: viewport.height - 24, overflowY: "auto" }}
        initial={{ opacity: 0, transform: reduce ? "none" : "translateY(6px) scale(0.97)" }}
        animate={{ opacity: 1, transform: "translateY(0px) scale(1)" }}
        exit={{ opacity: 0, transform: reduce ? "none" : "translateY(6px) scale(0.97)" }}
        transition={{ duration: 0.2, ease }}
      >
        {!box ? (
          <motion.div
            className="action-outcome-symbol mx-auto mb-3 flex size-14 items-center justify-center rounded-full"
            data-tone={outcome.tone}
            initial={{ opacity: 0, transform: reduce ? "none" : "scale(0.9)" }}
            animate={{ opacity: 1, transform: "scale(1)" }}
            transition={{ duration: 0.24, ease }}
          >
            <Icon aria-hidden="true" className="size-7" strokeWidth={2.5} />
          </motion.div>
        ) : null}
        <div className="flex items-start gap-2 text-left">
          <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
            <p className="text-sm font-semibold text-foreground">{outcome.title}</p>
            {outcome.description ? (
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {outcome.description}
              </p>
            ) : null}
            {outcome.action ? (
              <button
                type="button"
                className="mt-2 min-h-11 font-semibold text-primary underline underline-offset-4"
                onClick={() => {
                  clearInlineError(outcome.id);
                  outcome.action?.onClick();
                }}
              >
                {outcome.action.label}
              </button>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="Dismiss feedback"
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
            onClick={() => clearInlineError(outcome.id)}
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
      </motion.div>
    </>
  );
}
