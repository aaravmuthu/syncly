import { useContext, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useAnimate, useReducedMotion } from "motion/react";
import { haptic } from "@/lib/quorum/haptics";
import { VerificationContext } from "./verification-context";

/* Motion tokens from the "Syncly 2FA success" design (syncly-2fa-motion.css).
   Every time is seconds after a phase cue; only transform and opacity move. */
const EXPO = [0.16, 1, 0.3, 1] as const;
// Closed-form damped springs over a normalized duration, so they read as
// physical without a variable settle time.
const spring = (zeta: number, omega: number) => (p: number) => {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  const wd = omega * Math.sqrt(1 - zeta * zeta);
  const k = zeta * omega;
  return 1 - Math.exp(-k * p) * (Math.cos(wd * p) + (k / wd) * Math.sin(wd * p));
};
const POP = spring(0.6, 11); // ~9% overshoot: digits, check
const FILL = spring(0.7, 10); // ~5% overshoot: accent fill
// The verifying beat always plays out before success lands, even on a fast
// server, so the code visibly "becomes" the badge.
const MIN_VERIFY = 0.55;
// Success holds this long after its cue before the next step opens.
const SUCCESS_HOLD = 0.7;
// Damped sine: amp 12px, 3.5 cycles, decay e^(-3.2p).
const SHAKE = [0, 10.3, -8.6, 5.9, -4.3, 3.1, -1.9, 0.9, 0].map((x) => `translateX(${x}px)`);
const SHAKE_TIMES = [0, 0.07, 0.21, 0.36, 0.5, 0.64, 0.79, 0.93, 1];
// angle°, distance from badge center, size
const SPARKS = [
  [-62, 60, 7],
  [-18, 66, 5],
  [28, 58, 6],
  [142, 62, 5],
  [196, 64, 7],
  [248, 58, 4],
] as const;

type Status = "idle" | "verifying" | "accepted" | "error";

