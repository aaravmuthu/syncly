import { CircleCheck, LoaderCircle } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type ComponentPropsWithoutRef, createContext, type ReactNode, useContext } from "react";
import { cn } from "@/lib/utils";

/**
 * A little receipt printer that feeds a receipt out of its slot: processing →
 * printing → complete. Compound parts (Root, Machine, Header, Screen, Status,
 * Output, Paper) so callers compose their own receipt.
 *
 * The printer is a physical object, so it keeps the same teal-graphite body
 * and warm paper in both themes; only its shadows follow the page.
 */

export type ReceiptPrinterStage = "processing" | "printing" | "complete";
export type ReceiptFeedMotion = "smooth" | "stepped";

type RootProps = Omit<ComponentPropsWithoutRef<"section">, "children"> & {
  /** Disables all stage transitions when false. */
  animate?: boolean;
  children: ReactNode;
  /** Whether the paper feeds continuously or one line at a time. */
  feedMotion?: ReceiptFeedMotion;
  stage: ReceiptPrinterStage;
  /** Status text per stage; defaults to generic order copy. */
  labels?: Partial<Record<ReceiptPrinterStage, ReactNode>>;
};

type StatusProps = Omit<ComponentPropsWithoutRef<"div">, "children"> & {
  /** Custom status content. Defaults to the label for the current stage. */
  children?: ReactNode;
};

type Ctx = {
  animate: boolean;
  feedMotion: ReceiptFeedMotion;
  labels: Record<ReceiptPrinterStage, ReactNode>;
  shouldMove: boolean;
  stage: ReceiptPrinterStage;
};

const ReceiptPrinterContext = createContext<Ctx | null>(null);

const easeOut = [0.23, 1, 0.32, 1] as const;
const easeInOut = [0.77, 0, 0.175, 1] as const;

// Zig-zag tear along the bottom edge of the paper.
const TOOTH_COUNT = 40;
const TOOTH_DEPTH = 4;
const toothPoints = Array.from({ length: TOOTH_COUNT * 2 }, (_, i) => {
  const x = 100 - ((i + 1) * 100) / (TOOTH_COUNT * 2);
  const y = i % 2 === 0 ? "100%" : `calc(100% - ${TOOTH_DEPTH}px)`;
  return `${x}% ${y}`;
}).join(", ");
const receiptClipPath = `polygon(0 0, 100% 0, 100% calc(100% - ${TOOTH_DEPTH}px), ${toothPoints})`;

// Stepped feed: the paper advances, pauses (a printed line), advances again.
const steppedFeed = [
  "translateY(calc(-100% + 2px))",
  "translateY(-91%)",
  "translateY(-91%)",
  "translateY(-81%)",
  "translateY(-81%)",
  "translateY(-70%)",
  "translateY(-70%)",
  "translateY(-58%)",
  "translateY(-58%)",
  "translateY(-45%)",
  "translateY(-45%)",
  "translateY(-32%)",
  "translateY(-32%)",
  "translateY(-20%)",
  "translateY(-20%)",
  "translateY(-10%)",
  "translateY(-10%)",
  "translateY(-3%)",
  "translateY(-3%)",
  "translateY(0%)",
];
const steppedFeedTimes = [
  0, 0.075, 0.105, 0.18, 0.21, 0.285, 0.315, 0.39, 0.42, 0.495, 0.525, 0.6, 0.63, 0.705, 0.735,
  0.81, 0.84, 0.915, 0.945, 1,
];

/** How long the paper takes to feed out; callers wait this long before "complete". */
export const RECEIPT_FEED_MS = 1750;

const DEFAULT_LABELS: Record<ReceiptPrinterStage, ReactNode> = {
  processing: "Processing",
  printing: "Printing your receipt",
  complete: "Done",
};

function useReceiptPrinter(component: string) {
  const ctx = useContext(ReceiptPrinterContext);
  if (!ctx) throw new Error(`${component} must be used inside ReceiptPrinter.Root.`);
  return ctx;
}

