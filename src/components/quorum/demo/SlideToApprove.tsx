import { useLayoutEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useTransform, type PanInfo } from "motion/react";
import { ArrowRight, Check } from "lucide-react";
import { haptic } from "@/lib/quorum/haptics";
import { project } from "./shared";

const HANDLE = 48;
const PAD = 4;

/*
 * A parent says yes by moving the handle across, not by tapping a button, so
 * an accidental brush can't approve. It follows the finger 1:1, rubber-bands
 * at both ends, and commits from where a flick would land (a quick short
 * throw is enough). Short of that it springs back with the release velocity.
 * Keyboard and assistive tech: Enter or Space on the handle approves.
 */
export function SlideToApprove({
  label,
  onApprove,
  disabled,
}: {
  label: string;
  onApprove: () => void;
  disabled?: boolean;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [max, setMax] = useState(0);
  const x = useMotionValue(0);
  const dragged = useRef(false);

  useLayoutEffect(() => {
    const el = track.current;
    if (!el) return;
    const measure = () => setMax(Math.max(0, el.clientWidth - HANDLE - PAD * 2));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const clip = useTransform(x, (v) => `inset(0 ${Math.max(0, max - v)}px 0 0 round 9999px)`);
  const labelOpacity = useTransform(x, [0, Math.max(1, max * 0.45)], [1, 0]);
  const tilt = useTransform(x, [0, Math.max(1, max)], [0, 1]);
  const arrowOpacity = useTransform(tilt, [0.7, 1], [1, 0]);
  const checkOpacity = useTransform(tilt, [0.7, 1], [0, 1]);

  const done = () => {
    haptic("success");
    onApprove();
  };

  const onEnd = (_: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
    const landing = x.get() + project(info.velocity.x, 0.99);
    if (landing > max * 0.62) {
      animate(x, max, {
        type: "spring",
        bounce: 0,
        duration: 0.24,
        velocity: info.velocity.x,
      }).then(done);
    } else {
      animate(x, 0, { type: "spring", bounce: 0.18, duration: 0.42, velocity: info.velocity.x });
    }
  };

  const hint = () => {
    animate(x, Math.min(34, max), { duration: 0.22, ease: [0.22, 1, 0.36, 1] }).then(() =>
      animate(x, 0, { type: "spring", stiffness: 380, damping: 24 }),
    );
  };

  return (
    <div
      ref={track}
      className="relative h-14 overflow-hidden rounded-full bg-secondary"
      style={{ opacity: disabled ? 0.4 : 1 }}
    >
      <motion.div
        aria-hidden
        style={{ clipPath: clip }}
        className="absolute inset-0 bg-success/25"
      />
      <motion.span
        style={{ opacity: labelOpacity }}
        className="pointer-events-none absolute inset-0 grid place-items-center pl-10 text-[0.9375rem] font-semibold"
      >
        {label}
      </motion.span>
      <motion.button
        type="button"
        disabled={disabled}
        aria-label={`${label}. Slide to approve, or press Enter.`}
        drag={disabled ? false : "x"}
        dragConstraints={{ left: 0, right: max }}
        dragElastic={{ left: 0.12, right: 0.12 }}
        dragMomentum={false}
        onDragStart={() => {
          dragged.current = true;
        }}
        onDragEnd={onEnd}
        onClick={(e) => {
          if (e.detail === 0) return done();
          if (dragged.current) {
            dragged.current = false;
            return;
          }
          hint();
        }}
        whileTap={{ scale: 0.96 }}
        style={{ x, left: PAD, top: PAD, width: HANDLE, height: HANDLE, touchAction: "pan-y" }}
        className="absolute grid cursor-grab place-items-center rounded-full bg-primary text-primary-foreground shadow-sm active:cursor-grabbing"
      >
        <motion.span style={{ opacity: arrowOpacity }} className="absolute">
          <ArrowRight className="size-5" />
        </motion.span>
        <motion.span style={{ opacity: checkOpacity }} className="absolute">
          <Check className="size-5" strokeWidth={3} />
        </motion.span>
      </motion.button>
    </div>
  );
}