export function CodeInput({
  value,
  onChange,
  error,
  errorId,
  digits = 6,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
  errorId?: string;
  digits?: number;
  disabled?: boolean;
}) {
  const id = useId();
  const verification = useContext(VerificationContext);
  const reduce = useReducedMotion() ?? false;
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const input = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  // Digits stay painted while a rejected code clears itself right to left.
  const [shown, setShown] = useState(value);
  const prev = useRef(value);
  const verifyStart = useRef(0);
  const converged = useRef(false);
  const timers = useRef<number[]>([]);
  const clearing = useRef(false);

  const accepted = verification?.accepted ?? false;
  const full = value.length === digits;
  const status: Status = accepted
    ? "accepted"
    : disabled && full
      ? "verifying"
      : error
        ? "error"
        : "idle";

  const later = (seconds: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, Math.max(0, seconds) * 1000));
  };
  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const all = (selector: string) => [
    ...(scope.current?.querySelectorAll<HTMLElement>(selector) ?? []),
  ];
  const one = (selector: string) => scope.current?.querySelector<HTMLElement>(selector) ?? null;

  /** Snap every layer back to the resting code row. */
  const rest = () => {
    for (const el of all("[data-cell]"))
      animate(el, { transform: "translateX(0px)" }, { duration: 0 });
    for (const el of all("[data-box]")) animate(el, { opacity: 1 }, { duration: 0 });
    for (const el of all(
      "[data-dot], [data-tint], [data-spark], [data-glow], [data-disc], [data-ring], [data-fill], [data-check-outer], [data-label]",
    ))
      animate(el, { opacity: 0 }, { duration: 0 });
    const arc = one("[data-arc]");
    if (arc) animate(arc, { pathLength: 0 }, { duration: 0 });
    for (const el of all("[data-digit]"))
      animate(el, { opacity: 1, transform: "scale(1)" }, { duration: 0 });
    converged.current = false;
  };

  // New digits pop in on a spring; an autofilled code ripples in left to right.
  useLayoutEffect(() => {
    const before = prev.current;
    prev.current = value;
    setShown(value);
    if (reduce || value.length <= before.length || !value.startsWith(before)) return;
    for (let i = before.length; i < value.length; i++) {
      const el = one(`[data-digit="${i}"]`);
      if (!el) continue;
      const delay = (i - before.length) * 0.03;
      animate(el, { transform: ["scale(0.6)", "scale(1)"] }, { duration: 0.28, delay, ease: POP });
      animate(el, { opacity: [0, 1] }, { duration: 0.08, delay, ease: EXPO });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Phase 1 · Verifying: the six boxes slide together, round off into dots
  // and merge into one disc while a ring draws around it.
  useEffect(() => {
    if (status !== "verifying") return;
    clearTimers();
    verifyStart.current = performance.now();
    const row = one("[data-row]");
    if (!row) return;
    if (reduce) {
      for (const el of all("[data-box]")) animate(el, { opacity: 0.45 }, { duration: 0.2 });
      return;
    }
    converged.current = true;
    const mid = row.clientWidth / 2;
    for (const el of all("[data-cell]")) {
      const toCenter = mid - (el.offsetLeft + el.offsetWidth / 2);
      animate(
        el,
        { transform: `translateX(${toCenter}px)` },
        { duration: 0.42, delay: 0.1, ease: EXPO },
      );
    }
    for (const el of all("[data-box]"))
      animate(el, { opacity: 0 }, { duration: 0.22, delay: 0.1, ease: EXPO });
    for (const el of all("[data-dot]")) {
      animate(
        el,
        { opacity: [0, 1, 1, 0] },
        { duration: 0.44, delay: 0.1, times: [0, 0.5, 0.64, 1], ease: EXPO },
      );
      animate(
        el,
        { transform: ["scale(1)", "scale(0.8)"] },
        { duration: 0.42, delay: 0.1, ease: EXPO },
      );
    }
    const disc = one("[data-disc]");
    const ring = one("[data-ring]");
    const arc = one("[data-arc]");
    if (disc) {
      animate(disc, { opacity: 1 }, { duration: 0.15, delay: 0.3, ease: EXPO });
      animate(
        disc,
        { transform: ["scale(0.575)", "scale(1)"] },
        { duration: 0.3, delay: 0.3, ease: EXPO },
      );
    }
    const breathe = one("[data-breathe]");
    if (breathe)
      animate(
        breathe,
        { transform: ["scale(1)", "scale(1.035)", "scale(1)"] },
        { duration: 0.5, delay: 0.36, times: [0, 0.4, 1], ease: EXPO },
      );
    if (ring) {
      animate(ring, { opacity: 1 }, { duration: 0.15, delay: 0.3, ease: EXPO });
      animate(
        ring,
        { transform: ["rotate(-120deg)", "rotate(0deg)"] },
        { duration: 0.7, delay: 0.3, ease: EXPO },
      );
    }
    if (arc) animate(arc, { pathLength: [0, 0.72] }, { duration: 0.7, delay: 0.3, ease: EXPO });
    // A slow server keeps the disc gently breathing so the wait never looks frozen.
    later(0.9, () => {
      if (breathe)
        animate(
          breathe,
          { transform: ["scale(1)", "scale(1.035)", "scale(1)"] },
          { duration: 1.1, repeat: Infinity, ease: "easeInOut" },
        );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status === "verifying"]);

  // Phase 2 · Success: the ring closes, accent fills the disc, the check
  // wipes in with a glow and a few embers, then "Verified".
  useEffect(() => {
    if (status !== "accepted") return;
    clearTimers();
    const elapsed = (performance.now() - verifyStart.current) / 1000;
    const s = verifyStart.current ? Math.max(0, MIN_VERIFY - elapsed) : 0;
    const badge = one("[data-badge]");
    const fill = one("[data-fill]");
    const checkOuter = one("[data-check-outer]");
    const checkInner = one("[data-check-inner]");
    const check = one("[data-check]");
    const label = one("[data-label]");
    const breathe = one("[data-breathe]");
    if (breathe) animate(breathe, { transform: "scale(1)" }, { duration: 0.2, ease: EXPO });
    later(s + 0.05, () => haptic("success"));
    later(s + SUCCESS_HOLD, () => verification?.settle());
    if (reduce) {
      for (const el of all("[data-box], [data-cell]"))
        animate(el, { opacity: 0 }, { duration: 0.25, delay: 0.12, ease: EXPO });
      if (badge) {
        // Opacity-only: the finished badge simply appears.
        for (const el of [fill, check, checkOuter, checkInner])
          if (el) animate(el, { opacity: 1, transform: "none" }, { duration: 0 });
        animate(badge, { opacity: [0, 1] }, { duration: 0.3, delay: 0.15, ease: EXPO });
      }
      if (label)
        animate(
          label,
          { opacity: [0, 1], transform: "none" },
          { duration: 0.3, delay: 0.15, ease: EXPO },
        );
      return;
    }
    if (!converged.current) {
      // Accepted without a visible verifying beat (e.g. instant response):
      // collapse the row now so the badge still grows out of the code.
      for (const el of all("[data-box], [data-digit]"))
        animate(el, { opacity: 0 }, { duration: 0.2, ease: EXPO });
      const disc = one("[data-disc]");
      if (disc)
        animate(
          disc,
          { opacity: 1, transform: ["scale(0.575)", "scale(1)"] },
          { duration: 0.3, ease: EXPO },
        );
    }
    const ring = one("[data-ring]");
    const arc = one("[data-arc]");
    if (arc)
      animate(arc, { pathLength: 1 }, { duration: 0.22, delay: Math.max(0, s - 0.05), ease: EXPO });
    if (ring) animate(ring, { opacity: 0 }, { duration: 0.2, delay: s + 0.35, ease: EXPO });
    if (fill) {
      animate(fill, { opacity: [0, 1] }, { duration: 0.1, delay: s + 0.05, ease: EXPO });
      animate(
        fill,
        { transform: ["scale(0.3)", "scale(1)"] },
        { duration: 0.55, delay: s + 0.05, ease: FILL },
      );
    }
    // The check is wiped on with two counter-sliding layers: transform only, no stroke drawing.
    if (checkOuter && checkInner && check) {
      animate(checkOuter, { opacity: 1 }, { duration: 0, delay: s + 0.22 });
      animate(
        checkOuter,
        { transform: ["translateX(-38px)", "translateX(0px)"] },
        { duration: 0.34, delay: s + 0.22, ease: EXPO },
      );
      animate(
        checkInner,
        { transform: ["translateX(38px)", "translateX(0px)"] },
        { duration: 0.34, delay: s + 0.22, ease: EXPO },
      );
      animate(
        check,
        { transform: ["scale(0.8)", "scale(1)"] },
        { duration: 0.5, delay: s + 0.22, ease: POP },
      );
    }
    const glow = one("[data-glow]");
    if (glow) {
      animate(
        glow,
        { transform: ["scale(0.9)", "scale(2.6)"] },
        { duration: 0.8, delay: s + 0.18, ease: EXPO },
      );
      animate(
        glow,
        { opacity: [0, 0.32, 0] },
        { duration: 0.78, delay: s + 0.18, times: [0, 0.1, 1], ease: EXPO },
      );
    }
    all("[data-spark]").forEach((el, k) => {
      const [angle, dist] = SPARKS[k];
      const r = (angle * Math.PI) / 180;
      const at = (d: number, sc: number) =>
        `translate(${Math.cos(r) * d}px, ${Math.sin(r) * d}px) scale(${sc})`;
      const delay = s + 0.26 + k * 0.035;
      animate(el, { opacity: 1 }, { duration: 0, delay });
      animate(
        el,
        { transform: [at(dist, 0), at(dist + 9, 1), at(dist + 12, 0)] },
        { duration: 0.6, delay, times: [0, 0.35, 1], ease: EXPO },
      );
    });
    if (label) {
      animate(label, { opacity: [0, 1] }, { duration: 0.4, delay: s + 0.38, ease: EXPO });
      animate(
        label,
        { transform: ["translateY(6px)", "translateY(0px)"] },
        { duration: 0.4, delay: s + 0.38, ease: EXPO },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status === "accepted"]);

  // Denied: the row springs back from the disc if it had started merging,
  // shakes, flushes red, and the digits clear right to left so the caret
  // can return to the first box.
  useEffect(() => {
    if (status !== "error") return;
    clearTimers();
    const code = shown;
    const back = converged.current ? 0.2 : 0;
    clearing.current = true;
    const breathe = one("[data-breathe]");
    if (breathe) animate(breathe, { transform: "scale(1)" }, { duration: 0.15, ease: EXPO });
    if (converged.current) {
      for (const el of all("[data-cell]"))
        animate(el, { transform: "translateX(0px)" }, { duration: 0.32, ease: EXPO });
      for (const el of all("[data-box]"))
        animate(el, { opacity: 1 }, { duration: 0.2, ease: EXPO });
      for (const el of all("[data-dot], [data-disc], [data-ring]"))
        animate(el, { opacity: 0 }, { duration: 0.15, ease: EXPO });
      converged.current = false;
    } else if (reduce) {
      for (const el of all("[data-box]")) animate(el, { opacity: 1 }, { duration: 0.15 });
    }
    later(back + 0.12, () => haptic("warn"));
    const row = one("[data-row]");
    if (row && !reduce)
      animate(
        row,
        { transform: SHAKE },
        { duration: 0.46, delay: back + 0.12, times: SHAKE_TIMES, ease: "linear" },
      );
    for (const el of all("[data-tint]")) {
      animate(
        el,
        { opacity: [0, 1, 1, 0] },
        { duration: 0.9, delay: back + 0.12, times: [0, 0.133, 0.556, 1], ease: EXPO },
      );
    }
    for (let i = 0; i < code.length; i++) {
      const el = one(`[data-digit="${i}"]`);
      if (!el) continue;
      const delay = back + 0.5 + (code.length - 1 - i) * 0.03;
      animate(el, { opacity: 0 }, { duration: 0.2, delay, ease: EXPO });
      if (!reduce) animate(el, { transform: "scale(0.5)" }, { duration: 0.2, delay, ease: EXPO });
    }
    later(back + 0.78, () => {
      clearing.current = false;
      onChange("");
      for (const el of all("[data-digit]"))
        animate(el, { opacity: 1, transform: "scale(1)" }, { duration: 0 });
      input.current?.focus({ preventScroll: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status === "error"]);

  // Typing again after a rejection, or leaving a stalled verify, returns to rest.
  useEffect(() => {
    if (status === "idle" && converged.current) rest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const caret = status === "idle" || status === "error" ? Math.min(value.length, digits - 1) : -1;
  return (
    <div ref={scope} className="otp relative py-5" data-status={status}>
      <label htmlFor={id} className="sr-only">
        Verification code
      </label>
      <div
        data-row
        className="relative mx-auto grid w-full max-w-[326px] gap-2.5"
        style={{ gridTemplateColumns: `repeat(${digits}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: digits }, (_, i) => (
          <div key={i} data-cell className="relative aspect-[46/56]">
            <div data-box className="otp-box absolute inset-0 rounded-[13px]">
              <div
                className="otp-focus absolute inset-0 rounded-[13px]"
                data-on={(focused && caret === i) || undefined}
              />
              <div data-tint className="otp-tint absolute inset-0 rounded-[13px] opacity-0" />
              <span
                data-digit={i}
                className="absolute inset-0 grid place-items-center text-[26px] font-semibold tabular-nums"
              >
                {shown[i] ?? ""}
              </span>
              {focused && caret === i && !shown[i] && (
                <span className="otp-caret absolute left-1/2 top-[28%] h-[43%] w-0.5 -translate-x-1/2 rounded-full" />
              )}
            </div>
            <div
              data-dot
              className="otp-dot absolute inset-x-0 top-1/2 aspect-square -translate-y-1/2 rounded-full opacity-0"
            />
          </div>
        ))}
        <input
          ref={input}
          id={id}
          className="absolute inset-0 h-full w-full cursor-text bg-transparent text-transparent caret-transparent opacity-[0.01] outline-none selection:bg-transparent"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          required
          pattern={`[0-9]{${digits}}`}
          minLength={digits}
          maxLength={digits}
          aria-invalid={error || undefined}
          aria-describedby={error ? errorId : undefined}
          disabled={disabled || accepted}
          value={value}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          // The boxes always edit from the end, like a native code field.
          onSelect={(e) => {
            const el = e.currentTarget;
            const end = el.value.length;
            if (el.selectionStart !== end || el.selectionEnd !== end)
              el.setSelectionRange(end, end);
          }}
          onChange={(e) => {
            const next = e.target.value.replace(/\D/g, "").slice(0, digits);
            if (clearing.current) {
              // Typing over a rejected code that is still clearing: keep what they type.
              clearTimers();
              clearing.current = false;
              for (const el of all("[data-digit]"))
                animate(el, { opacity: 1, transform: "scale(1)" }, { duration: 0 });
            }
            onChange(next);
            // The last digit (typed, pasted or autofilled) submits itself.
            if (next.length === digits && next !== value) {
              const form = e.target.form;
              requestAnimationFrame(() => form?.requestSubmit());
            }
          }}
        />
        {/* Badge, centered on the row: grows out of the merged code. */}
        <div
          data-badge
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 size-0"
        >
          <div
            data-glow
            className="otp-glow absolute -left-10 -top-10 size-20 rounded-full opacity-0"
          />
          <div data-breathe className="absolute -left-10 -top-10 size-20">
            <div data-disc className="otp-disc absolute inset-0 rounded-full opacity-0" />
          </div>
          <svg
            data-ring
            className="absolute -left-[47px] -top-[47px] size-[94px] opacity-0"
            viewBox="0 0 94 94"
            fill="none"
          >
            <circle cx="47" cy="47" r="45.75" className="stroke-foreground/10" strokeWidth="2.5" />
            <path
              data-arc
              d="M47 1.25 a45.75 45.75 0 1 1 0 91.5 a45.75 45.75 0 1 1 0 -91.5"
              className="stroke-primary"
              strokeWidth="2.5"
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray="0 1"
            />
          </svg>
          <div
            data-fill
            className="absolute -left-10 -top-10 size-20 rounded-full bg-primary opacity-0"
          />
          <div data-check className="absolute -left-10 -top-10 size-20">
            <div
              data-check-outer
              className="absolute left-[22px] top-0 h-20 w-[38px] overflow-hidden opacity-0"
            >
              <div data-check-inner className="absolute -left-[22px] top-0 size-20">
                <svg viewBox="0 0 80 80" className="size-20 text-primary-foreground" fill="none">
                  <path
                    d="M27 41 L36 50 L54 31"
                    stroke="currentColor"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          </div>
          {SPARKS.map(([, , size], k) => (
            <div
              key={k}
              data-spark
              className="absolute opacity-0"
              style={{ left: -size / 2, top: -size / 2, width: size, height: size }}
            >
              <span className="absolute inset-y-0 left-1/2 w-[1.5px] -translate-x-1/2 rounded-full bg-accent" />
              <span className="absolute inset-x-0 top-1/2 h-[1.5px] -translate-y-1/2 rounded-full bg-accent" />
            </div>
          ))}
        </div>
        <p
          data-label
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-[calc(50%+58px)] w-40 -translate-x-1/2 text-center text-[17px] font-semibold tracking-[-0.01em] opacity-0"
        >
          Verified
        </p>
      </div>
      <span role="status" className="sr-only">
        {status === "verifying"
          ? "Checking your code…"
          : status === "error"
            ? "That code didn't work. Enter it again."
            : ""}
      </span>
    </div>
  );
}
