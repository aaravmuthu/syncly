/**
 * The landing → demo transition. An evergreen sphere grows out of the hero's
 * cluster until it fills the screen, the next route renders behind it, and a
 * hole opens from the same point so you fly through it into the page.
 *
 * The overlay is a plain element on <body>, outside React, so it survives
 * the landing route unmounting mid-transition. Styles: `.warp-overlay` in
 * styles.css.
 */

export type WarpOrigin = { x: number; y: number; r: number };

const COVER_MS = 620;
const REVEAL_MS = 760;

export async function warpTo({
  origin,
  delay = 0,
  ready,
  go,
}: {
  /** Viewport point (px) the sphere grows from, and its starting radius. */
  origin: WarpOrigin;
  /** Let something else lead in first (the spheres imploding). */
  delay?: number;
  /** Resolves once the next page can render (its code is loaded). */
  ready: Promise<unknown>;
  /** Performs the navigation. */
  go: () => Promise<unknown>;
}) {
  const el = document.createElement("div");
  el.className = "warp-overlay";
  el.setAttribute("aria-hidden", "true");
  el.style.setProperty("--warp-x", `${origin.x}px`);
  el.style.setProperty("--warp-y", `${origin.y}px`);
  // Hidden until the cover animation starts; it waits out `delay`.
  el.style.opacity = "0";
  document.body.appendChild(el);

  // Whatever happens, never leave the page covered.
  const bail = window.setTimeout(() => el.remove(), 5000);
  const far = Math.hypot(
    Math.max(origin.x, window.innerWidth - origin.x),
    Math.max(origin.y, window.innerHeight - origin.y),
  );

  try {
    const at = `at ${origin.x}px ${origin.y}px`;
    // Emerge from the knot quickly, then accelerate at you. The easing sits
    // on each keyframe: one curve over the whole thing kept it invisible
    // for most of its run.
    const cover = el.animate(
      [
        {
          clipPath: `circle(${origin.r * 0.6}px ${at})`,
          "--warp-r": `${origin.r * 0.6}px`,
          opacity: 0,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        },
        {
          clipPath: `circle(${origin.r * 1.15}px ${at})`,
          "--warp-r": `${origin.r * 1.15}px`,
          opacity: 1,
          offset: 0.3,
          easing: "cubic-bezier(0.7, 0, 0.84, 0)",
        },
        { clipPath: `circle(${far + 2}px ${at})`, "--warp-r": `${far + 2}px`, opacity: 1 },
      ],
      { duration: COVER_MS, delay, fill: "both" },
    );
    await Promise.all([cover.finished, ready.catch(() => {})]);

    await go();
    // Two frames for the new route to paint under the cover.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const reveal = el.animate(
      [
        { "--warp-hole": "0px", transform: "scale(1)" },
        { "--warp-hole": `${far + 120}px`, transform: "scale(1.18)" },
      ],
      { duration: REVEAL_MS, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" },
    );
    // Browsers that can't animate the registered property still fade it away.
    el.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 260,
      delay: REVEAL_MS - 260,
      fill: "forwards",
    });
    await reveal.finished;
  } finally {
    window.clearTimeout(bail);
    el.remove();
  }
}
