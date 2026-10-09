import type { ReactNode } from "react";

/**
 * Errors live on the control that caused them, not in a popup. Every press is
 * remembered; when an error comes back, the pressed button itself turns into
 * the error for a moment and the reason hangs just under it
 * (InlineErrorLayer renders both).
 */

export type InlineErrorAction = { label: ReactNode; onClick: () => void };

export type InlineError = {
  id: number;
  anchor: HTMLElement;
  title: ReactNode;
  description?: ReactNode;
  action?: InlineErrorAction;
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

let lastPress: { el: HTMLElement; at: number } | null = null;
let current: InlineError | null = null;
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function remember(target: EventTarget | null) {
  const el = target instanceof Element ? target.closest<HTMLElement>(PRESSABLE) : null;
  lastPress = el ? { el, at: performance.now() } : null;
}

if (typeof document !== "undefined") {
  document.addEventListener("pointerdown", (e) => remember(e.target), true);
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

/** Returns false when there's no live control to attach the error to. */
export function showInlineError(
  title: ReactNode,
  opts: { description?: ReactNode; action?: InlineErrorAction; anchor?: HTMLElement | null } = {},
): number | false {
  const anchor = liveAnchor(opts.anchor);
  if (!anchor) return false;
  current = {
    id: nextId++,
    anchor,
    title,
    description: opts.description,
    action: opts.action,
  };
  emit();
  return current.id;
}

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
