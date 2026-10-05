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
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <DrawerPrimitive.Root
      open={open}
      onOpenChange={(v) => (v ? null : onClose())}
      shouldScaleBackground
    >
      <DrawerPrimitive.Portal>
        <DrawerPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md" />
        <DrawerPrimitive.Content
          aria-label={title}
          className="surface fixed inset-x-0 bottom-0 z-50 mx-auto mt-24 flex max-h-[88dvh] w-full max-w-lg flex-col rounded-b-none rounded-t-[28px] p-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]"
        >
          <div className="mx-auto mb-4 h-1.5 w-10 shrink-0 rounded-full bg-foreground/25" />
          <div className="flex items-center justify-between gap-3">
            <DrawerPrimitive.Title className="text-xl font-bold tracking-tight">
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
          <div className="mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  );
}
