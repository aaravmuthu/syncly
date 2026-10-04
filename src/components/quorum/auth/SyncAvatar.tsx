import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  animate,
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import { cn } from "@/lib/utils";
import { gazePoint } from "./gaze-point";
import type { Follow } from "./useAvatarFollow";

/**
 * Sync, the companion: the app mark's dark glass tile with a small glowing
 * face. Eyes, brows, mouth and cheeks are each driven by their own spring, and
 * every mood is just a row in the FACES table, so a new expression is one
 * entry. Decorative: the form carries every state in text, so the whole thing
 * stays hidden from assistive tech.
 *
 * Form-driven moods (the caller picks these):
 *   idle        follows the pointer in 3D, blinks, falls asleep if ignored
 *   watching    follows a field's caret; curious at buttons, focused when you
 *               type fast, a wink when you tap a choice
 *   private     eyes closed, head turned away
 *   happy       arched eyes, a grin, a hop
 *   thinking    eyes circle while a request runs
 *   alert       eyes wide, brows up, one shake
 * Expressive extras (callers can ask for them too):
 *   smile  love  wink  curious  focus  surprised  sleepy  celebrate  oops
 *
 * Touch it: press to squish, release to get hearts, tap four times for a flip
 * with a burst of sparkles. Left alone it glances about, winks, smiles, and
 * eventually dozes off; any movement wakes it with a start.
 */
export type SyncMood =
  | "idle"
  | "watching"
  | "private"
  | "happy"
  | "thinking"
  | "alert"
  | "smile"
  | "love"
  | "wink"
  | "curious"
  | "focus"
  | "surprised"
  | "sleepy"
  | "celebrate"
  | "oops";

type Eye = "open" | "arc" | "heart";
type Tint = "calm" | "glad" | "shy" | "warn";
type Face = {
  eyes: [Eye, Eye];
  /** Eyelid openness per eye, 1 = open, ~0 = shut. */
  lid: [number, number];
  /** Pupil scale. */
  size: number;
  /** Brows: opacity, raise (% of tile) and inner-end-down tilt (degrees), per eye. */
  brow: { op: number; y: [number, number]; tilt: [number, number] };
  /** Mouth lens in a 100-unit tile: half width, top and bottom bulge, fill. */
  mouth: { op: number; w: number; up: number; down: number; fill: number };
  cheek: number;
  /** Head roll in degrees, and a lean toward (>1) or away from (<1) you. */
  roll: number;
  lean: number;
  tint: Tint;
};

const BASE: Face = {
  eyes: ["open", "open"],
  lid: [1, 1],
  size: 1,
  brow: { op: 0, y: [0, 0], tilt: [0, 0] },
  mouth: { op: 0, w: 7, up: 2, down: 2.4, fill: 0 },
  cheek: 0,
  roll: 0,
  lean: 1,
  tint: "calm",
};
const face = (p: Partial<Face>): Face => ({ ...BASE, ...p });

