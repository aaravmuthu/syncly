import { useEffect } from "react";

/** Safari resizes its visual viewport; Android can resize the layout viewport. */
export function useMobileViewport() {
  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    let width = window.innerWidth;
    let restingHeight = window.innerHeight;
    let frame = 0;
    const update = () => {
      if (viewport && viewport.scale !== 1) return;
      const active = document.activeElement;
      const editing =
        active instanceof HTMLElement &&
        active.matches(
          "textarea, input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]):not([type=submit]), [contenteditable=true]",
        );
      if (width !== window.innerWidth || !editing) {
        width = window.innerWidth;
        restingHeight = window.innerHeight;
      }
      const inset = Math.max(
        0,
        window.innerHeight - (viewport?.height ?? window.innerHeight) - (viewport?.offsetTop ?? 0),
      );
      const open = editing && Math.max(inset, restingHeight - window.innerHeight) > 120;
      root.dataset.keyboardOpen = String(open);
      root.style.setProperty("--keyboard-inset", open ? `${inset}px` : "0px");
      root.style.setProperty(
        "--visual-viewport-height",
        `${viewport?.height ?? window.innerHeight}px`,
      );
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("resize", schedule);
    viewport?.addEventListener("resize", schedule);
    viewport?.addEventListener("scroll", schedule);
    document.addEventListener("focusin", schedule);
    document.addEventListener("focusout", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      viewport?.removeEventListener("resize", schedule);
      viewport?.removeEventListener("scroll", schedule);
      document.removeEventListener("focusin", schedule);
      document.removeEventListener("focusout", schedule);
      delete root.dataset.keyboardOpen;
      root.style.removeProperty("--keyboard-inset");
      root.style.removeProperty("--visual-viewport-height");
    };
  }, []);
}
