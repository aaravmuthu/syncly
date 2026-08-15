import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Native-feeling bottom sheet. Becomes a centered dialog on large screens.
 */
export function Sheet({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  eyebrow?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <button
        className="absolute inset-0 bg-background/70 backdrop-blur-sm sg-fade-in"
        onClick={onClose}
        aria-label="Close"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "sg-sheet-in relative flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-[28px] border border-border bg-popover shadow-2xl sm:max-w-lg sm:rounded-3xl",
          className,
        )}
      >
        <div className="flex shrink-0 items-start gap-3 px-5 pb-3 pt-3">
          <div className="absolute inset-x-0 top-2 mx-auto h-1 w-10 rounded-full bg-muted sm:hidden" />
          <div className="min-w-0 flex-1 pt-3 sm:pt-0">
            {eyebrow ? (
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {eyebrow}
              </p>
            ) : null}
            {title ? (
              <h2 className="mt-0.5 text-lg font-semibold tracking-tight">{title}</h2>
            ) : null}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="mt-2 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {footer ? (
          <div className="shrink-0 border-t border-border bg-popover px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
            {footer}
          </div>
        ) : (
          <div className="pb-[max(0.75rem,env(safe-area-inset-bottom))]" />
        )}
      </div>
    </div>
  );
}
