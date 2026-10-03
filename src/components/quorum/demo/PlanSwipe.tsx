import { useEffect, useRef, type ReactNode } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type PanInfo,
} from "motion/react";
import { project } from "./shared";

const COMMIT_PX = 80;

/*
 * Lets the plan card be thrown sideways to browse the other options that work
 * for everyone. The card tracks the pointer 1:1, rubber-bands at the ends of
 * the list (hard to pull past the last option, easy to pull toward the next),
 * and commits from where the flick would *land*, not where the finger let go,
 * so a short fast flick counts. Letting go springs the card home carrying the
 * release velocity. Direction is touch-action: pan-y so the page still scrolls.
 */
export function PlanSwipe({
  index,
  count,
  onGo,
  children,
}: {
  index: number;
  count: number;
  onGo: (next: number, dir: 1 | -1) => void;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-260, 0, 260], reduce ? [0, 0, 0] : [-4, 0, 4]);
  const hasNext = index < count - 1;
  const hasPrev = index > 0;
  const nudge = useRef<ReturnType<typeof animate> | null>(null);

  // Show once, on arrival, that the card moves. Any real touch cancels it.
  useEffect(() => {
    if (count < 2 || reduce) return;
    const t = window.setTimeout(() => {
      nudge.current = animate(x, -30, { duration: 0.32, ease: [0.22, 1, 0.36, 1] });
      nudge.current.then(() => {
        nudge.current = animate(x, 0, { type: "spring", stiffness: 380, damping: 26 });
      });
    }, 1100);
    return () => {
      window.clearTimeout(t);
      nudge.current?.stop();
    };
    // once per mount: re-running on count changes would nudge on every edit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onEnd = (_: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
    const landing = info.offset.x + project(info.velocity.x, 0.99);
    if (landing < -COMMIT_PX && hasNext) onGo(index + 1, 1);
    else if (landing > COMMIT_PX && hasPrev) onGo(index - 1, -1);
  };

  return (
    <motion.div
      drag={count > 1 ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={{ left: hasNext ? 0.7 : 0.14, right: hasPrev ? 0.7 : 0.14 }}
      dragTransition={{ bounceStiffness: 420, bounceDamping: 34 }}
      dragSnapToOrigin
      onDragStart={() => nudge.current?.stop()}
      onDragEnd={onEnd}
      style={{ x, rotate, touchAction: "pan-y" }}
      whileDrag={{ cursor: "grabbing" }}
      className={count > 1 ? "cursor-grab select-none" : undefined}
    >
      {children}
    </motion.div>
  );
}

/** "2 of 4 work for everyone" with tappable dots. */
export function DeckDots({
  index,
  count,
  onGo,
}: {
  index: number;
  count: number;
  onGo: (next: number, dir: 1 | -1) => void;
}) {
  if (count < 2) return null;
  return (
    <div className="mt-3 flex items-center justify-between gap-3">
      <span className="text-sm text-muted-foreground tabular-nums">
        {index + 1} of {count} work for everyone
        <span className="hidden sm:inline"> · drag the card for the next</span>
      </span>
      <div className="flex items-center" role="group" aria-label="Options that work for everyone">
        {Array.from({ length: count }, (_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Option ${i + 1}`}
            aria-current={i === index}
            onClick={() => i !== index && onGo(i, i > index ? 1 : -1)}
            className="grid size-8 place-items-center"
          >
            <motion.span
              animate={{ width: i === index ? 18 : 6, opacity: i === index ? 1 : 0.35 }}
              transition={{ type: "spring", stiffness: 500, damping: 32 }}
              className="h-1.5 rounded-full bg-primary"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
