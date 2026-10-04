import { AnimatePresence, motion, useReducedMotion } from "motion/react";

export type SayLine = { text: string; id: number };

/**
 * A short line from the companion, in a small frosted pill under it. Flavour,
 * never information (the form and its toasts say everything that matters), so
 * it is hidden from assistive tech. The space is always reserved, so a line
 * appearing never moves the page.
 */
export function SyncSay({ line }: { line: SayLine | null }) {
  const reduce = useReducedMotion();
  return (
    <div aria-hidden="true" className="mx-auto flex h-8 items-center justify-center">
      <AnimatePresence mode="wait" initial={false}>
        {line && (
          <motion.span
            key={line.id}
            initial={
              reduce ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.96, filter: "blur(4px)" }
            }
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.26, ease: [0.23, 1, 0.32, 1] }}
            className="rounded-full border border-border/70 bg-card/70 px-3.5 py-1 text-[0.8125rem] text-foreground/90 backdrop-blur-md"
          >
            {line.text}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
