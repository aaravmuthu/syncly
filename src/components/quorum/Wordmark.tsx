import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

export function Mark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-[0.7rem] bg-primary text-primary-foreground shadow-[0_0_22px_-6px_hsl(var(--primary)/0.9)]",
        className,
      )}
      aria-hidden
    >
      <Zap className="size-4.5" strokeWidth={2.4} fill="currentColor" />
    </span>
  );
}

export function Wordmark({
  size = "md",
  className,
}: {
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Mark className={size === "sm" ? "size-7" : "size-8"} />
      <span
        className={cn(
          "font-display font-semibold tracking-tight",
          size === "sm" ? "text-base" : "text-lg",
        )}
      >
        {BRAND.name}
      </span>
    </span>
  );
}
