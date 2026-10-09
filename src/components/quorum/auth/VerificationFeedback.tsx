import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { VerificationContext } from "./verification-context";
import { DynamicButton } from "@/components/quorum/DynamicButton";

// Screen-out overlaps the next step's entrance, as in the motion spec.
const HANDOFF_MS = 120;
// Only offer a manual button if the next step is unusually slow to open.
const STALL_MS = 3200;
// Safety net if the code field never reports (e.g. it unmounted early).
const FALLBACK_MS = 2400;

/** This feedback follows server acceptance; it never decides verification. */
export function VerificationFeedback({
  accepted,
  onComplete,
  children,
  className,
}: {
  accepted: boolean;
  onComplete: () => void | Promise<void>;
  children: ReactNode;
  className?: string;
}) {
  const callback = useRef(onComplete);
  const continuing = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  const wasLeaving = useRef(false);
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [stalled, setStalled] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    callback.current = onComplete;
  }, [onComplete]);
  const proceed = useCallback(async () => {
    if (continuing.current) return;
    continuing.current = true;
    setBusy(true);
    setError("");
    try {
      await callback.current();
    } catch {
      continuing.current = false;
      setLeaving(false);
      setError(
        "Your code was accepted, but we could not open the next step. Try continuing again.",
      );
    } finally {
      setBusy(false);
    }
  }, []);
  const settle = useCallback(() => {
    if (continuing.current) return;
    setLeaving(true);
    window.setTimeout(() => void proceed(), HANDOFF_MS);
  }, [proceed]);
  useEffect(() => {
    if (!accepted) {
      continuing.current = false;
      setStalled(false);
      setLeaving(false);
      return;
    }
    root.current?.focus({ preventScroll: true });
    const stall = window.setTimeout(() => setStalled(true), STALL_MS);
    const fallback = window.setTimeout(settle, FALLBACK_MS);
    return () => {
      window.clearTimeout(stall);
      window.clearTimeout(fallback);
    };
  }, [accepted, settle]);
  // When the same screen hosts the next step (e.g. choosing a new password),
  // it rises in from below rather than snapping back.
  useEffect(() => {
    if (wasLeaving.current && !leaving && !accepted && root.current) {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
        root.current.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 450 });
      else
        root.current.animate(
          [
            { opacity: 0, transform: "translateY(40px) scale(0.985)" },
            { opacity: 1, transform: "none" },
          ],
          { duration: 600, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
        );
    }
    wasLeaving.current = leaving;
  }, [leaving, accepted]);
  const context = useMemo(() => ({ accepted, settle }), [accepted, settle]);
  const offerButton = Boolean(error) || stalled;
  return (
    <VerificationContext.Provider value={context}>
      <div
        ref={root}
        tabIndex={-1}
        className={cn("verification-feedback relative outline-none", className)}
        data-accepted={accepted || undefined}
        data-leaving={leaving || undefined}
      >
        <div className="verification-form" inert={accepted}>
          {children}
        </div>
        {accepted && (
          <div className="mt-6 flex flex-col items-center gap-3 text-center">
            <span role="status" className="sr-only">
              Code accepted. {error ? "" : "Continuing to the next step."}
            </span>
            {error && (
              <p role="alert" className="max-w-sm text-sm text-destructive">
                {error}
              </p>
            )}
            {offerButton && (
              <DynamicButton
                type="button"
                variant="ghost"
                loading={busy}
                onClick={() => void proceed()}
                className="auth-step"
              >
                {error ? "Try continuing again" : "Continue"}
              </DynamicButton>
            )}
          </div>
        )}
      </div>
    </VerificationContext.Provider>
  );
}
