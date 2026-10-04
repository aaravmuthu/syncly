import { useCallback, useEffect, useRef, useState } from "react";

/** What the avatar is watching: an element, and a tick that says "look again". */
export type Follow = { el: HTMLElement; tick: number };

const CLICK_LINGER_MS = 1400;

const isField = (el: EventTarget | null): el is HTMLInputElement | HTMLTextAreaElement =>
  el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;

/**
 * Event handlers to spread on a form's wrapper so a Sync avatar can follow
 * whoever is filling it in, without every field knowing about the avatar.
 *
 * - `follow`   the field being typed in, or the control just tapped
 * - `pulse`    bumps on every keystroke and tap, for the avatar's small nod
 * - `isPrivate` the focused field sits inside `[data-avatar-private]`
 * - `kind`     the focused field's `data-avatar` label, for field-specific moods
 *
 * Parts of the form that should not draw the gaze (the footer buttons) opt out
 * with `data-avatar-ignore`.
 */
export function useAvatarFollow() {
  const [follow, setFollow] = useState<Follow | null>(null);
  const [pulse, setPulse] = useState(0);
  const timer = useRef<number>(undefined);
  const root = useRef<HTMLElement | null>(null);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const watch = useCallback((el: HTMLElement) => {
    setFollow((f) => ({ el, tick: (f?.tick ?? 0) + 1 }));
  }, []);

  const bind = {
    onFocus: (e: React.FocusEvent<HTMLElement>) => {
      root.current = e.currentTarget;
      if (!isField(e.target) || e.target.closest("[data-avatar-ignore]")) return;
      window.clearTimeout(timer.current);
      watch(e.target);
    },
    onBlur: (e: React.FocusEvent<HTMLElement>) => {
      const next = e.relatedTarget;
      if (next instanceof Node && e.currentTarget.contains(next)) return;
      window.clearTimeout(timer.current);
      setFollow(null);
    },
    onInput: (e: React.FormEvent<HTMLElement>) => {
      if (!isField(e.target) || e.target.closest("[data-avatar-ignore]")) return;
      setPulse((p) => p + 1);
      watch(e.target);
    },
    onClick: (e: React.MouseEvent<HTMLElement>) => {
      const hit = e.target instanceof Element ? e.target.closest<HTMLElement>("button") : null;
      if (!hit || hit.closest("[data-avatar-ignore]")) return;
      setPulse((p) => p + 1);
      watch(hit);
      // Glance at what was tapped, then go back to the field being typed in.
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        const active = document.activeElement;
        if (isField(active) && e.currentTarget.contains(active)) watch(active);
        else setFollow(null);
      }, CLICK_LINGER_MS);
    },
  };

  const field = follow?.el.closest<HTMLElement>("[data-avatar]") ?? null;
  return {
    bind,
    follow,
    pulse,
    kind: field?.dataset["avatar"] ?? null,
    isPrivate: Boolean(follow?.el.closest("[data-avatar-private]")),
  };
}
