import { useCallback, useEffect, useRef, useState } from "react";
import {
  animate,
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import { cn } from "@/lib/utils";

/**
 * The sign-up companion: the app mark's dark glass tile with two glowing eyes
 * that react to the form and to touch. Decorative — the form carries every
 * state in text, so the whole thing stays hidden from assistive tech.
 *
 * - idle      follows the pointer in 3D (fine pointers) or glances about (touch)
 * - watching  looks along the email field as it fills, leaning toward it
 * - happy     eyes curve into smiles (valid email, account created, petted)
 * - private   eyes close and the head turns away while a password is typed
 * - thinking  eyes circle while the request is in flight
 * - alert     eyes turn amber and widen, one shake, on an error
 *
 * Press it and it squishes; let go and it purrs; tap it four times fast and it
 * does a flip.
 */
export type SyncMood = "idle" | "watching" | "private" | "happy" | "thinking" | "alert";

// Apple-style springs. Gaze is critically damped (ζ ≈ 1.0, response ~0.4s): it
// settles without overshoot and retargets from its live position and velocity
// on every keystroke. Tilt and press are slightly under-damped because they are
// physical, momentum-carrying motions.
const GAZE_SPRING = { stiffness: 220, damping: 30, mass: 1 };
const TILT_SPRING = { stiffness: 150, damping: 19, mass: 1 };
const PRESS_SPRING = { stiffness: 420, damping: 24, mass: 1 };
const NUDGE_SPRING = { stiffness: 520, damping: 22, mass: 1 };

const MAX_YAW = 11;
const MAX_PITCH = 9;
const PET_MS = 1100;
const FLIP_TAPS = 4;
const FLIP_WINDOW_MS = 2000;
const POINTER_IDLE_MS = 3000;

const LID_OPEN = 1;
const LID_CLOSED = 0.08;
const LID_WIDE = 1.14;
const LID_SQUINT = 0.42;
const LID_HOVER = 1.06;

export function SyncAvatar({
  mood,
  look,
  pulse = 0,
  size = 120,
  className,
}: {
  mood: SyncMood;
  /** Horizontal gaze from -1 to 1 while watching or happy. */
  look?: number;
  /** Bump on every keystroke; the tile gives a tiny nod each time. */
  pulse?: number;
  size?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);

  const gazeX = useSpring(0, GAZE_SPRING);
  const gazeY = useSpring(0, GAZE_SPRING);
  const tiltX = useSpring(0, TILT_SPRING);
  const tiltY = useSpring(0, TILT_SPRING);
  const press = useSpring(1, PRESS_SPRING);
  const nudge = useSpring(0, NUDGE_SPRING);
  const lid = useMotionValue(LID_OPEN);
  const shakeX = useMotionValue(0);
  const hopY = useMotionValue(0);
  const spin = useMotionValue(0);
  const orbit = useMotionValue(0);

  const restingLid = useRef(LID_OPEN);
  const touch = useRef({ pressed: false, hover: false });
  const taps = useRef<number[]>([]);
  const petTimer = useRef<number>(undefined);
  const [pressed, setPressed] = useState(false);
  const [hover, setHover] = useState(false);
  const [pet, setPet] = useState(false);

  // A pet only reads as affection when nothing more important is going on.
  const shown: SyncMood =
    pet && (mood === "idle" || mood === "watching" || mood === "happy") ? "happy" : mood;

  const travelX = size * 0.09;
  const travelY = size * 0.06;

  /** Point the gaze and the head at (nx, ny), each in [-1, 1]. */
  const aim = useCallback(
    (nx: number, ny: number) => {
      if (reduce) {
        gazeX.jump(nx * travelX);
        gazeY.jump(ny * travelY);
        return;
      }
      gazeX.set(nx * travelX);
      gazeY.set(ny * travelY);
      tiltY.set(nx * MAX_YAW);
      tiltX.set(-ny * MAX_PITCH);
    },
    [reduce, gazeX, gazeY, tiltX, tiltY, travelX, travelY],
  );

  // Eyelids: mood first, then touch.
  useEffect(() => {
    const target =
      mood === "private" || shown === "private"
        ? LID_CLOSED
        : shown === "alert"
          ? LID_WIDE
          : pressed
            ? LID_SQUINT
            : shown === "thinking" && reduce
              ? 0.8
              : hover
                ? LID_HOVER
                : LID_OPEN;
    restingLid.current = target;
    const controls = animate(
      lid,
      target,
      reduce
        ? { duration: 0.15 }
        : { type: "spring", duration: 0.3, bounce: shown === "alert" ? 0.3 : 0 },
    );
    return () => controls.stop();
  }, [mood, shown, pressed, hover, reduce, lid]);

  // One-shot and looping body motion for the mood: shake, hop, orbit.
  useEffect(() => {
    if (shown !== "alert") animate(shakeX, 0, { duration: 0.15, ease: "easeOut" });
    if (shown !== "happy") animate(hopY, 0, { type: "spring", duration: 0.3, bounce: 0 });
    if (reduce) return;

    if (shown === "thinking") {
      const spinning = animate(orbit, orbit.get() + Math.PI * 2, {
        duration: 1.4,
        ease: "linear",
        repeat: Infinity,
      });
      const follow = orbit.on("change", (a) => aim(Math.cos(a) * 0.8, Math.sin(a) * 0.8));
      return () => {
        spinning.stop();
        follow();
      };
    }

    if (shown === "alert") {
      const shake = animate(shakeX, [0, -6, 6, -4, 4, 0], { duration: 0.4, ease: "easeOut" });
      return () => shake.stop();
    }

    if (shown === "happy") {
      let cancelled = false;
      let down: ReturnType<typeof animate> | undefined;
      const up = animate(hopY, -size * 0.1, { type: "spring", duration: 0.22, bounce: 0 });
      void up.then(() => {
        if (!cancelled) down = animate(hopY, 0, { type: "spring", duration: 0.5, bounce: 0.3 });
      });
      return () => {
        cancelled = true;
        up.stop();
        down?.stop();
      };
    }
  }, [shown, reduce, shakeX, hopY, orbit, aim, size]);

  // Gaze and head for the form-driven moods (thinking owns its own orbit above).
  useEffect(() => {
    if (mood === "thinking") {
      if (reduce) aim(0, -0.2);
    } else if ((mood === "watching" || mood === "happy") && look !== undefined) {
      aim(look * 0.9, 0.7); // down toward the field the text is going into
    } else if (mood === "private") {
      aim(-0.8, 0.15); // turned politely away
    } else if (mood !== "idle") {
      aim(0, 0);
    }
  }, [mood, look, reduce, aim]);

  // Idle: track the pointer on desktop; glance about when it rests or on touch.
  useEffect(() => {
    if (mood !== "idle") return;
    aim(0, 0);
    if (reduce) return;

    let lastMove = -Infinity;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const onMove = (e: PointerEvent) => {
      const rect = root.current?.getBoundingClientRect();
      if (!rect) return;
      lastMove = performance.now();
      const dx = e.clientX - (rect.left + rect.width / 2);
      const dy = e.clientY - (rect.top + rect.height / 2);
      const dist = Math.hypot(dx, dy) || 1;
      const k = Math.min(dist / 260, 1) / dist;
      aim(dx * k, dy * k);
    };
    if (fine) window.addEventListener("pointermove", onMove, { passive: true });

    let timer: number;
    const glance = () => {
      if (!fine || performance.now() - lastMove > POINTER_IDLE_MS) {
        aim((Math.random() - 0.5) * 1.3, (Math.random() - 0.5) * 0.7);
      }
      timer = window.setTimeout(glance, 2200 + Math.random() * 2400);
    };
    timer = window.setTimeout(glance, 1400);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.clearTimeout(timer);
    };
  }, [mood, reduce, aim]);

  // Blink, with the odd double blink. Skipped while the eyes are closed.
  useEffect(() => {
    if (reduce) return;
    let timer: number;
    const schedule = () => {
      timer = window.setTimeout(() => blink(Math.random() < 0.2), 2800 + Math.random() * 3200);
    };
    const blink = (again: boolean) => {
      const rest = restingLid.current;
      if (rest < 0.5) return schedule();
      void animate(lid, rest * 0.06, { duration: 0.07, ease: "easeOut" }).then(() =>
        animate(lid, restingLid.current, { duration: 0.12, ease: "easeOut" }),
      );
      if (again) timer = window.setTimeout(() => blink(false), 220);
      else schedule();
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, [reduce, lid]);

  // A tiny nod per keystroke, only while it is paying attention to the form.
  const lastPulse = useRef(pulse);
  useEffect(() => {
    if (pulse === lastPulse.current) return;
    lastPulse.current = pulse;
    if (reduce || (mood !== "watching" && mood !== "happy")) return;
    nudge.set(-size * 0.025);
    const t = window.setTimeout(() => nudge.set(0), 70);
    return () => window.clearTimeout(t);
  }, [pulse, mood, reduce, nudge, size]);

  useEffect(() => () => window.clearTimeout(petTimer.current), []);

  const syncPress = () => press.set(touch.current.pressed ? 0.94 : touch.current.hover ? 1.04 : 1);

  const onPointerDown = () => {
    touch.current.pressed = true;
    setPressed(true);
    syncPress(); // respond on press, not on release
  };
  const onPointerUp = () => {
    if (!touch.current.pressed) return;
    touch.current.pressed = false;
    setPressed(false);
    syncPress();

    setPet(true);
    window.clearTimeout(petTimer.current);
    petTimer.current = window.setTimeout(() => setPet(false), PET_MS);

    const now = performance.now();
    taps.current = [...taps.current.filter((t) => now - t < FLIP_WINDOW_MS), now];
    if (taps.current.length >= FLIP_TAPS) {
      taps.current = [];
      if (!reduce) animate(spin, spin.get() + 360, { type: "spring", duration: 0.9, bounce: 0.15 });
    }
  };
  const onPointerEnter = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    touch.current.hover = true;
    setHover(true);
    syncPress();
  };
  const onPointerLeave = () => {
    touch.current = { pressed: false, hover: false };
    setPressed(false);
    setHover(false);
    syncPress();
  };

  const lift = useTransform([hopY, nudge], ([a, b]: number[]) => a + b);
  const body = useMotionTemplate`translate3d(${shakeX}px, ${lift}px, 0) rotateX(${tiltX}deg) rotateY(${tiltY}deg) rotateZ(${spin}deg) scale(${press})`;
  const gaze = useMotionTemplate`translate3d(${gazeX}px, ${gazeY}px, 0)`;
  const lidScale = useMotionTemplate`scaleY(${lid})`;
  // The glass sheen slides against the tilt, so the surface reads as curved.
  const sheenX = useTransform(tiltY, (v) => -v * size * 0.014);
  const sheenY = useTransform(tiltX, (v) => v * size * 0.014);
  const sheen = useMotionTemplate`translate3d(${sheenX}px, ${sheenY}px, 0)`;
  const sparkX = useTransform(gazeX, (v) => v * 0.25);
  const sparkY = useTransform(gazeY, (v) => v * 0.25);
  const spark = useMotionTemplate`translate3d(${sparkX}px, ${sparkY}px, 0)`;
  // The contact shadow tightens as the tile hops away from the surface.
  const shadowScale = useTransform(lift, [-size * 0.12, 0], [0.78, 1], { clamp: true });
  const shadow = useMotionTemplate`scaleX(${shadowScale})`;

  return (
    <div
      ref={root}
      aria-hidden="true"
      data-mood={shown}
      data-hover={hover}
      data-pressed={pressed}
      className={cn("sync-avatar", className)}
      style={{ "--s": `${size}px`, width: size, height: size } as React.CSSProperties}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerLeave}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <span className="sync-avatar__aura" />
      <motion.span className="sync-avatar__shadow" style={{ transform: shadow }} />
      <span className="sync-avatar__ring" />
      <motion.div className="sync-avatar__body" style={{ transform: body }}>
        <div className="sync-avatar__breathe">
          <div className="sync-avatar__tile">
            <motion.div className="sync-avatar__sheen" style={{ transform: sheen }} />
            <motion.div className="sync-avatar__eyes" style={{ transform: gaze }}>
              {[0, 1].map((i) => (
                <div key={i} className="sync-avatar__eye">
                  <div className="sync-avatar__open">
                    <motion.div className="sync-avatar__pupil" style={{ transform: lidScale }}>
                      <motion.span className="sync-avatar__spark" style={{ transform: spark }} />
                    </motion.div>
                  </div>
                  <div className="sync-avatar__arc" />
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
