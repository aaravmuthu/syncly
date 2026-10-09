import { useEffect, useRef, useState, type RefObject } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { SyncAvatar, type SyncMood } from "@/components/quorum/auth/SyncAvatar";
import type { Follow } from "@/components/quorum/auth/useAvatarFollow";

/**
 * Sync as a tour guide: it flies to whatever `[data-guide=<target>]` element
 * inside `stage` the walkthrough is talking about, looks at it, and says what
 * to do in a speech bubble. Sits beside the target when there's room, above
 * or below it otherwise; on phones it docks above the footer and turns to
 * look instead.
 *
 * The line is mirrored into a polite live region by the caller's heading
 * flow, so the floating avatar itself stays decorative.
 */

const SPRING = { type: "spring", stiffness: 120, damping: 17, mass: 0.9 } as const;

type Place = { x: number; y: number; side: "left" | "right" | "below"; docked?: boolean };

export function SyncGuide({
  stage,
  target,
  line,
  mood,
  size,
}: {
  stage: RefObject<HTMLElement | null>;
  /** `data-guide` value of the element to fly to. */
  target: string;
  line: string;
  mood: SyncMood;
  size: number;
}) {
  const reduce = useReducedMotion();
  const [place, setPlace] = useState<Place | null>(null);
  const [follow, setFollow] = useState<Follow | null>(null);
  const tick = useRef(0);

  // A passive effect, not a layout one: the stage is this component's
  // parent, and its ref isn't attached yet when a child's layout effect runs.
  useEffect(() => {
    const root = stage.current;
    if (!root) return;
    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = root.querySelector<HTMLElement>(`[data-guide="${target}"]`);
        if (!el) return;
        const box = root.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        const lane = el.closest("[data-guide-lane]")?.getBoundingClientRect();
        const gap = 14;
        const bubble = Math.min(260, box.width - size - 24);
        // Sync and its bubble may hang into the page margin beside the stage.
        const room = window.innerWidth - 16;
        let p: Place;
        if (box.width < 640) {
          // Phones: Sync docks to the bottom of the screen (fixed, so a long
          // step can't scroll it away) and turns to look at its target.
          p = { x: 12, y: window.innerHeight - size - 88, side: "right", docked: true };
        } else if (lane && lane.right + gap + size + bubble <= room) {
          // Inside a step's content: travel down the lane beside it, level
          // with the target, so Sync never lands on a neighbouring card.
          p = {
            x: lane.right - box.left + gap,
            y: Math.max(r.top - box.top + r.height / 2 - size / 2, lane.top - box.top),
            side: "right",
          };
        } else if (r.right + gap + size + bubble <= room) {
          p = {
            x: r.right - box.left + gap,
            y: r.top - box.top + r.height / 2 - size / 2,
            side: "right",
          };
        } else if (r.left - gap - size - bubble >= 16) {
          p = {
            x: r.left - box.left - gap - size,
            y: r.top - box.top + r.height / 2 - size / 2,
            side: "left",
          };
        } else {
          const x = Math.min(
            Math.max(r.left - box.left + r.width / 2 - size / 2, 0),
            box.width - size,
          );
          p = { x, y: r.bottom - box.top + gap, side: "below" };
        }
        setPlace(p);
        tick.current += 1;
        setFollow({ el, tick: tick.current });
      });
    };
    measure();
    // The step slides in after the old one leaves; catch it once it lands.
    const later = [140, 520, 900].map((ms) => window.setTimeout(measure, ms));
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    const target0 = root.querySelector(`[data-guide="${target}"]`);
    if (target0) ro.observe(target0);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      later.forEach(window.clearTimeout);
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [stage, target, size]);

  if (!place) return null;
  const bubbleSide =
    place.side === "left" ? "right-full mr-3" : place.side === "right" ? "left-full ml-3" : "";

  return (
    <motion.div
      className={`pointer-events-none top-0 left-0 z-20 ${place.docked ? "fixed" : "absolute"}`}
      initial={false}
      animate={{ x: place.x, y: place.y }}
      transition={reduce ? { duration: 0 } : SPRING}
      aria-hidden
    >
      <motion.div
        animate={reduce ? undefined : { y: [0, -5, 0] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        className={place.docked ? "relative" : "pointer-events-auto relative"}
      >
        <SyncAvatar mood={mood} follow={follow} size={size} />
        <AnimatePresence mode="wait">
          <motion.p
            key={line}
            className={
              place.side === "below"
                ? "guide-bubble guide-bubble--below absolute top-full left-1/2 mt-2 w-[min(250px,78vw)] -translate-x-1/2"
                : `guide-bubble absolute top-1/2 w-[min(250px,40vw)] -translate-y-1/2 ${bubbleSide}`
            }
            data-side={place.side}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
          >
            {line}
          </motion.p>
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