// The idle face is deliberately bare (eyes only) so the resting state stays
// calm; brows and mouth appear only when an expression asks for them.
const FACES: Record<SyncMood, Face> = {
  idle: face({}),
  watching: face({ lean: 1.025 }),
  smile: face({
    mouth: { op: 0.9, w: 9, up: 2.6, down: 3.2, fill: 0 },
    cheek: 0.35,
    tint: "glad",
  }),
  happy: face({
    eyes: ["arc", "arc"],
    mouth: { op: 1, w: 9.5, up: 1.8, down: 6.6, fill: 0.4 },
    cheek: 0.6,
    tint: "glad",
  }),
  love: face({
    eyes: ["heart", "heart"],
    mouth: { op: 1, w: 8.5, up: 2, down: 6, fill: 0.35 },
    cheek: 0.95,
    tint: "glad",
  }),
  wink: face({
    eyes: ["arc", "open"],
    brow: { op: 0.75, y: [0, 3], tilt: [0, 0] },
    mouth: { op: 0.95, w: 9, up: 2.8, down: 4.4, fill: 0.15 },
    cheek: 0.45,
    roll: 5,
    tint: "glad",
  }),
  curious: face({
    lid: [1.08, 0.9],
    size: 1.04,
    brow: { op: 0.85, y: [5, 0], tilt: [-4, 0] },
    mouth: { op: 0.75, w: 3.8, up: -3, down: 3.4, fill: 0.25 },
    roll: -7,
    lean: 1.03,
  }),
  focus: face({
    lid: [0.8, 0.8],
    brow: { op: 0.7, y: [-1, -1], tilt: [10, 10] },
    mouth: { op: 0.65, w: 6, up: 0.2, down: 0.5, fill: 0 },
    lean: 1.035,
  }),
  surprised: face({
    lid: [1.18, 1.18],
    size: 1.12,
    brow: { op: 1, y: [7, 7], tilt: [0, 0] },
    mouth: { op: 1, w: 4.2, up: -4, down: 4.6, fill: 0.4 },
    lean: 0.96,
  }),
  sleepy: face({
    lid: [0.3, 0.3],
    mouth: { op: 0.5, w: 3, up: -1, down: 1.6, fill: 0.15 },
    roll: 6,
    lean: 0.985,
    tint: "shy",
  }),
  private: face({
    lid: [0.08, 0.08],
    mouth: { op: 0.55, w: 6, up: 2.8, down: 3.4, fill: 0 },
    cheek: 0.3,
    roll: -3,
    tint: "shy",
  }),
  thinking: face({
    lid: [0.9, 0.9],
    brow: { op: 0.8, y: [3, 0], tilt: [-3, 3] },
    mouth: { op: 0.65, w: 3.4, up: -2.2, down: 2.8, fill: 0.2 },
    roll: 3,
  }),
  alert: face({
    lid: [1.14, 1.14],
    size: 1.05,
    brow: { op: 1, y: [6, 6], tilt: [0, 0] },
    mouth: { op: 1, w: 4.6, up: -3.8, down: 4.8, fill: 0.35 },
    tint: "warn",
  }),
  oops: face({
    lid: [0.85, 0.85],
    brow: { op: 1, y: [2, 2], tilt: [-12, -12] },
    mouth: { op: 1, w: 7, up: -2.6, down: -3.2, fill: 0 },
    cheek: 0.5,
    roll: -4,
    tint: "warn",
  }),
  celebrate: face({
    eyes: ["arc", "arc"],
    brow: { op: 1, y: [6, 6], tilt: [0, 0] },
    mouth: { op: 1, w: 11, up: 1.4, down: 9.6, fill: 0.5 },
    cheek: 1,
    lean: 1.04,
    tint: "glad",
  }),
};

/** Moods a touch can turn into hearts, and the quiet ones idle gestures use. */
const PETTABLE: SyncMood[] = [
  "idle",
  "watching",
  "happy",
  "smile",
  "curious",
  "wink",
  "focus",
  "sleepy",
];
const GESTURES: SyncMood[] = ["wink", "smile", "curious"];

// Apple-style springs. Gaze is critically damped (ζ ≈ 1.0, response ~0.4s): it
// settles without overshoot and retargets from its live position and velocity
// on every keystroke. Tilt, press and the face are slightly under-damped
// because they are physical, momentum-carrying motions.
const GAZE_SPRING = { stiffness: 220, damping: 30, mass: 1 };
const TILT_SPRING = { stiffness: 150, damping: 19, mass: 1 };
const PRESS_SPRING = { stiffness: 420, damping: 24, mass: 1 };
const NUDGE_SPRING = { stiffness: 520, damping: 22, mass: 1 };
const FACE_SPRING = { type: "spring", duration: 0.38, bounce: 0.18 } as const;
const FADE = { duration: 0.2, ease: "easeOut" } as const;

const MAX_YAW = 11;
const MAX_PITCH = 9;
const FOLLOW_TILT = 0.55;
const PET_MS = 1100;
const FLIP_TAPS = 4;
const FLIP_WINDOW_MS = 2000;
const POINTER_IDLE_MS = 3000;
const SLEEP_AFTER_MS = 18000;
const WAKE_MS = 650;
const GESTURE_MS = 900;
const TAP_WINK_MS = 800;
const FAST_TYPING_KEYS = 5;
const FAST_TYPING_WINDOW_MS = 1200;
const FAST_TYPING_HOLD_MS = 1000;
const BURST_MS = 1700;

/** One brow: raised and tilted by the face, always above its eye. */
function Brow({
  op,
  y,
  tilt,
  flip,
  size,
}: {
  op: MotionValue<number>;
  y: MotionValue<number>;
  tilt: MotionValue<number>;
  flip: boolean;
  size: number;
}) {
  const lift = useTransform(y, (v) => -(v * size) / 100);
  const turn = useTransform(tilt, (v) => (flip ? -v : v));
  const transform = useMotionTemplate`translateY(${lift}px) rotate(${turn}deg)`;
  return <motion.span className="sync-avatar__brow" style={{ opacity: op, transform }} />;
}

