import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Stays in the scroll flow, with room for the app tabs and the phone keyboard. */
export function MobileActions({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const footer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = footer.current;
    const flow = element?.closest(".constraint-flow");
    if (!element || !flow) return;
    const root = document.documentElement;
    let frame = 0;
    const measure = () => {
      const rect = element.getBoundingClientRect();
      if (
        getComputedStyle(element).position === "sticky" &&
        rect.bottom > 0 &&
        rect.top < window.innerHeight
      ) {
        root.style.setProperty("--plan-form-bottom", `${window.innerHeight - rect.top + 12}px`);
      } else {
        root.style.removeProperty("--plan-form-bottom");
      }
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(flow);
    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      root.style.removeProperty("--plan-form-bottom");
    };
  }, []);
  return (
    <div ref={footer} data-avatar-ignore className={cn("mobile-actions", className)}>
      {children}
    </div>
  );
}
