import type { ReactNode } from "react";
import { useEffect } from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * Mobile: drag-to-dismiss bottom sheet (Vaul).
 * Desktop: centered dialog card.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!open || isMobile) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, isMobile]);

  if (isMobile) {
    return (
      <DrawerPrimitive.Root open={open} onOpenChange={(v) => (v ? null : onClose())}>
        <DrawerPrimitive.Portal>
          <DrawerPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm" />
          <DrawerPrimitive.Content
            aria-label={title}
            className="surface fixed inset-x-0 bottom-0 z-50 mt-24 flex max-h-[88dvh] flex-col rounded-t-3xl p-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]"
          >
            <div className="mx-auto mb-4 h-1.5 w-12 shrink-0 rounded-full bg-muted-foreground/30" />
            <DrawerPrimitive.Title className="font-display mb-3 text-base font-semibold">
              {title}
            </DrawerPrimitive.Title>
            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          </DrawerPrimitive.Content>
        </DrawerPrimitive.Portal>
      </DrawerPrimitive.Root>
    );
  }

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.button
            type="button"
            aria-label="Close"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-foreground/35 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 32, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="glass-card relative w-full max-w-md p-5"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-display text-base font-semibold">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="tap-target rounded-xl px-2 py-1 text-muted-foreground hover:bg-secondary"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