function Root({
  "aria-label": ariaLabel = "Receipt printer",
  animate = true,
  children,
  className,
  feedMotion = "stepped",
  labels,
  stage,
  ...props
}: RootProps) {
  const shouldReduceMotion = useReducedMotion();
  const ctx: Ctx = {
    animate,
    feedMotion,
    labels: { ...DEFAULT_LABELS, ...labels },
    shouldMove: animate && !shouldReduceMotion,
    stage,
  };
  return (
    <ReceiptPrinterContext.Provider value={ctx}>
      <section
        aria-label={ariaLabel}
        className={cn("relative isolate flex w-full max-w-sm flex-col items-center", className)}
        data-stage={stage}
        {...props}
      >
        {children}
      </section>
    </ReceiptPrinterContext.Provider>
  );
}

function Machine({ children, className, ...props }: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn(
        "relative isolate w-full overflow-hidden rounded-[var(--printer-radius)] p-[var(--printer-inset)] pb-8",
        "[--printer-inner-radius:calc(var(--printer-radius)_-_var(--printer-inset))] [--printer-inset:0.75rem] [--printer-radius:1.5rem]",
        // Teal-graphite body with a lit top edge and a shadowed bottom edge.
        "border border-[oklch(0.17_0.02_168)] bg-[oklch(0.25_0.025_168)]",
        "shadow-[0_20px_36px_-20px_oklch(0.2_0.03_168/0.55),0_6px_14px_-8px_oklch(0.2_0.03_168/0.24),inset_0_1px_0_oklch(1_0_0/0.12),inset_0_-1px_0_oklch(0_0_0/0.45)]",
        "dark:border-[oklch(0.3_0.02_168)] dark:shadow-[0_20px_36px_-20px_oklch(0_0_0/0.8),0_6px_14px_-8px_oklch(0_0_0/0.5),inset_0_1px_0_oklch(1_0_0/0.1),inset_0_-1px_0_oklch(0_0_0/0.5)]",
        // Moulded-plastic grain.
        "before:pointer-events-none before:absolute before:inset-0 before:z-0 before:rounded-[inherit] before:bg-[url('/textures/plastic-noise.svg')] before:bg-[length:180px_180px] before:bg-repeat before:opacity-25 before:mix-blend-overlay before:content-['']",
        className,
      )}
      {...props}
    >
      {children}
      {/* Paper slot */}
      <div
        aria-hidden="true"
        className="absolute inset-x-6 bottom-[var(--printer-inset)] z-40 h-2 rounded-[0.25rem] border border-[oklch(0.1_0.01_168)] bg-[oklch(0.1_0.01_168)] shadow-inner shadow-black"
      />
    </div>
  );
}

function Header({ children, className, ...props }: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn("relative z-10 flex h-11 items-start justify-between", className)}
      {...props}
    >
      {children}
    </div>
  );
}

function Screen({ children, className, ...props }: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn(
        // Dark LCD with Syncly-teal readout and an inner vignette.
        "relative isolate z-10 overflow-hidden rounded-[var(--printer-inner-radius)] border border-[oklch(0.1_0.01_168)] bg-[oklch(0.13_0.02_168)] p-4 text-[oklch(0.84_0.12_168)] shadow-inner shadow-black/80",
        "[text-shadow:0_0_10px_oklch(0.72_0.11_168/0.45)]",
        "after:pointer-events-none after:absolute after:inset-0 after:z-20 after:rounded-[inherit] after:shadow-[inset_0_0_24px_4px_oklch(0.08_0.01_168/0.6)] after:content-['']",
        className,
      )}
      {...props}
    >
      <div className="relative z-10">{children}</div>
    </div>
  );
}

