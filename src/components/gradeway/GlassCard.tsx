import { useRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  interactive?: boolean;
}

export function GlassCard({ children, className, interactive = true, ...rest }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!interactive || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    ref.current.style.setProperty("--mx", `${e.clientX - r.left}px`);
    ref.current.style.setProperty("--my", `${e.clientY - r.top}px`);
  };
  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      className={cn("glass group relative overflow-hidden transition-transform duration-300", interactive && "hover:-translate-y-0.5", className)}
      {...rest}
    >
      {interactive && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: "radial-gradient(400px circle at var(--mx, 50%) var(--my, 50%), oklch(0.82 0.18 200 / 0.12), transparent 60%)" }}
        />
      )}
      <div className="relative">{children}</div>
    </div>
  );
}