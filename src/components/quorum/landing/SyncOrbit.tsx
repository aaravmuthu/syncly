import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { OrbitTheme, SyncOrbit as Engine } from "./sync-orbit-engine";

/**
 * The hero's WebGL scene (sync-orbit-engine.ts), sized to its container and
 * coloured from the live theme tokens. It only animates while on screen and
 * the tab is visible; with reduced motion it renders one settled frame. When
 * WebGL isn't available, `onFallback` lets the page show its plain headline.
 */

// Resolve any CSS colour (the tokens are oklch) to linear-ish 0–1 sRGB by
// letting a 1px canvas do the conversion.
function readColor(ctx: CanvasRenderingContext2D, value: string): [number, number, number] {
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = "#000";
  ctx.fillStyle = value;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255];
}

function readTheme(): OrbitTheme {
  const root = document.documentElement;
  const style = getComputedStyle(root);
  const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  const token = (name: string) => readColor(ctx, style.getPropertyValue(name).trim());
  return {
    background: token("--background"),
    foreground: token("--foreground"),
    primary: token("--primary"),
    accent: token("--accent"),
    dark: root.classList.contains("dark"),
  };
}

export function SyncOrbit({
  lines,
  className,
  onFallback,
}: {
  lines: [string, string];
  className?: string;
  onFallback?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [live, setLive] = useState(false);
  const fallbackRef = useRef(onFallback);
  fallbackRef.current = onFallback;
  const [first, second] = lines;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    let engine: Engine | null = null;
    let cancelled = false;
    const cleanups: (() => void)[] = [];

    import("./sync-orbit-engine")
      .then(({ SyncOrbit: Orbit }) => {
        if (cancelled) return;
        try {
          engine = new Orbit(canvas, {
            lines: [first, second],
            fontWeight: "600",
            fontFamily: '"Bricolage Grotesque", ui-serif, Georgia, serif',
            still,
          });
        } catch {
          fallbackRef.current?.();
          return;
        }
        const e = engine;
        e.setTheme(readTheme());

        // The display face arrives from Google Fonts; redraw the band once it's in.
        document.fonts
          ?.load('600 200px "Bricolage Grotesque"')
          .then(() => !cancelled && e.drawText())
          .catch(() => {});

        // Phones render at a lower density: every pixel traces eight spheres.
        const sizeTo = () => {
          const rect = canvas.getBoundingClientRect();
          const cap = coarse || rect.width < 768 ? 1.5 : 1.75;
          e.resize(rect.width, rect.height, Math.min(window.devicePixelRatio || 1, cap));
        };
        sizeTo();
        const ro = new ResizeObserver(sizeTo);
        ro.observe(canvas);
        cleanups.push(() => ro.disconnect());

        // Follow the site theme toggle.
        const mo = new MutationObserver(() => e.setTheme(readTheme()));
        mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
        cleanups.push(() => mo.disconnect());

        canvas.addEventListener("webglcontextlost", (ev) => {
          ev.preventDefault();
          e.stop();
          fallbackRef.current?.();
        });

        if (!still) {
          // Run only while visible: on screen and in a foreground tab.
          let inView = false;
          const sync = () => (inView && !document.hidden ? e.start() : e.stop());
          const io = new IntersectionObserver(([entry]) => {
            inView = entry.isIntersecting;
            sync();
          });
          io.observe(canvas);
          document.addEventListener("visibilitychange", sync);
          cleanups.push(() => {
            io.disconnect();
            document.removeEventListener("visibilitychange", sync);
          });

          // The canvas sits under the hero's text and buttons, so listen on
          // the window and map into its box.
          const local = (ev: PointerEvent) => {
            const r = canvas.getBoundingClientRect();
            const x = (ev.clientX - r.left) / r.width;
            const y = (ev.clientY - r.top) / r.height;
            return x >= 0 && x <= 1 && y >= 0 && y <= 1 ? ([x, y] as const) : null;
          };
          const onMove = (ev: PointerEvent) => {
            const p = local(ev);
            if (p) e.pointerMove(p[0], p[1]);
            else e.pointerLeave();
          };
          const onDown = (ev: PointerEvent) => {
            const p = local(ev);
            if (p) e.pointerMove(p[0], p[1]);
            // Not on links and buttons: a tap there means the control, not the scene.
            if (p && !(ev.target as Element | null)?.closest("a, button")) e.burst(p[0], p[1]);
          };
          // A lifted finger is gone, unlike a mouse resting over the page.
          const onUp = (ev: PointerEvent) => {
            if (ev.pointerType !== "mouse") e.pointerLeave();
          };
          window.addEventListener("pointermove", onMove, { passive: true });
          window.addEventListener("pointerdown", onDown, { passive: true });
          window.addEventListener("pointerup", onUp, { passive: true });
          window.addEventListener("pointercancel", onUp, { passive: true });
          cleanups.push(() => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerdown", onDown);
            window.removeEventListener("pointerup", onUp);
            window.removeEventListener("pointercancel", onUp);
          });
        }

        requestAnimationFrame(() => !cancelled && setLive(true));
      })
      .catch(() => fallbackRef.current?.());

    return () => {
      cancelled = true;
      cleanups.forEach((fn) => fn());
      engine?.dispose();
    };
  }, [first, second]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cn("sync-orbit", className)}
      data-live={live || undefined}
    />
  );
}
