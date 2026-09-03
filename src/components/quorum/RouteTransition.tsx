import { useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion, type Transition } from "motion/react";
import { useRef, type ReactNode } from "react";
import { prefersReducedMotion } from "@/lib/quorum/haptics";

type Direction = "forward" | "backward" | "fade";

const depth = (pathname: string) => pathname.split("/").filter(Boolean).length;

// iOS push/pop reads by path depth, not by history action, so it works the
// same whether you got here via a Link tap or the browser's back button:
// deeper path = pushed (slide in from the right), shallower = popped (slide
// in from the left), same depth = a lateral move (tab switch, header icon)
// that gets a plain crossfade instead of a directional slide.
function useRouteDirection(pathname: string): Direction {
  const prevDepth = useRef(depth(pathname));
  const prevPath = useRef(pathname);
  if (pathname === prevPath.current) return "fade";
  const d = depth(pathname);
  const direction: Direction = d > prevDepth.current ? "forward" : d < prevDepth.current ? "backward" : "fade";
  prevDepth.current = d;
  prevPath.current = pathname;
  return direction;
}

const variants = {
  enter: (dir: Direction) => ({
    x: dir === "forward" ? "100%" : dir === "backward" ? "-28%" : 0,
    opacity: dir === "fade" ? 0 : 1,
  }),
  center: { x: 0, opacity: 1 },
  exit: (dir: Direction) => ({
    x: dir === "forward" ? "-28%" : dir === "backward" ? "100%" : 0,
    opacity: dir === "fade" ? 0 : dir === "forward" ? 0.55 : 1,
  }),
};

const slideTransition: Transition = { type: "spring", stiffness: 380, damping: 38, mass: 0.9 };
const fadeTransition: Transition = { duration: 0.16, ease: "easeOut" };

/** Wraps a route's main content in an iOS-style push/pop/fade transition. */
export function RouteTransition({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const direction = useRouteDirection(pathname);

  if (prefersReducedMotion()) return <>{children}</>;

  return (
    <AnimatePresence mode="popLayout" initial={false} custom={direction}>
      <motion.div
        key={pathname}
        custom={direction}
        variants={variants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={direction === "fade" ? fadeTransition : slideTransition}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