/** The highlight in an eye; it fades as the lid closes so it never squashes into a bar. */
function Spark({ lid, shift }: { lid: MotionValue<number>; shift: MotionValue<string> }) {
  const opacity = useTransform(lid, [0.45, 0.8], [0, 1], { clamp: true });
  return <motion.span className="sync-avatar__spark" style={{ transform: shift, opacity }} />;
}

/** A burst of sparkles (celebrating) or hearts (loving) around the tile. */
function Burst({ kind, id }: { kind: "sparkle" | "hearts"; id: number }) {
  // The random spread is chosen once per burst, not on every render.
  const bits = useMemo(() => {
    const n = kind === "sparkle" ? 12 : 6;
    const jitter = (id * 37) % 7;
    return Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2 + jitter;
      const reach = 0.62 + ((i * 53 + id) % 5) * 0.07;
      return kind === "sparkle"
        ? {
            dx: Math.cos(a) * reach,
            dy: Math.sin(a) * reach,
            r: (i % 2 ? 1 : -1) * 90,
            d: (i % 4) * 25,
            hue: i % 3,
          }
        : {
            dx: (i - 2.5) * 0.14,
            dy: -(0.7 + (i % 3) * 0.14),
            r: (i % 2 ? 1 : -1) * 14,
            d: i * 110,
            hue: 3,
          };
    });
  }, [kind, id]);
  return (
    <span className="sync-avatar__burst" aria-hidden>
      {bits.map((b, i) => (
        <span
          key={i}
          className="sync-avatar__bit"
          data-kind={kind}
          data-hue={b.hue}
          style={
            {
              "--dx": b.dx,
              "--dy": b.dy,
              "--r": `${b.r}deg`,
              "--d": `${b.d}ms`,
            } as React.CSSProperties
          }
        >
          <svg viewBox="0 0 24 24" aria-hidden>
            {kind === "sparkle" ? (
              <path d="M12 0l2.6 8.4L24 12l-9.4 3.6L12 24l-2.6-8.4L0 12l9.4-3.6z" />
            ) : (
              <path d="M12 21C-4 10 3-1 12 6.5 21-1 28 10 12 21z" />
            )}
          </svg>
        </span>
      ))}
    </span>
  );
}

