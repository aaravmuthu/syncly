import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { haptic } from "@/lib/quorum/haptics";
import { cn } from "@/lib/utils";

/** "21:30" -> "9:30 pm", "16:00" -> "4 pm". */
export function clock(t: string, withSuffix = true) {
  const [h, m] = t.split(":").map(Number);
  const h12 = h % 12 || 12;
  const base = m ? `${h12}:${String(m).padStart(2, "0")}` : `${h12}`;
  return withSuffix ? `${base} ${h < 12 ? "am" : "pm"}` : base;
}

export function clockRange(a: string, b: string) {
  const samePeriod = Number(a.split(":")[0]) < 12 === Number(b.split(":")[0]) < 12;
  return `${clock(a, !samePeriod)}–${clock(b)}`;
}

/** "Maya, Dev, Sofia and Theo". */
export function joinNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** Where a flick at `velocity` (px/s) would coast to rest. Apple's exponential-decay projection. */
export function project(velocity: number, decelerationRate = 0.998) {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

export const SPRING = { type: "spring", stiffness: 420, damping: 34 } as const;
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** The blur-and-rise swap used wherever a headline changes. */
export function useSwap() {
  const reduce = useReducedMotion();
  return reduce
    ? { initial: false as const, animate: {}, exit: {} }
    : {
        initial: { opacity: 0, y: 8, filter: "blur(6px)" },
        animate: { opacity: 1, y: 0, filter: "blur(0px)" },
        exit: { opacity: 0, y: -8, filter: "blur(6px)" },
        transition: { duration: 0.32, ease: EASE_OUT },
      };
}

/** A number that counts to its new value instead of snapping. */
export function AnimatedNumber({
  value,
  prefix = "",
  suffix = "",
  className,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) => `${prefix}${Math.round(v)}${suffix}`);
  const first = useRef(true);
  useEffect(() => {
    if (first.current || reduce) {
      first.current = false;
      mv.set(value);
      return;
    }
    const c = animate(mv, value, { duration: 0.55, ease: EASE_OUT });
    return () => c.stop();
  }, [value, mv, reduce]);
  return <motion.span className={cn("tabular-nums", className)}>{text}</motion.span>;
}

/** Reveals text a few characters at a time, like it's being written. */
export function Typewriter({
  text,
  onDone,
  className,
}: {
  text: string;
  onDone?: () => void;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? text.length : 0);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (reduce) {
      setN(text.length);
      done.current?.();
      return;
    }
    setN(0);
    let i = 0;
    const id = window.setInterval(() => {
      i = Math.min(text.length, i + 3);
      setN(i);
      if (i >= text.length) {
        window.clearInterval(id);
        done.current?.();
      }
    }, 22);
    return () => window.clearInterval(id);
  }, [text, reduce]);
  return (
    <span className={className}>
      {text.slice(0, n)}
      {n < text.length && (
        <span className="ml-0.5 inline-block h-[1em] w-px translate-y-0.5 bg-current opacity-50" />
      )}
    </span>
  );
}

export function Fact({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-secondary/70 px-3 py-2.5">
      <dt className="flex items-center gap-1 text-xs text-muted-foreground">
        <Icon className="size-3.5" aria-hidden /> {label}
      </dt>
      <dd className="mt-0.5 text-[0.9375rem] font-semibold whitespace-nowrap tabular-nums">
        {children}
      </dd>
    </div>
  );
}

export function Disclosure({
  label,
  meta,
  className,
  defaultOpen = false,
  children,
}: {
  label: string;
  meta?: string;
  className?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const reduce = useReducedMotion();
  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="tap-target flex w-full items-center justify-between gap-3 text-left"
      >
        <span>
          <span className="text-[0.9375rem] font-medium">{label}</span>
          {meta && <span className="ml-2 text-sm text-muted-foreground">{meta}</span>}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-300",
            open && "rotate-180",
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE_OUT }}
            className="overflow-hidden"
          >
            <div className="pt-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label}>
      <div className="mb-2 text-sm text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

export function Range({
  label,
  value,
  current,
  onChange,
  ...bounds
}: {
  label: string;
  value: string;
  current: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-base font-semibold tabular-nums">{value}</span>
      </span>
      <input
        type="range"
        {...bounds}
        value={current}
        onChange={(e) => {
          haptic("select");
          onChange(Number(e.target.value));
        }}
        className="mt-1 h-11 w-full cursor-pointer accent-primary"
      />
    </label>
  );
}

export function Chip({
  on,
  onClick,
  className,
  children,
}: {
  on: boolean;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "pressable active:pressable-active min-h-11 rounded-full border px-3.5 text-sm whitespace-nowrap tabular-nums transition-colors",
        on
          ? "border-primary bg-primary/10 font-semibold text-primary"
          : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}
