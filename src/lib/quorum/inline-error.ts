import type { ReactNode } from "react";

/**
 * Shared outcome store. Controls are remembered for pointer, keyboard and form
 * actions; the root feedback layer animates the result and shows its reason.
 */

export type InlineErrorAction = { label: ReactNode; onClick: () => void };

export type InlineError = {
  id: number;
  anchor: HTMLElement | null;
  tone: "success" | "error" | "info";
  title: ReactNode;
  description?: ReactNode;
  action?: InlineErrorAction;
  /** Where the finger landed, as 0–1 fractions of the button, so the error
   *  can spread from that spot even if the button has moved since. */
  origin?: { x: number; y: number };
};

// Long enough for an AI answer or an upload to come back to the button that
// started it; past that the press is probably about something else.
const ANCHOR_WINDOW_MS = 45_000;

const PRESSABLE = [
  "button",
  "a[href]",
  "summary",
  "label",
  "input[type=submit]",
  "input[type=button]",
  "input[type=checkbox]",
  "[role=button]",
  "[role=switch]",
  "[role=tab]",
  "[role=menuitem]",
  "[role=option]",
].join(",");

let lastPress: { el: HTMLElement; at: number; origin?: { x: number; y: number } } | null = null;
let current: InlineError | null = null;
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function remember(target: EventTarget | null, point?: { x: number; y: number }) {
  const el = target instanceof Element ? target.closest<HTMLElement>(PRESSABLE) : null;
  if (!el) return void (lastPress = null);
  const r = el.getBoundingClientRect();
  const origin =
    point && r.width && r.height
      ? { x: (point.x - r.left) / r.width, y: (point.y - r.top) / r.height }
      : undefined;
  lastPress = { el, at: performance.now(), origin };
}

if (typeof document !== "undefined") {
  document.addEventListener(
    "pointerdown",
    (e) => remember(e.target, { x: e.clientX, y: e.clientY }),
    true,
  );
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Enter" || e.key === " ") remember(e.target);
    },
    true,
  );
  // Enter in a field submits the form; the submit button is the control.
  document.addEventListener(
    "submit",
    (e) => {
      const form = e.target as HTMLFormElement;
      remember(
        (e as SubmitEvent).submitter ??
          form.querySelector("[type=submit]") ??
          lastPress?.el ??
          null,
      );
    },
    true,
  );
  // A file picker can stay open for a while; the trigger is still the control.
  document.addEventListener(
    "change",
    (e) => {
      if (e.target instanceof HTMLInputElement && e.target.type === "file" && lastPress)
        lastPress.at = performance.now();
    },
    true,
  );
}

function liveAnchor(explicit?: HTMLElement | null): HTMLElement | null {
  const el =
    explicit ??
    (lastPress && performance.now() - lastPress.at < ANCHOR_WINDOW_MS ? lastPress.el : null);
  if (!el?.isConnected) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? el : null;
}

/** Outcomes follow the pressed control; detached controls use the outcome stage. */
export function showInlineFeedback(
  title: ReactNode,
  opts: {
    description?: ReactNode;
    action?: InlineErrorAction;
    anchor?: HTMLElement | null;
    tone?: InlineError["tone"];
  } = {},
): number {
  const anchor = opts.anchor === null ? null : liveAnchor(opts.anchor);
  current = {
    id: nextId++,
    anchor,
    tone: opts.tone ?? "error",
    title,
    description: opts.description,
    action: opts.action,
    origin: anchor === lastPress?.el ? lastPress.origin : undefined,
  };
  emit();
  return current.id;
}

export const showInlineError = showInlineFeedback;

export function clearInlineError(id?: number) {
  if (!current || (id !== undefined && current.id !== id)) return;
  current = null;
  emit();
}

export function subscribeInlineError(l: () => void) {
  listeners.add(l);
  return () => void listeners.delete(l);
}

export function getInlineError() {
  return current;
}
