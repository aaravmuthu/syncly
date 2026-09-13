import type { ReactNode } from "react";
import { motion } from "motion/react";
import type { LucideIcon } from "lucide-react";
import { haptic } from "@/lib/quorum/haptics";
import { cn } from "@/lib/utils";



export function Card({
  children,
  className,
  as: As = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
}) {
  return <As className={cn("surface p-5", className)}>{children}</As>;
}

export function Pill({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad" | "accent";
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-secondary text-secondary-foreground",
    good: "bg-success/15 text-success",
    warn: "bg-warning/18 text-warning",
    bad: "bg-destructive/12 text-destructive",
    accent: "bg-primary/12 text-primary",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export type PillTone = "neutral" | "good" | "warn" | "bad" | "accent";

/**
 * Canonical plan/vote status -> semantic tone. Single source of truth so
 * Home, Groups, and Plans don't each invent their own emerald/amber/indigo
 * mapping for the same underlying states.
 */
export function statusTone(status: string): PillTone {
  switch (status) {
    case "voting":
    case "collecting":
    case "recommending":
      return "accent";
    case "finalized":
    case "completed":
      return "good";
    case "cancelled":
      return "bad";
    default:
      return "neutral";
  }
}

const STATUS_TONE_CLASSES: Record<PillTone, string> = {
  accent: "bg-primary/12 text-primary ring-primary/25",
  good: "bg-success/14 text-success ring-success/25",
  warn: "bg-warning/16 text-warning ring-warning/25",
  bad: "bg-destructive/12 text-destructive ring-destructive/25",
  neutral: "bg-foreground/8 text-muted-foreground ring-foreground/12",
};

/** Ring/bg/text classes for statusTone(), for callers using the ring-pill look directly instead of the `Pill` component. */
export function statusToneClasses(status: string): string {
  return STATUS_TONE_CLASSES[statusTone(status)];
}

export function Button({
  children,
  variant = "primary",
  className,
  loading = false,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline" | "danger" | "glass";
  loading?: boolean;
}) {
  const variants: Record<string, string> = {
    primary: "bg-primary text-primary-foreground hover:opacity-92",
    ghost: "text-foreground hover:bg-secondary",
    outline: "border border-border text-foreground hover:bg-secondary",
    danger: "bg-destructive text-destructive-foreground hover:opacity-92",
    // The app-wide floating-glass treatment (styles.css), for a button that
    // needs to read as a floating control rather than a filled/outlined
    // action -- rounded-full since glass surfaces are always a capsule/pill,
    // never the app's default rounded-2xl card corner.
    glass: "glass-pill rounded-full text-foreground",
  };
  return (
    <motion.button
      {...(rest as Record<string, unknown>)}
      onPointerDown={(e: React.PointerEvent<HTMLButtonElement>) => {
        if (!rest.disabled && !loading) haptic("tap");
        rest.onPointerDown?.(e);
      }}
      whileHover={rest.disabled || loading ? undefined : { scale: 1.02, y: -2 }}
      whileTap={rest.disabled || loading ? undefined : { scale: 0.95 }}
      transition={{ type: "spring", stiffness: 420, damping: 26 }}
      disabled={rest.disabled || loading}
      className={cn(
        "tap-target inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-colors duration-150 ease-out disabled:opacity-55",
        variants[variant],
        className,
      )}
    >
      {loading ? <Spinner /> : null}
      {children}
    </motion.button>
  );
}


export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-80",
        className,
      )}
    />
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {hint ? <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span> : null}
      <div className="mt-2">{children}</div>
    </label>
  );
}

// No text-sm here: Tailwind's utility layer beats the global 16px base rule
// for inputs (src/styles.css), and anything under 16px triggers iOS Safari's
// zoom-on-focus. Let the base rule's 16px win.
export const inputClass =
  "w-full rounded-2xl border border-border bg-background px-3.5 py-2.5 outline-none focus:border-primary/60";

export function Meter({ value, label }: { value: number; label: string }) {
  const tone = value >= 75 ? "bg-success" : value >= 45 ? "bg-warning" : "bg-destructive";
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums">{value}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="surface rounded-3xl px-6 py-12 text-center">
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">{body}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton h-4 w-full", className)} />;
}

/**
 * The app's shared floating-glass chrome primitive -- search bars, status
 * pills, and the app-wide top/tab bars all wrap this instead of hand-rolling
 * the frost treatment per screen. Originated on Radar's map controls, now
 * the standard language everywhere content needs a control to float over it.
 */
export function GlassPill({
  children,
  className,
  as: As = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "label" | "nav";
}) {
  return <As className={cn("glass-pill", className)}>{children}</As>;
}

/**
 * Circular floating-glass action button (recenter, toggle layers, overflow
 * menu, etc). `expanded` is for a button that shows/hides a panel
 * (aria-expanded semantics) rather than one that toggles a persistent visual
 * state (aria-pressed) -- pass at most one of `active`/`expanded`.
 */
export function GlassIconButton({
  icon: Icon,
  label,
  onClick,
  active,
  expanded,
  className,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  active?: boolean;
  expanded?: boolean;
  className?: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={expanded == null ? (active ?? undefined) : undefined}
      aria-expanded={expanded}
      whileTap={{ scale: 0.92 }}
      transition={{ type: "spring", stiffness: 420, damping: 26 }}
      className={cn(
        // h-11/w-11 match tap-target's own min-height/min-width so the class
        // list isn't lying about the actual rendered size.
        "glass-pill tap-target grid h-11 w-11 place-items-center rounded-full transition-colors",
        active ? "text-primary" : "text-foreground/80",
        className,
      )}
    >
      <Icon className="h-4.5 w-4.5" aria-hidden />
    </motion.button>
  );
}
