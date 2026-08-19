/**
 * Tiny wrapper around the Vibration API so taps feel tactile on Android/mobile
 * browsers that support it. No-ops on iOS Safari and desktop.
 */
type HapticKind = "tap" | "select" | "success" | "warn";

const PATTERNS: Record<HapticKind, number | number[]> = {
  tap: 12,
  select: 8,
  success: [10, 30, 14],
  warn: [18, 40, 18],
};

export function haptic(kind: HapticKind = "tap") {
  if (typeof navigator === "undefined") return;
  if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    return;
  const vibrate = (navigator as Navigator & { vibrate?: (p: number | number[]) => boolean }).vibrate;
  if (!vibrate) return;
  try {
    vibrate.call(navigator, PATTERNS[kind]);
  } catch {
    /* ignore — unsupported or blocked by the user gesture policy */
  }
}

/** True on fine-pointer devices (mouse/trackpad) where hover physics make sense. */
export function isFinePointer() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

/** True when the user asked for reduced motion. */
export function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
