import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDown, MessageCircle, WifiOff } from "lucide-react";
import { Button, Skeleton } from "@/components/quorum/ui";
import { cn } from "@/lib/utils";
import { useRise } from "./motion";

/** Centered, quiet time header between clusters ("Yesterday 3:42 PM"). */
export function TimeHeader({ label }: { label: string }) {
  return (
    <p className="mt-5 text-center text-caption font-medium text-muted-foreground first:mt-1">
      {label}
    </p>
  );
}

/** Centered system line ("Sam joined", "Renamed the squad to …"). */
export function SystemNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "mx-auto mt-3 max-w-[85%] text-center text-caption text-muted-foreground",
        className,
      )}
    >
      {children}
    </p>
  );
}

/** Three-dot typing bubble that eases in and out instead of popping. */
export function TypingBubble({ label, avatar }: { label?: string; avatar?: ReactNode }) {
  const rise = useRise(6, 0.16);
  return (
    <motion.div {...rise} className="mt-2 flex items-end gap-2" role="status" aria-label={label}>
      {avatar}
      <div className="chat-bubble flex h-9 items-center gap-1 rounded-[1.25rem] rounded-bl-[0.25rem] px-3.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1.5 animate-typing-dot rounded-full bg-muted-foreground"
            style={{ animationDelay: `${i * 120}ms` }}
          />
        ))}
      </div>
    </motion.div>
  );
}

/** Pill that appears when the reader has scrolled away from the newest message. */
export function JumpToLatest({
  show,
  unseen,
  onClick,
}: {
  show: boolean;
  unseen: number;
  onClick: () => void;
}) {
  const rise = useRise(8, 0.16);
  return (
    <AnimatePresence>
      {show ? (
        <motion.button
          {...rise}
          type="button"
          onClick={onClick}
          aria-label={unseen > 0 ? `Jump to latest, ${unseen} new` : "Jump to latest"}
          className="tap-target absolute bottom-3 right-3 z-10 inline-flex items-center gap-1.5 rounded-full border border-border bg-popover/90 px-3 text-caption font-semibold text-foreground shadow-lg backdrop-blur-xl"
        >
          <ArrowDown className="size-3.5" aria-hidden />
          {unseen > 0 ? `${unseen} new` : "Latest"}
        </motion.button>
      ) : null}
    </AnimatePresence>
  );
}

/** Loading placeholder shaped like a conversation, alternating sides. */
export function ThreadSkeleton() {
  const rows: [boolean, string][] = [
    [false, "w-1/2"],
    [false, "w-2/5"],
    [true, "w-3/5"],
    [false, "w-[45%]"],
    [true, "w-1/3"],
    [true, "w-1/2"],
  ];
  return (
    <div className="space-y-1.5" aria-hidden>
      {rows.map(([mine, w], i) => (
        <Skeleton key={i} className={cn("h-9 rounded-[1.25rem]", w, mine && "ml-auto")} />
      ))}
    </div>
  );
}

/** First-message prompt. */
export function ThreadEmpty({ title, body }: { title: string; body: string }) {
  return (
    <div className="grid place-items-center gap-1 px-8 py-16 text-center">
      <span className="mb-2 grid size-12 place-items-center rounded-full bg-secondary text-muted-foreground">
        <MessageCircle className="size-5" aria-hidden />
      </span>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="max-w-xs text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

/** Failed load. Never shown as an empty thread. */
export function ThreadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="grid place-items-center gap-1 px-8 py-16 text-center">
      <span className="mb-2 grid size-12 place-items-center rounded-full bg-secondary text-muted-foreground">
        <WifiOff className="size-5" aria-hidden />
      </span>
      <p className="text-sm font-semibold text-foreground">Couldn't load this chat</p>
      <p className="max-w-xs text-sm text-muted-foreground">
        Check your connection and try again. Your messages are safe.
      </p>
      <Button className="mt-3" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