export function SyncAvatar({
  mood,
  look,
  follow,
  pulse = 0,
  size = 120,
  instant = false,
  className,
}: {
  mood: SyncMood;
  /** Horizontal gaze from -1 to 1 while watching or happy. */
  look?: number;
  /** An element to watch while watching or happy; takes over from `look`. */
  follow?: Follow | null;
  /** Bump on every keystroke; the tile gives a tiny nod each time. */
  pulse?: number;
  size?: number;
  /** Jump to each pose instead of springing there (screenshots and tests). */
  instant?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const snap = Boolean(reduce) || instant;
  const root = useRef<HTMLDivElement>(null);

  // Gaze, head and body.
  const gazeX = useSpring(0, GAZE_SPRING);
  const gazeY = useSpring(0, GAZE_SPRING);
  const tiltX = useSpring(0, TILT_SPRING);
  const tiltY = useSpring(0, TILT_SPRING);
  const press = useSpring(snap ? 1 : 0.86, PRESS_SPRING);
  const nudge = useSpring(0, NUDGE_SPRING);
  const shakeX = useMotionValue(0);
  const hopY = useMotionValue(0);
  const spin = useMotionValue(0);
  const orbit = useMotionValue(0);
  const roll = useMotionValue(0);
  const lean = useMotionValue(1);
  const flash = useMotionValue(0);

  // The face: one value per feature, all settled together from FACES.
  const lidL = useMotionValue(snap ? 1 : 0.06);
  const lidR = useMotionValue(snap ? 1 : 0.06);
  const eyeSize = useMotionValue(1);
  const browOp = useMotionValue(0);
  const browYL = useMotionValue(0);
  const browYR = useMotionValue(0);
  const browTL = useMotionValue(0);
  const browTR = useMotionValue(0);
  const mouthOp = useMotionValue(0);
  const mouthW = useMotionValue(BASE.mouth.w);
  const mouthUp = useMotionValue(BASE.mouth.up);
  const mouthDown = useMotionValue(BASE.mouth.down);
  const mouthFill = useMotionValue(0);
  const cheek = useMotionValue(0);

  const restingLid = useRef<[number, number]>([1, 1]);
  const touch = useRef({ pressed: false, hover: false });
  const taps = useRef<number[]>([]);
  const keys = useRef<number[]>([]);
  const lastActive = useRef(0);
  const petTimer = useRef<number>(undefined);
  const firstFace = useRef(true);

  const [pressed, setPressed] = useState(false);
  const [hover, setHover] = useState(false);
  const [pet, setPet] = useState<"love" | "celebrate" | null>(null);
  const [drowsy, setDrowsy] = useState(false);
  const [wake, setWake] = useState(false);
  const [gesture, setGesture] = useState<SyncMood | null>(null);
  const [typingFast, setTypingFast] = useState(false);
  const [tapWink, setTapWink] = useState(false);
  const [burst, setBurst] = useState<{ kind: "sparkle" | "hearts"; id: number } | null>(null);

  // What is actually showing: the caller's mood, unless the avatar has a more
  // specific reaction of its own to a touch, a tap, fast typing, or being ignored.
  let shown: SyncMood = mood;
  if (pet && PETTABLE.includes(mood)) shown = pet;
  else if (mood === "idle" && wake) shown = "surprised";
  else if (mood === "idle" && drowsy) shown = "sleepy";
  else if (mood === "idle" && gesture) shown = gesture;
  else if (mood === "watching") {
    shown = typingFast
      ? "focus"
      : tapWink
        ? "wink"
        : follow?.el.tagName === "BUTTON"
          ? "curious"
          : "watching";
  }
  const f = FACES[shown];

  const travelX = size * 0.09;
  const travelY = size * 0.06;

  const settle = useCallback(
    (mv: MotionValue<number>, to: number, spec: object = FACE_SPRING, delay = 0) => {
      if (snap) mv.jump(to);
      else animate(mv, to, { ...spec, delay });
    },
    [snap],
  );

  /** Point the gaze and the head at (nx, ny), each in [-1, 1]. */
  const aim = useCallback(
    (nx: number, ny: number, tilt = 1) => {
      if (snap) {
        gazeX.jump(nx * travelX);
        gazeY.jump(ny * travelY);
        return;
      }
      gazeX.set(nx * travelX);
      gazeY.set(ny * travelY);
      tiltY.set(nx * MAX_YAW * tilt);
      tiltX.set(-ny * MAX_PITCH * tilt);
    },
    [snap, gazeX, gazeY, tiltX, tiltY, travelX, travelY],
  );

  // The face: every feature springs to the pose for what is showing.
  useEffect(() => {
    const openScale = pressed ? 0.45 : hover ? 1.06 : 1;
    const lids: [number, number] = [
      f.lid[0] * (f.eyes[0] === "open" ? openScale : 1),
      f.lid[1] * (f.eyes[1] === "open" ? openScale : 1),
    ];
    restingLid.current = lids;
    // On first paint the eyes open a beat after the tile pops in.
    const delay = firstFace.current ? 0.18 : 0;
    firstFace.current = false;
    settle(lidL, lids[0], FACE_SPRING, delay);
    settle(lidR, lids[1], FACE_SPRING, delay);
    settle(eyeSize, f.size);
    settle(browOp, f.brow.op, FADE);
    settle(browYL, f.brow.y[0]);
    settle(browYR, f.brow.y[1]);
    settle(browTL, f.brow.tilt[0]);
    settle(browTR, f.brow.tilt[1]);
    settle(mouthOp, f.mouth.op, FADE);
    settle(mouthW, f.mouth.w);
    settle(mouthUp, f.mouth.up);
    settle(mouthDown, f.mouth.down);
    settle(mouthFill, f.mouth.fill, FADE);
    settle(cheek, f.cheek, FADE);
    settle(roll, f.roll);
    settle(lean, f.lean);
  }, [
    f,
    pressed,
    hover,
    settle,
    lidL,
    lidR,
    eyeSize,
    browOp,
    browYL,
    browYR,
    browTL,
    browTR,
    mouthOp,
    mouthW,
    mouthUp,
    mouthDown,
    mouthFill,
    cheek,
    roll,
    lean,
  ]);

  // The pop-in on arrival.
  useEffect(() => {
    if (snap) press.jump(1);
    else press.set(1);
  }, [snap, press]);

  // Body motion for the mood: shake, hop, spin, startle, orbit.
  useEffect(() => {
    if (shown !== "alert" && shown !== "oops")
      animate(shakeX, 0, { duration: 0.15, ease: "easeOut" });
    const hopsFor: Partial<Record<SyncMood, number>> = {
      happy: 0.1,
      celebrate: 0.15,
      love: 0.06,
      surprised: 0.09,
    };
    if (!hopsFor[shown]) animate(hopY, 0, { type: "spring", duration: 0.3, bounce: 0 });
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

    if (shown === "alert" || shown === "oops") {
      const out = shown === "alert" ? 6 : 4;
      const shake = animate(shakeX, [0, -out, out, -out * 0.65, out * 0.65, 0], {
        duration: 0.4,
        ease: "easeOut",
      });
      return () => shake.stop();
    }

    const hop = hopsFor[shown];
    if (hop) {
      let cancelled = false;
      let down: ReturnType<typeof animate> | undefined;
      const startle = shown === "surprised";
      const up = animate(hopY, -size * hop, {
        type: "spring",
        duration: startle ? 0.14 : 0.22,
        bounce: 0,
      });
      void up.then(() => {
        if (!cancelled)
          down = animate(hopY, 0, { type: "spring", duration: 0.5, bounce: startle ? 0.1 : 0.3 });
      });
      const turn =
        shown === "celebrate"
          ? animate(spin, spin.get() + 360, { type: "spring", duration: 0.95, bounce: 0.15 })
          : undefined;
      return () => {
        cancelled = true;
        up.stop();
        down?.stop();
        turn?.stop();
      };
    }
  }, [shown, reduce, shakeX, hopY, spin, orbit, aim, size]);

  // Sparkles when celebrating, hearts when loving.
  useEffect(() => {
    if (reduce || (shown !== "celebrate" && shown !== "love")) return;
    setBurst((b) => ({ kind: shown === "celebrate" ? "sparkle" : "hearts", id: (b?.id ?? 0) + 1 }));
    const t = window.setTimeout(() => setBurst(null), BURST_MS);
    return () => window.clearTimeout(t);
  }, [shown, reduce]);

  // Gaze and head for the form-driven moods (thinking owns its own orbit above).
  useEffect(() => {
    if (mood === "thinking") {
      if (snap) aim(0, -0.2);
    } else if ((mood === "watching" || mood === "happy") && follow) {
      const aimAtTarget = () => {
        const point = gazePoint(follow.el);
        const rect = root.current?.getBoundingClientRect();
        if (!point || !rect) return;
        const dx = point.x - (rect.left + rect.width / 2);
        const dy = point.y - (rect.top + rect.height / 2);
        const dist = Math.hypot(dx, dy) || 1;
        const k = (Math.min(dist / 360, 1) * 0.9) / dist;
        aim(dx * k, dy * k, FOLLOW_TILT);
      };
      aimAtTarget();
      if (reduce) return;
      // The page can scroll under a fixed gaze (a phone keyboard opening, say).
      let frame = 0;
      const again = () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(aimAtTarget);
      };
      window.addEventListener("scroll", again, { passive: true, capture: true });
      window.addEventListener("resize", again);
      return () => {
        cancelAnimationFrame(frame);
        window.removeEventListener("scroll", again, true);
        window.removeEventListener("resize", again);
      };
    } else if ((mood === "watching" || mood === "happy") && look !== undefined) {
      aim(look * 0.9, 0.7); // down toward the field the text is going into
    } else if (mood === "private") {
      aim(-0.8, 0.15); // turned politely away
    } else if (mood !== "idle") {
      aim(0, 0);
    }
  }, [mood, look, follow, reduce, snap, aim]);

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

  // Blink, with the odd double blink. Skipped while the eyes are shut.
  useEffect(() => {
    if (reduce) return;
    let timer: number;
    const schedule = () => {
      timer = window.setTimeout(() => blink(Math.random() < 0.2), 2800 + Math.random() * 3200);
    };
    const blink = (again: boolean) => {
      const [l, r] = restingLid.current;
      if (l < 0.5 && r < 0.5) return schedule();
      void animate(lidL, l * 0.06, { duration: 0.07, ease: "easeOut" }).then(() =>
        animate(lidL, restingLid.current[0], { duration: 0.12, ease: "easeOut" }),
      );
      void animate(lidR, r * 0.06, { duration: 0.07, ease: "easeOut" }).then(() =>
        animate(lidR, restingLid.current[1], { duration: 0.12, ease: "easeOut" }),
      );
      if (again) timer = window.setTimeout(() => blink(false), 220);
      else schedule();
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, [reduce, lidL, lidR]);

  // Left alone it dozes off; any sign of life wakes it with a start.
  const asleep = useRef(false);
  asleep.current = drowsy;
  const calmNow = useRef(mood === "idle");
  calmNow.current = mood === "idle";
  useEffect(() => {
    if (reduce) return;
    lastActive.current = performance.now();
    let wakeTimer: number;
    const bump = () => {
      lastActive.current = performance.now();
      if (!asleep.current) return;
      setDrowsy(false);
      setWake(true);
      window.clearTimeout(wakeTimer);
      wakeTimer = window.setTimeout(() => setWake(false), WAKE_MS);
    };
    const events = ["pointermove", "pointerdown", "keydown", "scroll", "touchstart"] as const;
    for (const e of events) window.addEventListener(e, bump, { passive: true, capture: true });
    const check = window.setInterval(() => {
      if (calmNow.current && performance.now() - lastActive.current > SLEEP_AFTER_MS)
        setDrowsy(true);
    }, 2000);
    return () => {
      for (const e of events) window.removeEventListener(e, bump, true);
      window.clearInterval(check);
      window.clearTimeout(wakeTimer);
    };
  }, [reduce]);

  // Small unprompted moments while idle: a wink, a smile, a curious tilt.
  useEffect(() => {
    if (reduce || mood !== "idle") return;
    let timer: number;
    let clear: number;
    const next = () => {
      timer = window.setTimeout(
        () => {
          if (!asleep.current) {
            setGesture(GESTURES[Math.floor(Math.random() * GESTURES.length)]!);
            clear = window.setTimeout(() => setGesture(null), GESTURE_MS);
          }
          next();
        },
        6500 + Math.random() * 5000,
      );
    };
    next();
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(clear);
      setGesture(null);
    };
  }, [mood, reduce]);

  // Tapping a choice earns a wink.
  const tick = follow?.tick;
  const followedButton = follow?.el.tagName === "BUTTON";
  useEffect(() => {
    if (!followedButton || reduce) return;
    setTapWink(true);
    const t = window.setTimeout(() => setTapWink(false), TAP_WINK_MS);
    return () => window.clearTimeout(t);
  }, [followedButton, tick, reduce]);

  // Each keystroke: a tiny nod and a flicker of light in the eyes. Type fast
  // and it narrows its eyes and concentrates until you slow down.
  const lastPulse = useRef(pulse);
  useEffect(() => {
    if (pulse === lastPulse.current) return;
    lastPulse.current = pulse;
    if (reduce || (mood !== "watching" && mood !== "happy")) return;

    nudge.set(-size * 0.025);
    const settleNod = window.setTimeout(() => nudge.set(0), 70);
    flash.jump(1);
    animate(flash, 0, { duration: 0.35, ease: "easeOut" });

    const now = performance.now();
    keys.current = [...keys.current.filter((t) => now - t < FAST_TYPING_WINDOW_MS), now];
    let hold: number | undefined;
    if (keys.current.length >= FAST_TYPING_KEYS) {
      setTypingFast(true);
      hold = window.setTimeout(() => setTypingFast(false), FAST_TYPING_HOLD_MS);
    }
    return () => {
      window.clearTimeout(settleNod);
      // The hold is left to run out on its own so a keystroke does not cancel it.
      if (hold !== undefined)
        window.setTimeout(() => window.clearTimeout(hold), FAST_TYPING_HOLD_MS);
    };
  }, [pulse, mood, reduce, nudge, flash, size]);

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

    const now = performance.now();
    taps.current = [...taps.current.filter((t) => now - t < FLIP_WINDOW_MS), now];
    const flip = taps.current.length >= FLIP_TAPS;
    if (flip) taps.current = [];
    setPet(flip ? "celebrate" : "love");
    window.clearTimeout(petTimer.current);
    petTimer.current = window.setTimeout(() => setPet(null), flip ? PET_MS + 500 : PET_MS);
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
  const turn = useTransform([spin, roll], ([a, b]: number[]) => a + b);
  const scale = useTransform([press, lean], ([a, b]: number[]) => a * b);
  const body = useMotionTemplate`translate3d(${shakeX}px, ${lift}px, 0) rotateX(${tiltX}deg) rotateY(${tiltY}deg) rotateZ(${turn}deg) scale(${scale})`;
  const gaze = useMotionTemplate`translate3d(${gazeX}px, ${gazeY}px, 0)`;
  const lidScaleL = useMotionTemplate`scale(${eyeSize}) scaleY(${lidL})`;
  const lidScaleR = useMotionTemplate`scale(${eyeSize}) scaleY(${lidR})`;
  // The glass sheen slides against the tilt, so the surface reads as curved.
  const sheenX = useTransform(tiltY, (v) => -v * size * 0.014);
  const sheenY = useTransform(tiltX, (v) => v * size * 0.014);
  const sheen = useMotionTemplate`translate3d(${sheenX}px, ${sheenY}px, 0)`;
  const sparkX = useTransform(gazeX, (v) => v * 0.25);
  const sparkY = useTransform(gazeY, (v) => v * 0.25);
  const spark = useMotionTemplate`translate3d(${sparkX}px, ${sparkY}px, 0)`;
  // The mouth drifts with the gaze, a little less than the eyes, for depth.
  const mouthX = useTransform(gazeX, (v) => v * 0.55);
  const mouthY = useTransform(gazeY, (v) => v * 0.55);
  const mouthShift = useMotionTemplate`translate3d(${mouthX}px, ${mouthY}px, 0)`;
  const x1 = useTransform(mouthW, (w) => 50 - w);
  const x2 = useTransform(mouthW, (w) => 50 + w);
  const yTop = useTransform(mouthUp, (v) => 68 + v * 2);
  const yBottom = useTransform(mouthDown, (v) => 68 + v * 2);
  const mouthPath = useMotionTemplate`M ${x1} 68 Q 50 ${yTop} ${x2} 68 Q 50 ${yBottom} ${x1} 68 Z`;
  const glow = useTransform(flash, [0, 1], [0.3, 0.9]);
  // The contact shadow tightens as the tile hops away from the surface.
  const shadowScale = useTransform(lift, [-size * 0.15, 0], [0.74, 1], { clamp: true });
  const shadow = useMotionTemplate`scaleX(${shadowScale})`;

  const eye = (i: 0 | 1) => (
    <div key={i} className="sync-avatar__eye" data-eye={f.eyes[i]}>
      <Brow
        op={browOp}
        y={i === 0 ? browYL : browYR}
        tilt={i === 0 ? browTL : browTR}
        flip={i === 1}
        size={size}
      />
      <div className="sync-avatar__open">
        <motion.div
          className="sync-avatar__pupil"
          style={{ transform: i === 0 ? lidScaleL : lidScaleR }}
        >
          <Spark lid={i === 0 ? lidL : lidR} shift={spark} />
        </motion.div>
      </div>
      <div className="sync-avatar__arc" />
      <svg className="sync-avatar__heart" viewBox="0 0 24 22" aria-hidden>
        <path d="M12 21C-4 10 3-1 12 6.5 21-1 28 10 12 21z" />
      </svg>
    </div>
  );

  return (
    <div
      ref={root}
      aria-hidden="true"
      data-mood={shown}
      data-tint={f.tint}
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
      {burst && !reduce && <Burst key={burst.id} kind={burst.kind} id={burst.id} />}
      {shown === "sleepy" && !reduce && (
        <span className="sync-avatar__zzz" aria-hidden>
          <i>z</i>
          <i>z</i>
          <i>z</i>
        </span>
      )}
      <motion.div className="sync-avatar__body" style={{ transform: body }}>
        <div className="sync-avatar__breathe">
          <div className="sync-avatar__tile">
            <motion.div className="sync-avatar__sheen" style={{ transform: sheen }} />
            <motion.span className="sync-avatar__cheek" data-side="l" style={{ opacity: cheek }} />
            <motion.span className="sync-avatar__cheek" data-side="r" style={{ opacity: cheek }} />
            <motion.div className="sync-avatar__eyes" style={{ transform: gaze }}>
              <motion.span className="sync-avatar__glow" style={{ opacity: glow }} />
              {eye(0)}
              {eye(1)}
            </motion.div>
            <motion.div
              className="sync-avatar__mouth"
              style={{ transform: mouthShift, opacity: mouthOp }}
            >
              <svg viewBox="0 0 100 100" aria-hidden>
                <motion.path d={mouthPath} style={{ fillOpacity: mouthFill }} />
              </svg>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
