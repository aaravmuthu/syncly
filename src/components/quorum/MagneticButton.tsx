import { useRef, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";

type Props = {
  children: ReactNode;
  className?: string;
  to?: string;
  href?: string;
  search?: Record<string, unknown>;
  strength?: number;
};

/** Wraps a CTA so it subtly pulls toward the cursor while hovered. */
export function MagneticButton({ children, className, to, href, search, strength = 0.35 }: Props) {
  const ref = useRef<HTMLSpanElement>(null);

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    el.style.transform = `translate3d(${dx * strength}px, ${dy * strength}px, 0)`;
  };
  const reset = () => {
    if (ref.current) ref.current.style.transform = "translate3d(0,0,0)";
  };

  const inner = (
    <span
      ref={ref}
      className="inline-flex transition-transform duration-300 ease-out will-change-transform"
    >
      {children}
    </span>
  );

  const shared = {
    className,
    onMouseMove: onMove,
    onMouseLeave: reset,
  };

  if (to) {
    return (
      <Link to={to} search={search as never} {...shared}>
        {inner}
      </Link>
    );
  }
  return (
    <a href={href ?? "#"} {...shared}>
      {inner}
    </a>
  );
}