function StatusIndicator({
  animate,
  move,
  stage,
}: {
  animate: boolean;
  move: boolean;
  stage: ReceiptPrinterStage;
}) {
  const fade = {
    animate: { opacity: 1, transform: "scale(1)" },
    exit: { opacity: animate ? 0 : 1, transform: move ? "scale(0.96)" : "scale(1)" },
    initial: { opacity: animate ? 0 : 1, transform: move ? "scale(0.94)" : "scale(1)" },
    transition: { duration: animate ? 0.16 : 0, ease: easeOut },
  };
  return (
    <span aria-hidden="true" className="relative grid size-5 shrink-0 place-items-center">
      <AnimatePresence initial={false} mode="sync">
        {stage === "complete" ? (
          <motion.span
            key="complete"
            {...fade}
            className="col-start-1 row-start-1 grid place-items-center text-[oklch(0.8_0.15_155)]"
          >
            <CircleCheck className="size-[18px]" strokeWidth={2.5} />
          </motion.span>
        ) : (
          <motion.span
            key="working"
            {...fade}
            className="col-start-1 row-start-1 grid place-items-center text-[oklch(0.62_0.03_168)]"
          >
            <LoaderCircle
              className={cn("size-[18px]", animate && "animate-spin motion-reduce:animate-none")}
              strokeWidth={2.5}
            />
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

function Status({ children, className, ...props }: StatusProps) {
  const { animate, labels, shouldMove, stage } = useReceiptPrinter("ReceiptPrinter.Status");
  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)} {...props}>
      <StatusIndicator animate={animate} move={shouldMove} stage={stage} />
      <div aria-live="polite" role="status" className="grid min-w-0 flex-1 items-center">
        <AnimatePresence initial={false} mode="sync">
          <motion.div
            key={stage}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            exit={{
              opacity: animate ? 0 : 1,
              transform: shouldMove ? "translateY(-4px)" : "translateY(0px)",
            }}
            initial={{
              opacity: animate ? 0 : 1,
              transform: shouldMove ? "translateY(4px)" : "translateY(0px)",
            }}
            transition={{ duration: animate ? 0.18 : 0, ease: easeOut }}
            className="col-start-1 row-start-1 truncate text-xs font-medium leading-none text-[oklch(0.78_0.03_168)]"
          >
            {children ?? labels[stage]}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function Paper({ children, className, style, ...props }: ComponentPropsWithoutRef<"article">) {
  return (
    <article
      className={cn(
        // Warm Syncly paper with ink in the app's foreground tone.
        "relative z-10 min-h-80 bg-[oklch(0.985_0.006_95)] bg-[url('/textures/receipt-paper.svg')] bg-cover px-6 pb-8 pt-7 font-mono text-[oklch(0.22_0.012_70)] bg-blend-multiply",
        "dark:bg-[oklch(0.93_0.008_95)]",
        className,
      )}
      style={{ clipPath: receiptClipPath, ...style }}
      {...props}
    >
      {children}
    </article>
  );
}

function Output({ children, className, ...props }: ComponentPropsWithoutRef<"div">) {
  const { animate, feedMotion, shouldMove, stage } = useReceiptPrinter("ReceiptPrinter.Output");
  const visible = stage !== "processing";
  const stepped = feedMotion === "stepped" && stage === "printing" && shouldMove;

  return (
    <div
      className={cn(
        "relative z-50 -mt-4 h-[32rem] w-[calc(80%+3rem)] max-w-full overflow-hidden px-6",
        className,
      )}
      {...props}
    >
      {visible ? (
        // Shadow cast by the slot onto the paper as it comes out.
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-6 -top-1 z-20 h-2 bg-[oklch(0.1_0.01_168/0.75)] blur-[6px]"
        />
      ) : null}
      <motion.div
        initial={false}
        aria-hidden={stage !== "complete"}
        animate={{
          opacity: visible ? 1 : 0,
          transform:
            stage === "printing" && shouldMove
              ? stepped
                ? steppedFeed
                : "translateY(0%)"
              : visible || !shouldMove
                ? "translateY(0%)"
                : "translateY(calc(-100% + 2px))",
        }}
        transition={{
          opacity: { duration: animate ? 0.16 : 0, ease: easeOut },
          transform: {
            duration: shouldMove ? RECEIPT_FEED_MS / 1000 : 0,
            ease: stepped ? "linear" : easeInOut,
            times: stepped ? steppedFeedTimes : undefined,
          },
        }}
        className="relative isolate before:pointer-events-none before:absolute before:inset-x-3 before:bottom-4 before:top-3 before:z-0 before:rounded-sm before:shadow-[0_8px_24px_oklch(0.2_0.03_168/0.22)] before:content-[''] after:pointer-events-none after:absolute after:bottom-0 after:left-[8%] after:right-[8%] after:z-0 after:h-3 after:translate-y-1.5 after:rounded-full after:bg-[oklch(0.2_0.03_168/0.1)] after:blur-lg after:content-[''] dark:before:shadow-[0_8px_24px_oklch(0_0_0/0.5)]"
      >
        {children}
      </motion.div>
    </div>
  );
}

export const ReceiptPrinter = { Header, Machine, Output, Paper, Root, Screen, Status };
