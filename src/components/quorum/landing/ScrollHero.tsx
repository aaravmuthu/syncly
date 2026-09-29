import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { LiveScreen } from "./LiveScreen";

/*
 * A port of the Claude Design hero ("Syncly Hero.dc.html"). Every number below
 * is the reference's unless a comment says otherwise. The section is 320svh
 * tall with a sticky 100svh stage, and one progress value `p` (0 at the top of
 * the section, 1 when its end reaches the bottom of the viewport) drives
 * everything, so the motion is scrubbed by the scroll, not played on load.
 */
const TILT = 34;
const SMOOTHING = 0.35;
// Share of the remaining distance `p` covers per 60Hz frame (the reference's
// `1 - 0.88 * smoothing`), applied per elapsed time below.
const FOLLOW = 1 - 0.88 * SMOOTHING;
const FRAME = 1000 / 60;

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
/** Eased 0→1 as `v` runs from `a` to `b`. */
const seg = (v: number, a: number, b: number) => easeOutCubic(clamp((v - a) / (b - a)));

/**
 * Landing hero: the headline over a tilted iPad that rises, straightens and
 * wakes into the real app as the visitor scrolls. `children` is the headline.
 */
export function ScrollHero({ children }: { children: ReactNode }) {
  const reduce = !!useReducedMotion();
  // Phones get the iPad held upright; a landscape one is too small to read.
  const [portrait, setPortrait] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639.98px)");
    const update = () => setPortrait(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  const heroRef = useRef<HTMLElement>(null);
  const p = useMotionValue(0);
  const still = useMotionValue(0);

  useEffect(() => {
    still.set(reduce ? 1 : 0);
    const hero = heroRef.current;
    if (!hero || reduce) return;
    const stage = hero.firstElementChild as HTMLElement;
    let top = 0;
    let range = 1;
    let cur = window.scrollY;
    let raf = 0;
    let last = 0;

    const measure = () => {
      top = hero.getBoundingClientRect().top + window.scrollY;
      range = Math.max(1, hero.offsetHeight - stage.offsetHeight);
    };
    const apply = () => p.set(clamp((cur - top) / range));
    // The reference eases the scroll position toward the real one each frame.
    // Scaling that step by elapsed time keeps the same feel at 120Hz as at 60.
    const tick = (now: number) => {
      const target = window.scrollY;
      const dt = last ? Math.min(now - last, 4 * FRAME) : FRAME;
      last = now;
      cur += (target - cur) * (1 - Math.pow(1 - FOLLOW, dt / FRAME));
      if (Math.abs(target - cur) < 0.3) cur = target;
      apply();
      if (cur === target) {
        raf = 0;
        last = 0;
      } else raf = requestAnimationFrame(tick);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const onResize = () => {
      measure();
      apply();
    };

    measure();
    apply();
    const ro = new ResizeObserver(onResize);
    ro.observe(hero);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
    };
  }, [p, still, reduce]);

  // Device: rises from 54svh below centre, grows from 0.8, and stands up from
  // 34° back and 3° off level, all on one ease-out over the first 62%.
  const settle = useTransform(() => (still.get() ? 0 : seg(p.get(), 0, 0.62)));
  const deviceTransform = useTransform(() => {
    // Reduced motion: the finished pose, upright and in place (styles.css
    // lays it out in the page flow).
    if (still.get()) return "none";
    const e = settle.get();
    const inv = 1 - e;
    return `translate3d(-50%,-50%,0) translateY(${(inv * 54).toFixed(3)}svh) scale(${(0.8 + 0.2 * e).toFixed(4)}) rotateX(${(TILT * inv).toFixed(3)}deg) rotateZ(${(-3 * inv).toFixed(3)}deg)`;
  });

  // Headline: gone by 20%, drifting up at a third of the scroll speed.
  const headlineOpacity = useTransform(() => (still.get() ? 1 : 1 - seg(p.get(), 0.02, 0.2)));
  const headlineTransform = useTransform(
    () => `translate3d(0,${still.get() ? 0 : (-p.get() * 35).toFixed(3)}svh,0)`,
  );
  const headlineVisibility = useTransform(() =>
    headlineOpacity.get() < 0.01 ? "hidden" : "visible",
  );

  // Rings: the slowest layer, so they read as the far background.
  const ringsTransform = useTransform(() => {
    if (still.get()) return "none";
    const e = settle.get();
    return `translate3d(0,${((1 - e) * 14).toFixed(3)}svh,0) scale(${(0.92 + 0.08 * e).toFixed(4)})`;
  });

  // The screen's own timeline starts once the device is most of the way up.
  const screen = useTransform(() => (still.get() ? 1 : clamp((p.get() - 0.35) / 0.55)));
  const offOpacity = useTransform(() => 1 - seg(screen.get(), 0, 0.14));
  const glareOpacity = useTransform(() => (still.get() ? 0 : 1 - settle.get()));

  return (
    <section
      ref={heroRef}
      className="scroll-hero relative h-[260svh] sm:h-[320svh]"
      // Starts under the sticky header, as the reference starts under its nav.
      style={{ marginTop: "calc(-1 * var(--hero-nav))" }}
    >
      <div
        className="hero-frame sticky top-0 h-svh overflow-hidden"
        style={{ perspective: "1800px", perspectiveOrigin: "50% 30%" }}
      >
        <motion.div
          aria-hidden
          style={{ transform: ringsTransform }}
          className="hero-rings absolute top-[calc(50%+var(--hero-nav)/2)] left-1/2 size-0 will-change-transform"
        >
          <span className="absolute -top-[36vmax] -left-[36vmax] size-[72vmax] rounded-full border border-foreground/[0.07]" />
          <span className="absolute -top-[54vmax] -left-[54vmax] size-[108vmax] rounded-full border border-foreground/[0.05]" />
          <span className="absolute -top-[72vmax] -left-[72vmax] size-[144vmax] rounded-full border border-foreground/[0.035]" />
        </motion.div>

        <motion.div
          style={{
            opacity: headlineOpacity,
            transform: headlineTransform,
            visibility: headlineVisibility,
          }}
          className="hero-headline absolute inset-x-0 top-[calc(var(--hero-nav)+7svh)] px-6 text-center will-change-[transform,opacity]"
        >
          {children}
        </motion.div>

        <motion.div
          style={{ transform: deviceTransform, transformOrigin: "50% 60%" }}
          className="hero-device absolute top-[calc(50%+var(--hero-nav)/2)] left-1/2 will-change-transform"
        >
          <div className="hero-bezel relative">
            <span
              aria-hidden
              className="absolute top-1/2 left-[clamp(4px,0.65vw,7px)] -mt-[3px] size-1.5 rounded-full bg-[#3a3a3c]"
            />
            <div
              role="img"
              aria-label="Syncly ranking plans for a group of four. Each friend answers privately; when one of them changes an answer, the plans re-rank and a new top pick that works for everyone moves up."
              className="hero-screen relative aspect-[1180/820] overflow-hidden bg-background max-sm:aspect-[820/1180]"
            >
              <LiveScreen progress={screen} portrait={portrait} reduce={reduce} />

              <motion.div
                aria-hidden
                style={{ opacity: offOpacity }}
                className="hero-off absolute inset-0 bg-black"
              />
              <motion.div
                aria-hidden
                style={{ opacity: glareOpacity }}
                className="hero-glare pointer-events-none absolute inset-0"
              />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
