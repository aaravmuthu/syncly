import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

export function Mark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-[0.7rem] bg-primary text-primary-foreground",
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="size-4.5" fill="none">
        <circle cx="12" cy="12" r="7.2" stroke="currentColor" strokeWidth="1.9" />
        <circle cx="12" cy="12" r="2.4" fill="currentColor" />
        <circle cx="12" cy="3.2" r="1.7" fill="currentColor" />
        <circle cx="19.6" cy="16.4" r="1.7" fill="currentColor" />
        <circle cx="4.4" cy="16.4" r="1.7" fill="currentColor" />
      </svg>
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
