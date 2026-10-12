import { useEffect, type RefObject } from "react";
import { useMotionValue, useScroll } from "motion/react";
import type { OrbitControl } from "./SyncOrbit";
import type { WarpOrigin } from "./warp";

/** Cache layout on resize; scrolling only writes compositor motion values. */
export function useOrbHandoff(
  hero: RefObject<HTMLElement | null>,
  track: RefObject<HTMLElement | null>,
  anchor: RefObject<HTMLDivElement | null>,
  orbit: RefObject<OrbitControl | null>,
  enabled: boolean,
) {
  const { scrollY } = useScroll();
  const arrival = useMotionValue(0);
  const transform = useMotionValue("translate(0px, 0px) scale(1)");
  const origin = useMotionValue("50% 50%");
  const opacity = useMotionValue(0);
  const pointerEvents = useMotionValue<"none" | "auto">("none");

  useEffect(() => {
    if (!enabled || !hero.current || !track.current || !anchor.current) {
      orbit.current?.handoff(false);
      return;
    }
    const heroEl = hero.current;
    const trackEl = track.current;
    const anchorEl = anchor.current;
    let source: WarpOrigin | null = null;
    let layout = { start: 0, end: 1, x: 0, y: 0, r: 1, cx: 0, cy: 0, top: 0, header: 65 };
    const update = () => {
      const y = scrollY.get();
      const t = Math.max(0, Math.min(1, (y - layout.start) / (layout.end - layout.start)));
      arrival.set(t);
      if (t === 0) {
        if (source) orbit.current?.handoff(false);
        source = null;
        opacity.set(0);
        pointerEvents.set("none");
        return;
      }
      source ??= orbit.current?.handoff(true) ?? null;
      if (!source) {
        transform.set("translate(0px, 0px) scale(1)");
        opacity.set(t);
        pointerEvents.set(t === 1 ? "auto" : "none");
        return;
      }
      const ease = t * t * (3 - 2 * t);
      const sticky = Math.max(0, y - layout.top + layout.header);
      const dx =
        (source.x - layout.x) * (1 - ease) +
        Math.sin(t * Math.PI) * Math.min(60, window.innerWidth * 0.045);
      const dy = (source.y - layout.y - sticky) * (1 - ease);
      const ratio = source.r / layout.r;
      transform.set(`translate(${dx}px, ${dy}px) scale(${ratio + (1 - ratio) * ease})`);
      opacity.set(1);
      pointerEvents.set(t === 1 ? "auto" : "none");
    };
    const measure = () => {
      const heroBox = heroEl.getBoundingClientRect();
      const trackBox = trackEl.getBoundingClientRect();
      const box = anchorEl.getBoundingClientRect();
      const top = trackBox.top + window.scrollY;
      const header = parseFloat(getComputedStyle(anchorEl.parentElement!).top) || 65;
      const camera = Math.max(window.innerWidth < 768 ? 6 : 4.2, (box.height / box.width) * 4.6);
      const cx = box.width / 2 - (0.18 * 3.1 * box.height) / (2 * camera);
      const cy = box.height / 2 - (0.12 * 3.1 * box.height) / (2 * camera);
      layout = {
        start: heroBox.top + window.scrollY + Math.min(heroBox.height * 0.16, 120),
        end: top - header,
        x: box.left + cx,
        y: top + anchorEl.offsetTop + cy,
        r: (0.72 * 3.1 * box.height) / (2 * Math.sqrt(camera ** 2 - 0.72 ** 2)),
        cx,
        cy,
        top,
        header,
      };
      if (source) source = orbit.current?.handoff(true) ?? source;
      origin.set(`${cx}px ${cy}px`);
      update();
    };
    const resize = new ResizeObserver(measure);
    resize.observe(heroEl);
    resize.observe(anchorEl);
    window.addEventListener("resize", measure, { passive: true });
    measure();
    const stop = scrollY.on("change", update);
    return () => {
      stop();
      resize.disconnect();
      window.removeEventListener("resize", measure);
      orbit.current?.handoff(false);
    };
  }, [
    enabled,
    hero,
    track,
    anchor,
    orbit,
    scrollY,
    arrival,
    transform,
    origin,
    opacity,
    pointerEvents,
  ]);

  return { arrival, transform, transformOrigin: origin, opacity, pointerEvents };
}
