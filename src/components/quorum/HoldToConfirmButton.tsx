import { Check } from "lucide-react";
import { useReducedMotion } from "motion/react";
import {
  type ComponentPropsWithoutRef,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { haptic } from "@/lib/quorum/haptics";
import { cn } from "@/lib/utils";
import { Spinner } from "./ui";

type HoldToConfirmButtonProps = Omit<ComponentPropsWithoutRef<"button">, "children" | "onClick"> & {
  children?: ReactNode;
  confirmedContent?: ReactNode;
  duration?: number;
  /** The confirmed action is running; holds the filled state with a spinner. */
  loading?: boolean;
  onConfirm: (input: ConfirmationInput) => void;
  resetAfter?: number;
};

type HoldStatus = "confirmed" | "holding" | "idle";
export type ConfirmationInput = "keyboard" | "pointer";

/**
 * For irreversible actions: press and hold until the destructive fill sweeps
 * across, instead of a second "are you sure?" tap. Letting go early, sliding
 * off, or blurring cancels.
 */
export function HoldToConfirmButton({
  children = "Hold to confirm",
  className,
  confirmedContent,
  disabled,
  duration = 1600,
  loading = false,
  onConfirm,
  resetAfter = 1800,
  ...buttonProps
}: HoldToConfirmButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const confirmTimerRef = useRef<number | null>(null);
  const resetTimerRef = useRef<number | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const inputModeRef = useRef<ConfirmationInput>("pointer");
  const isHoldingRef = useRef(false);
  const [inputMode, setInputMode] = useState<ConfirmationInput | null>(null);
  const [status, setStatus] = useState<HoldStatus>("idle");
  const shouldReduceMotion = useReducedMotion();

  const clearConfirmTimer = useCallback(() => {
    if (confirmTimerRef.current === null) {
      return;
    }

    window.clearTimeout(confirmTimerRef.current);
    confirmTimerRef.current = null;
  }, []);

  const completeHold = useCallback(() => {
    if (!isHoldingRef.current) {
      return;
    }

    isHoldingRef.current = false;
    activePointerIdRef.current = null;
    clearConfirmTimer();
    setStatus("confirmed");
    haptic("warn");
    onConfirm(inputModeRef.current);

    if (resetAfter > 0) {
      resetTimerRef.current = window.setTimeout(() => {
        setStatus("idle");
        resetTimerRef.current = null;
      }, resetAfter);
    }
  }, [clearConfirmTimer, onConfirm, resetAfter]);

  const cancelHold = useCallback(() => {
    if (!isHoldingRef.current) {
      return;
    }

    isHoldingRef.current = false;
    activePointerIdRef.current = null;
    clearConfirmTimer();
    setStatus("idle");
  }, [clearConfirmTimer]);

  const blocked = disabled || loading;

  const startHold = useCallback(
    (input: ConfirmationInput) => {
      if (blocked || status === "confirmed" || isHoldingRef.current) {
        return;
      }

      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
        resetTimerRef.current = null;
      }

      inputModeRef.current = input;
      setInputMode(input);
      isHoldingRef.current = true;
      setStatus("holding");
      haptic("tap");
      confirmTimerRef.current = window.setTimeout(completeHold, duration);
    },
    [blocked, completeHold, duration, status],
  );

  useEffect(() => {
    return () => {
      clearConfirmTimer();

      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, [clearConfirmTimer]);

  useEffect(() => {
    if (disabled) {
      cancelHold();
    }
  }, [cancelHold, disabled]);

  function releasePointerCapture(pointerId: number) {
    const button = buttonRef.current;

    if (button?.hasPointerCapture(pointerId)) {
      button.releasePointerCapture(pointerId);
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (!event.isPrimary || event.button !== 0 || blocked) {
      return;
    }

    activePointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    startHold("pointer");
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (!isHoldingRef.current || activePointerIdRef.current !== event.pointerId) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const boundaryPadding = 8;
    const isOutside =
      event.clientX < rect.left - boundaryPadding ||
      event.clientX > rect.right + boundaryPadding ||
      event.clientY < rect.top - boundaryPadding ||
      event.clientY > rect.bottom + boundaryPadding;

    if (isOutside) {
      cancelHold();
      releasePointerCapture(event.pointerId);
    }
  }

  function handlePointerEnd(event: PointerEvent<HTMLButtonElement>) {
    if (activePointerIdRef.current !== event.pointerId) {
      return;
    }

    cancelHold();
    releasePointerCapture(event.pointerId);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.repeat || (event.key !== "Enter" && event.key !== " ")) {
      return;
    }

    event.preventDefault();
    startHold("keyboard");
  }

  function handleKeyUp(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    cancelHold();
  }

  // A running action keeps the filled state even after resetAfter elapses.
  const isConfirmed = status === "confirmed" || loading;
  const isHolding = status === "holding";
  const overlayStyle = {
    clipPath: isHolding ? "inset(0 0 0 0)" : "inset(0 100% 0 0)",
    transitionDuration:
      shouldReduceMotion || inputMode === "keyboard"
        ? "0ms"
        : isHolding
          ? `${duration}ms`
          : "180ms",
    transitionProperty: "clip-path",
    transitionTimingFunction: isHolding ? "linear" : "cubic-bezier(0.23, 1, 0.32, 1)",
  };

  return (
    <button
      {...buttonProps}
      aria-busy={isHolding || loading}
      className={cn(
        "tap-target relative isolate inline-flex cursor-pointer touch-none select-none items-center justify-center overflow-hidden rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm font-semibold tracking-[-0.011em] text-destructive outline-none [-webkit-touch-callout:none]",
        "shadow-[inset_0_1px_0_0_color-mix(in_oklab,var(--background)_60%,transparent)] transition-[transform,border-color,background-color,color,box-shadow] duration-150 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)]",
        "hover:border-destructive/45 hover:bg-destructive/[0.14] focus-visible:ring-2 focus-visible:ring-destructive/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[input=pointer]:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55",
        isConfirmed &&
          "border-destructive bg-destructive text-destructive-foreground shadow-[inset_0_1px_0_0_oklch(1_0_0/0.2),inset_0_-1px_0_0_oklch(0_0_0/0.1),0_10px_24px_-14px_color-mix(in_oklab,var(--destructive)_80%,transparent)] hover:border-destructive hover:bg-destructive disabled:opacity-100",
        className,
      )}
      data-input={inputMode}
      disabled={blocked}
      onBlur={cancelHold}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onLostPointerCapture={cancelHold}
      onPointerCancel={handlePointerEnd}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      ref={buttonRef}
      type="button"
    >
      {isConfirmed ? (
        <span className="relative flex items-center justify-center gap-1.5">
          {loading ? (
            <>
              <Spinner />
              {confirmedContent ?? "Working…"}
            </>
          ) : (
            (confirmedContent ?? (
              <>
                <Check aria-hidden="true" className="size-4" strokeWidth={2.5} />
                Confirmed
              </>
            ))
          )}
        </span>
      ) : (
        <>
          <span className="relative flex items-center justify-center gap-1.5">
            {children}
            <span className="sr-only"> (press and hold to confirm)</span>
          </span>
          <span
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center gap-1.5 bg-destructive px-4 text-destructive-foreground shadow-[inset_0_1px_0_0_oklch(1_0_0/0.2)]"
            style={overlayStyle}
          >
            {children}
          </span>
        </>
      )}
    </button>
  );
}
