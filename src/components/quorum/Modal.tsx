import type { ReactNode } from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { X } from "lucide-react";

/**
 * Native iOS-style bottom sheet used for every modal surface in the app —
 * drag handle, spring physics and a blurred vibrancy overlay on all sizes.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <DrawerPrimitive.Root
      open={open}
      onOpenChange={(v) => (v ? null : onClose())}
      autoFocus
      shouldScaleBackground
    >
      <DrawerPrimitive.Portal>
        <DrawerPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md" />
        <DrawerPrimitive.Content
          aria-label={title}
          className="mobile-sheet surface fixed inset-x-0 bottom-0 z-50 mx-auto flex w-full max-w-lg flex-col rounded-b-none rounded-t-[var(--radius-surface)] p-5 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]"
        >
          <div className="mx-auto mb-4 h-1.5 w-10 shrink-0 rounded-full bg-foreground/25" />
          <div className="flex shrink-0 items-start justify-between gap-3">
            <DrawerPrimitive.Title className="min-w-0 max-h-[min(8rem,25dvh)] overflow-y-auto text-xl font-bold tracking-tight [overflow-wrap:anywhere]">
              {title}
            </DrawerPrimitive.Title>
            <DrawerPrimitive.Close
              aria-label="Close"
              className="tap-target pressable grid shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-secondary"
            >
              <X className="size-5" aria-hidden />
            </DrawerPrimitive.Close>
          </div>
          {description ? (
            <DrawerPrimitive.Description className="mt-1 text-sm font-medium text-muted-foreground">
              {description}
            </DrawerPrimitive.Description>
          ) : (
            <DrawerPrimitive.Description className="sr-only">{title}</DrawerPrimitive.Description>
          )}
          <div className="mobile-sheet-scroll mt-4 min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain [overflow-wrap:anywhere]">
            {children}
          </div>
          {footer ? (
            <div className="mt-3 shrink-0 border-t border-border pt-3">{footer}</div>
          ) : null}
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  );
}
