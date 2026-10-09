import { AnimatePresence, type HTMLMotionProps, motion, useReducedMotion } from "motion/react";
import {
  forwardRef,
  type Key,
  type ReactNode,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { ThinkingOrb, type OrbState } from "thinking-orbs";
import { haptic } from "@/lib/quorum/haptics";
import { useTheme } from "@/lib/theme-context";
import { cn } from "@/lib/utils";
import { Spinner } from "./ui";

type DynamicButtonVariant = "primary" | "outline" | "ghost" | "danger" | "glass" | "plain";

const uiEaseOut = [0.23, 1, 0.32, 1] as const;

export type DynamicButtonProps = Omit<
  HTMLMotionProps<"button">,
  "animate" | "children" | "initial" | "ref" | "transition"
> & {
  /** Plain string so a label change can be keyed and morphed. */
  children: string;
  icon?: ReactNode;
  /** Re-key the icon on something other than the label (e.g. a toggle). */
  stateKey?: Key;
  variant?: DynamicButtonVariant;
  /** "content" springs the button's width to fit each new label. */
  width?: "content" | "full";
  loading?: boolean;
  /** AI work: show a thinking orb in this state instead of the plain spinner. */
  orb?: OrbState;
};

// Filled variants get a lit top edge, a shaded bottom edge and a soft glow
// tinted by their own color, so they read as a solid, pressable object
// rather than a flat swatch. The glow deepens on hover.
const variantClasses: Record<DynamicButtonVariant, string> = {
  primary:
    "rounded-2xl bg-primary text-primary-foreground shadow-[inset_0_1px_0_0_oklch(1_0_0/0.2),inset_0_-1px_0_0_oklch(0_0_0/0.1),0_1px_2px_0_oklch(0_0_0/0.08),0_10px_24px_-14px_color-mix(in_oklab,var(--primary)_80%,transparent)] hover:brightness-[1.06] hover:shadow-[inset_0_1px_0_0_oklch(1_0_0/0.2),inset_0_-1px_0_0_oklch(0_0_0/0.1),0_1px_2px_0_oklch(0_0_0/0.08),0_14px_30px_-12px_color-mix(in_oklab,var(--primary)_90%,transparent)]",
  danger:
    "rounded-2xl bg-destructive text-destructive-foreground shadow-[inset_0_1px_0_0_oklch(1_0_0/0.2),inset_0_-1px_0_0_oklch(0_0_0/0.1),0_1px_2px_0_oklch(0_0_0/0.08),0_10px_24px_-14px_color-mix(in_oklab,var(--destructive)_80%,transparent)] hover:brightness-[1.06] hover:shadow-[inset_0_1px_0_0_oklch(1_0_0/0.2),inset_0_-1px_0_0_oklch(0_0_0/0.1),0_1px_2px_0_oklch(0_0_0/0.08),0_14px_30px_-12px_color-mix(in_oklab,var(--destructive)_90%,transparent)]",
  outline:
    "rounded-2xl border border-border bg-card/60 text-foreground shadow-[inset_0_1px_0_0_color-mix(in_oklab,var(--background)_70%,transparent),0_1px_2px_0_oklch(0_0_0/0.04)] hover:border-foreground/20 hover:bg-secondary",
  ghost: "rounded-2xl text-foreground hover:bg-secondary",
  // Floating-glass capsule (styles.css) -- always rounded-full.
  glass: "glass-pill rounded-full text-foreground",
  // No chrome: for text-link buttons that only need the label morph.
  plain: "",
};

export const DynamicButton = forwardRef<HTMLButtonElement, DynamicButtonProps>(
  function DynamicButton(
    {
      children,
      className,
      icon,
      stateKey,
      type = "button",
      variant = "primary",
      width = "content",
      loading = false,
      orb,
      disabled,
      onPointerDown,
      ...props
    },
    forwardedRef,
  ) {
    const shouldReduceMotion = useReducedMotion();
    const { resolved } = useTheme();
    const buttonRef = useRef<HTMLButtonElement>(null);
    const measureRef = useRef<HTMLSpanElement>(null);
    const measurementSignatureRef = useRef("");
    const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);

    // Filled variants invert the page: light ink on evergreen by day, dark
    // ink on the lifted evergreen at night.
    const filled = variant === "primary" || variant === "danger";
    const orbTheme = filled ? (resolved === "dark" ? "light" : "dark") : "auto";
    // While busy the spinner takes the icon slot, so it morphs in like any
    // other state change instead of shoving the label sideways.
    const slotIcon = loading ? (
      orb ? (
        <ThinkingOrb state={orb} size={20} theme={orbTheme} aria-hidden="true" />
      ) : (
        <Spinner />
      )
    ) : (
      icon
    );
    const iconKey = loading ? "\0loading" : (stateKey ?? children);
    const measurementSignature = [
      children,
      className,
      slotIcon ? "icon" : "no-icon",
      stateKey,
      variant,
      loading,
    ].join("\0");
    const shouldMeasureWidth = width === "content";
    const widthTransition = shouldReduceMotion
      ? { duration: 0 }
      : { bounce: 0, duration: 0.32, type: "spring" as const };
    const contentTransition = {
      duration: shouldReduceMotion ? 0.16 : 0.22,
      ease: uiEaseOut,
    };
    const contentVisible = { opacity: 1, transform: "translateY(0px)", filter: "blur(0px)" };
    const contentInitial = shouldReduceMotion
      ? { opacity: 0, transform: "translateY(0px)", filter: "blur(0px)" }
      : { opacity: 0, transform: "translateY(10px)", filter: "blur(4px)" };
    const contentExit = shouldReduceMotion
      ? { opacity: 0, transform: "translateY(0px)", filter: "blur(0px)" }
      : { opacity: 0, transform: "translateY(-10px)", filter: "blur(4px)" };

    useImperativeHandle(forwardedRef, () => buttonRef.current as HTMLButtonElement);

    const syncWidth = useCallback(() => {
      const button = buttonRef.current;
      const measure = measureRef.current;

      if (!button || !measure || !shouldMeasureWidth) {
        return;
      }

      const styles = window.getComputedStyle(button);
      const horizontalPadding =
        Number.parseFloat(styles.paddingLeft) +
        Number.parseFloat(styles.paddingRight) +
        Number.parseFloat(styles.borderLeftWidth) +
        Number.parseFloat(styles.borderRightWidth);
      const nextWidth = Math.ceil(measure.scrollWidth + horizontalPadding);

      setMeasuredWidth((currentWidth) => (currentWidth === nextWidth ? currentWidth : nextWidth));
    }, [shouldMeasureWidth]);

    useLayoutEffect(() => {
      const measure = measureRef.current;

      if (!measure || !shouldMeasureWidth) {
        setMeasuredWidth(null);
        return;
      }

      syncWidth();

      const observer = new ResizeObserver(syncWidth);
      observer.observe(measure);
      window.addEventListener("resize", syncWidth);

      return () => {
        observer.disconnect();
        window.removeEventListener("resize", syncWidth);
      };
    }, [shouldMeasureWidth, syncWidth]);

    useLayoutEffect(() => {
      if (measurementSignatureRef.current === measurementSignature) {
        return;
      }

      measurementSignatureRef.current = measurementSignature;
      syncWidth();
    }, [measurementSignature, syncWidth]);

    const chrome = variant !== "plain";

    return (
      <motion.button
        {...props}
        onPointerDown={(e) => {
          if (!disabled && !loading) haptic("tap");
          onPointerDown?.(e);
        }}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        animate={width === "content" ? { width: measuredWidth ?? "auto" } : undefined}
        className={cn(
          "relative inline-flex cursor-pointer items-center justify-center overflow-hidden whitespace-nowrap",
          "transition-[color,background-color,border-color,box-shadow,filter,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] disabled:cursor-not-allowed disabled:active:scale-100",
          chrome &&
            "tap-target px-4 py-2.5 text-sm font-semibold tracking-[-0.011em] disabled:opacity-55 disabled:shadow-none disabled:hover:brightness-100",
          // A busy button is still the thing you pressed; only real disabling dims it.
          loading && "disabled:opacity-100",
          variantClasses[variant],
          width === "full" && "w-full",
          className,
        )}
        initial={false}
        ref={buttonRef}
        transition={width === "content" ? { width: widthTransition } : undefined}
        type={type}
      >
        <span className="relative inline-flex items-center gap-1.5 [text-decoration:inherit]">
          {slotIcon ? (
            <span className="relative inline-grid size-5 shrink-0 overflow-hidden [&_svg]:size-4">
              <AnimatePresence initial={false} mode="popLayout">
                <motion.span
                  animate={contentVisible}
                  className="col-start-1 row-start-1 flex size-5 items-center justify-center"
                  exit={contentExit}
                  initial={contentInitial}
                  key={iconKey}
                  transition={contentTransition}
                >
                  {slotIcon}
                </motion.span>
              </AnimatePresence>
            </span>
          ) : null}

          <span className="relative inline-grid overflow-hidden [text-decoration:inherit]">
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                animate={contentVisible}
                className="col-start-1 row-start-1 block [text-decoration:inherit]"
                exit={contentExit}
                initial={contentInitial}
                key={children}
                transition={contentTransition}
              >
                {children}
              </motion.span>
            </AnimatePresence>
          </span>
        </span>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inline-flex items-center gap-1.5 opacity-0"
          ref={measureRef}
        >
          {slotIcon ? <span className="flex size-5 shrink-0 items-center justify-center" /> : null}
          <span>{children}</span>
        </span>
      </motion.button>
    );
  },
);
