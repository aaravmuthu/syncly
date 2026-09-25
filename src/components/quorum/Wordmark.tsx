import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/quorum/Logo";

export function Mark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex size-8 items-center justify-center", className)} aria-hidden>
      <LogoMark size={32} className="size-full rounded-[22%]" />
    </span>
  );
}

export function Wordmark({ size = "md", className }: { size?: "sm" | "md"; className?: string }) {
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
