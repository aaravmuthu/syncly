import { useCallback, useRef, useState, type ReactNode } from "react";
import {
  AnimatePresence,
  motion,
  useDragControls,
  useReducedMotion,
  useMotionValue,
  useMotionValueEvent,
  useTransform,
} from "motion/react";
import { createPortal } from "react-dom";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Reply } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/quorum/haptics";
import { EASE_OUT, SETTLE } from "./motion";
import { useLongPress } from "./useLongPress";
import type { ClusterPos } from "./layout";

/** Drag distance that commits a reply. */
const REPLY_AT = 56;

/**
 * Swipe a row right to reply. The finger owns the row 1:1 (rubber-banding
 * past the commit point, nothing to the left); on release it springs home
 * carrying the release velocity. Mouse users reply from the menu instead, so
 * text selection by dragging keeps working.
 */
export function SwipeRow({
  onReply,
  className,
  children,
}: {
  onReply?: () => void;
  className?: string;
  children: ReactNode;
}) {
  const controls = useDragControls();
  const x = useMotionValue(0);
  const iconOpacity = useTransform(x, [0, 20, REPLY_AT], [0, 0.35, 1]);
  const iconScale = useTransform(x, [0, REPLY_AT], [0.6, 1]);
  const crossed = useRef(false);
  const dragged = useRef(false);

  useMotionValueEvent(x, "change", (v) => {
    if (v >= REPLY_AT && !crossed.current) {
      crossed.current = true;
      haptic("tap");
    } else if (v < REPLY_AT - 8) {
      crossed.current = false;
    }
  });

  if (!onReply) return <div className={className}>{children}</div>;

  return (
    <div className={cn("relative", className)}>
      <motion.span
        aria-hidden
        style={{ opacity: iconOpacity, scale: iconScale }}
        className="pointer-events-none absolute left-0 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full bg-secondary text-muted-foreground"
      >
        <Reply className="size-3.5" />
      </motion.span>
      <motion.div
        drag="x"
        dragListener={false}
        dragControls={controls}
        dragDirectionLock
        dragConstraints={{ left: 0, right: REPLY_AT * 1.5 }}
        dragElastic={{ left: 0, right: 0.25 }}
        dragSnapToOrigin
        dragTransition={SETTLE}
        style={{ x, touchAction: "pan-y" }}
        onPointerDown={(e) => {
          if (e.pointerType === "mouse") return;
          if ((e.target as HTMLElement).closest("audio,a,[data-no-swipe]")) return;
          controls.start(e);
        }}
        onDragStart={() => {
          dragged.current = true;
        }}
        onDragEnd={(_, info) => {
          // Judge by where the row actually is (what the icon and haptic show),
          // not by raw finger travel.
          const shown = x.get();
          if (shown >= REPLY_AT || (shown > 24 && info.velocity.x > 500)) {
            haptic("select");
            onReply();
          }
          // The click that follows a drag must not toggle anything.
          setTimeout(() => {
            dragged.current = false;
          }, 0);
        }}
        onClickCapture={(e) => {
          if (dragged.current) e.stopPropagation();
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}

export type MenuAction = {
  key: string;
  label: string;
  icon: ReactNode;
  onSelect: () => void;
  destructive?: boolean;
};

/**
 * The bubble: colour, joined corners, tail, long-press / right-click menu.
 * Not a <button> — the text has to stay copyable and the bubble can hold
 * interactive media (audio) — so it is a focusable group that opens the menu
 * on Enter/Space too.
 */
export function BubbleSurface({
  mine,
  pos,
  status,
  actions,
  reactionEmojis,
  myReactions,
  onReact,
  onTap,
  className,
  children,
}: {
  mine: boolean;
  pos: ClusterPos;
  status?: "sending" | "failed";
  actions: MenuAction[];
  reactionEmojis?: string[];
  myReactions?: Set<string>;
  onReact?: (emoji: string) => void;
  onTap?: () => void;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const longPress = useLongPress(
    useCallback(() => {
      haptic("select");
      setOpen(true);
    }, []),
  );

  const tail = pos === "single" || pos === "last";
  const joinPrev = pos === "middle" || pos === "last";
  const joinNext = pos === "first" || pos === "middle";

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Anchor asChild>
        <div
          {...longPress.handlers}
          role="group"
          tabIndex={0}
          aria-haspopup="menu"
          data-mine={mine}
          data-tail={tail}
          onClick={() => {
            if (!longPress.justFired()) onTap?.();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " " || (e.shiftKey && e.key === "F10")) {
              e.preventDefault();
              setOpen(true);
            }
          }}
          className={cn(
            "chat-bubble w-fit max-w-full whitespace-pre-wrap break-words px-3.5 py-2 text-[0.9375rem] leading-[1.35] transition-[transform,opacity] duration-150 ease-out",
            open && "scale-[1.02]",
            status === "sending" && "opacity-70",
            status === "failed" && "opacity-60",
            mine
              ? cn(
                  "rounded-[1.25rem]",
                  joinPrev && "rounded-tr-[0.375rem]",
                  joinNext && "rounded-br-[0.375rem]",
                  tail && "rounded-br-[0.25rem]",
                )
              : cn(
                  "rounded-[1.25rem]",
                  joinPrev && "rounded-tl-[0.375rem]",
                  joinNext && "rounded-bl-[0.375rem]",
                  tail && "rounded-bl-[0.25rem]",
                ),
            onTap && "cursor-pointer",
            className,
          )}
        >
          {children}
        </div>
      </PopoverPrimitive.Anchor>

      {/* Its own portal: PopoverPortal is asChild and takes exactly one child. */}
      {open
        ? createPortal(
            <div aria-hidden className="fade-in fixed inset-0 z-[60] bg-black/20" />,
            document.body,
          )
        : null}
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side="top"
          align={mine ? "end" : "start"}
          sideOffset={8}
          collisionPadding={12}
          onCloseAutoFocus={(e) => e.preventDefault()}
          className={cn(
            "chat-menu z-[61] flex flex-col gap-1.5 outline-none",
            mine ? "items-end" : "items-start",
          )}
        >
          {reactionEmojis && onReact ? (
            <div
              role="group"
              aria-label="React"
              className="flex items-center gap-0.5 rounded-full border border-border bg-popover p-1 shadow-xl"
            >
              {reactionEmojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  aria-pressed={myReactions?.has(emoji) ?? false}
                  onClick={() => {
                    setOpen(false);
                    onReact(emoji);
                  }}
                  className={cn(
                    "tap-target grid size-11 place-items-center rounded-full text-[1.375rem] leading-none transition-colors",
                    myReactions?.has(emoji) ? "bg-primary/20" : "active:bg-foreground/10",
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          ) : null}
          <div
            role="menu"
            className="min-w-48 overflow-hidden rounded-2xl border border-border bg-popover shadow-xl"
          >
            {actions.map((a) => (
              <button
                key={a.key}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  a.onSelect();
                }}
                className={cn(
                  "tap-target flex w-full items-center justify-between gap-6 border-b border-border/60 px-4 text-left text-[0.9375rem] last:border-b-0 active:bg-foreground/10",
                  a.destructive && "text-destructive",
                )}
              >
                {a.label}
                <span className="text-muted-foreground" aria-hidden>
                  {a.icon}
                </span>
              </button>
            ))}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

/** Emoji reaction counts under a bubble; each chip pops in when it appears. */
export function ReactionChips({
  counts,
  mine,
  myReactions,
  onToggle,
}: {
  counts: [string, number][];
  mine: boolean;
  myReactions: Set<string>;
  onToggle: (emoji: string) => void;
}) {
  const reduce = useReducedMotion();
  const from = reduce ? "scale(1)" : "scale(0.8)";
  if (counts.length === 0) return null;
  return (
    <div className={cn("mt-1 flex flex-wrap gap-1 px-1", mine && "justify-end")}>
      <AnimatePresence initial={false}>
        {counts.map(([emoji, n]) => (
          <motion.button
            key={emoji}
            type="button"
            layout={reduce ? false : "position"}
            initial={{ opacity: 0, transform: from }}
            animate={{ opacity: 1, transform: "scale(1)" }}
            exit={{ opacity: 0, transform: from }}
            transition={{ duration: 0.16, ease: EASE_OUT }}
            onClick={() => onToggle(emoji)}
            aria-pressed={myReactions.has(emoji)}
            className={cn(
              "transition-none rounded-full border px-2 py-0.5 text-caption leading-tight",
              myReactions.has(emoji)
                ? "border-primary/50 bg-primary/15 text-primary"
                : "border-border bg-secondary/60 text-muted-foreground",
            )}
          >
            {emoji}
            {n > 1 ? <span className="ml-1">{n}</span> : null}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}

/**
 * Collapses to nothing and opens with a height transition. Used for the
 * tap-to-reveal timestamp: the one place height animation is the honest tool
 * (the row below has to make room), so it is a grid-rows transition.
 */
export function RevealRow({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none",
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
      )}
    >
      <div className="overflow-hidden" aria-hidden={!open}>
        {children}
      </div>
    </div>
  );
}
