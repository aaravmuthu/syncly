import { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  type PanInfo,
} from "motion/react";
import { Check, Sparkles, X } from "lucide-react";
import { haptic } from "@/lib/quorum/haptics";
import { scoreOption } from "@/lib/quorum/engine";
import type { DemoMember } from "@/lib/quorum/demo-group";
import type { OptionSeed } from "@/lib/quorum/types";
import {
  BLOCKER_LABEL,
  blockersOf,
  inputsOf,
  toHHMM,
  toMin,
  type Compromise,
} from "@/lib/quorum/demo-ai";
import { clock, clockRange, project } from "./shared";

const STEP = 15;
const TICKS = [12, 15, 18, 21];

/*
 * The rescue, made hands-on: the stuck plan sits on a timeline and you drag
 * it. Every 15-minute step is re-scored through the real engine, so you feel
 * where it starts to work instead of being told. The AI's answer is a dashed
 * ghost you can snap to. The marker is the earliest anyone has to be home;
 * it's an aggregate, so it never says whose.
 */
export function RescueTimeline({
  fix,
  members,
  onUse,
}: {
  fix: Compromise;
  members: DemoMember[];
  onUse: (shifted: OptionSeed) => void;
}) {
  const reduce = useReducedMotion();
  const { option } = fix;
  const track = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [shift, setShift] = useState(0);
  const x = useMotionValue(0);

  const start0 = toMin(option.start);
  const end0 = toMin(option.end);
  const min = Math.max(0, Math.min(12 * 60, Math.floor(start0 / 60) * 60 - 120));
  const max = 24 * 60;
  const ppm = width / (max - min);

  useLayoutEffect(() => {
    const el = track.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const lo = -(start0 - min);
  const hi = max - end0;
  const clampShift = (s: number) => Math.min(hi, Math.max(lo, s));

  useMotionValueEvent(x, "change", (v) => {
    if (!ppm) return;
    const next = clampShift(Math.round(v / ppm / STEP) * STEP);
    setShift((prev) => {
      if (prev !== next) haptic("select");
      return next;
    });
  });

  const moved = useMemo<OptionSeed>(
    () => ({ ...option, start: toHHMM(start0 + shift), end: toHHMM(end0 + shift) }),
    [option, start0, end0, shift],
  );
  const scored = useMemo(() => scoreOption(moved, inputsOf(members)), [moved, members]);
  const kinds = blockersOf(scored);

  const earliestHome = Math.min(
    ...members.map((m) => (m.constraints.latestEnd ? toMin(m.constraints.latestEnd) : max)),
  );
  const ghostLeft = (toMin(fix.shifted.start) - min) * ppm;
  const blockWidth = (end0 - start0) * ppm;

  const go = (mins: number, velocity = 0) =>
    animate(x, clampShift(mins) * ppm, {
      type: "spring",
      bounce: 0,
      duration: reduce ? 0.01 : 0.34,
      velocity,
    });

  const onEnd = (_: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
    const landing = x.get() + project(info.velocity.x, 0.99);
    go(Math.round(landing / ppm / STEP) * STEP, info.velocity.x);
  };

  const label = `${option.title}, ${clockRange(moved.start, moved.end)}, ${
    scored.feasible ? "works for everyone" : "does not work yet"
  }`;

  return (
    <div className="rounded-2xl bg-secondary/70 p-4">
      <div className="text-sm font-medium">Drag {option.title} to a time that works</div>

      <div ref={track} className="relative mt-4 h-24 select-none">
        {TICKS.map((h) => (
          <div
            key={h}
            className="absolute inset-y-0 border-l border-border/70"
            style={{ left: (h * 60 - min) * ppm }}
          >
            <span className="absolute -bottom-5 -translate-x-1/2 text-[0.6875rem] text-muted-foreground tabular-nums">
              {clock(`${h}:00`)}
            </span>
          </div>
        ))}

        {Number.isFinite(earliestHome) && earliestHome < max && (
          <div
            className="absolute inset-y-0 w-px bg-destructive/60"
            style={{ left: (earliestHome - min) * ppm }}
          >
            <span className="absolute -top-0.5 right-1.5 text-[0.6875rem] whitespace-nowrap text-destructive tabular-nums">
              home by {clock(toHHMM(earliestHome))}
            </span>
          </div>
        )}

        <div
          aria-hidden
          className="absolute top-8 h-12 rounded-xl border border-dashed border-primary/60"
          style={{ left: ghostLeft, width: blockWidth }}
        />

        <motion.div
          role="slider"
          tabIndex={0}
          aria-label={`Move ${option.title}`}
          aria-valuemin={min}
          aria-valuemax={max - (end0 - start0)}
          aria-valuenow={start0 + shift}
          aria-valuetext={label}
          drag="x"
          dragConstraints={{ left: lo * ppm, right: hi * ppm }}
          dragElastic={0.12}
          dragMomentum={false}
          onDragEnd={onEnd}
          onKeyDown={(e) => {
            if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
            e.preventDefault();
            go(shift + (e.key === "ArrowLeft" ? -STEP : STEP));
          }}
          whileTap={{ scale: 0.98 }}
          animate={{
            backgroundColor: scored.feasible
              ? "color-mix(in oklab, var(--success) 24%, transparent)"
              : "color-mix(in oklab, var(--destructive) 14%, transparent)",
          }}
          transition={{ duration: 0.2 }}
          style={{ x, left: (start0 - min) * ppm, width: blockWidth, touchAction: "pan-y" }}
          className={
            scored.feasible
              ? "absolute top-8 flex h-12 cursor-grab flex-col justify-center overflow-hidden rounded-xl px-2.5 ring-2 ring-success/70 outline-none focus-visible:ring-4 active:cursor-grabbing"
              : "absolute top-8 flex h-12 cursor-grab flex-col justify-center overflow-hidden rounded-xl px-2.5 ring-1 ring-destructive/50 outline-none focus-visible:ring-4 active:cursor-grabbing"
          }
        >
          <span className="truncate text-xs leading-tight font-semibold">{option.title}</span>
          <span className="truncate text-[0.6875rem] leading-tight text-muted-foreground tabular-nums">
            {clockRange(moved.start, moved.end)}
          </span>
        </motion.div>
      </div>

      <div className="mt-8 flex items-center justify-between gap-3" aria-live="polite">
        <span
          className={
            scored.feasible
              ? "inline-flex items-center gap-1.5 text-sm font-medium text-success"
              : "inline-flex items-center gap-1.5 text-sm font-medium text-destructive"
          }
        >
          {scored.feasible ? <Check className="size-4" /> : <X className="size-4" />}
          {scored.feasible
            ? `Works for all ${members.length}`
            : `Still ruled out by ${kinds.map((k) => BLOCKER_LABEL[k].toLowerCase()).join(", ") || "a group limit"}`}
        </span>
        <button
          type="button"
          onClick={() => {
            haptic("tap");
            go(-fix.shiftMinutes);
          }}
          className="tap-target inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 text-sm text-primary"
        >
          <Sparkles className="size-3.5" /> Show me the fix
        </button>
      </div>

      <button
        type="button"
        disabled={!scored.feasible}
        onClick={() => {
          haptic("success");
          onUse(moved);
        }}
        className="pressable active:pressable-active mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-40"
      >
        Use this time
      </button>
    </div>
  );
}
