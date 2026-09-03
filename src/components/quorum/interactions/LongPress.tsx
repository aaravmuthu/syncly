import { useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/quorum/haptics";

export type PeekAction = {
  label: string;
  icon?: ReactNode;
  destructive?: boolean;
  onSelect: () => void;
};

const spring = { type: "spring", stiffness: 380, damping: 30 } as const;

/**
 * iOS "peek and pop": long-press (or right-click) lifts the element above a
 * blurred scrim and shows a frosted context menu.
 */
export function LongPress({
  children,
  actions,
  title,
  className,
  delay = 420,
}: {
  children: ReactNode;
  actions: PeekAction[];
  title?: string;
  className?: string;
  delay?: number;
}) {
  const [open, setOpen] = useState(false);
  const timer = useRef<number | null>(null);

  const start = () => {
    clear();
    timer.current = window.setTimeout(() => {
      haptic("warn");
      setOpen(true);
    }, delay);
  };
  const clear = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  };

  return (
    <>
      <div
        className={cn("select-none", className)}
        onTouchStart={start}
        onTouchEnd={clear}
        onTouchMove={clear}
        onTouchCancel={clear}
        onContextMenu={(e) => {
          e.preventDefault();
          haptic("warn");
          setOpen(true);
        }}
      >
        {children}
      </div>

      <AnimatePresence>
        {open
          ? createPortal(
              // Portaled to <body>: must stay pinned to the real viewport
              // even when this list item renders inside a transformed
              // ancestor (RouteTransition's page-slide wrapper), which
              // would otherwise become the containing block for `fixed`.
              <motion.div
                className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-4 bg-background/55 px-6 backdrop-blur-xl"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setOpen(false)}
              >
                <motion.div
                  initial={{ scale: 0.9, y: 12, opacity: 0 }}
                  animate={{ scale: 1, y: 0, opacity: 1 }}
                  exit={{ scale: 0.94, opacity: 0 }}
                  transition={spring}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full max-w-sm"
                >
                  <div className="pointer-events-none overflow-hidden rounded-[28px] shadow-2xl">
                    {children}
                  </div>

                  <div className="mt-3 overflow-hidden rounded-3xl border border-white/10 bg-card/70 backdrop-blur-2xl">
                    {title ? (
                      <p className="border-b border-white/5 px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                        {title}
                      </p>
                    ) : null}
                    {actions.map((a) => (
                      <motion.button
                        key={a.label}
                        type="button"
                        whileTap={{ scale: 0.97 }}
                        onClick={() => {
                          haptic("tap");
                          setOpen(false);
                          a.onSelect();
                        }}
                        className={cn(
                          "flex w-full items-center gap-3 border-b border-white/5 px-4 py-3.5 text-left text-sm font-medium last:border-0",
                          a.destructive ? "text-destructive" : "text-foreground",
                        )}
                      >
                        {a.icon}
                        {a.label}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              </motion.div>,
              document.body,
            )
          : null}
      </AnimatePresence>
    </>
  );
}
