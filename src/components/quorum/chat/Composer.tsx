import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE_OUT } from "./motion";

const MAX_HEIGHT = 128;

/**
 * iMessage-style composer: a rounded field that grows with the text, a send
 * arrow that scales in once there is something to send (and swaps with
 * `idleAction`, e.g. the mic, when there isn't), and Enter that sends on
 * desktop but inserts a newline on touch keyboards where the arrow is the
 * send control.
 */
export function ChatComposer({
  value,
  onChange,
  onSend,
  placeholder,
  leading,
  idleAction,
  top,
  onTyping,
  onFocusChange,
  textareaRef,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  placeholder: string;
  /** Round buttons to the left of the field (camera, location). */
  leading?: ReactNode;
  /** Shown in the send slot while the field is empty (mic). */
  idleAction?: ReactNode;
  /** Rendered above the field (reply preview, quick replies). */
  top?: ReactNode;
  onTyping?: () => void;
  onFocusChange?: (focused: boolean) => void;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
  className?: string;
}) {
  const innerRef = useRef<HTMLTextAreaElement | null>(null);
  const ref = textareaRef ?? innerRef;
  const [coarse, setCoarse] = useState(false);
  const canSend = value.trim().length > 0;
  const reduce = useReducedMotion();
  const pop = reduce ? "scale(1)" : "scale(0.85)";

  useEffect(() => {
    setCoarse(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  // Auto-grow: measure the natural height, clamp, scroll inside past the max.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT ? "auto" : "hidden";
  }, [value, ref]);

  return (
    <div
      className={cn(
        "border-t border-border/60 px-2.5 pb-[calc(env(safe-area-inset-bottom,0px)+0.625rem)] pt-2 focus-within:pb-2.5",
        className,
      )}
    >
      {top}
      <div className="flex items-end gap-1.5">
        {leading}
        <div className="flex min-h-11 flex-1 items-end gap-1 rounded-[1.375rem] border border-border bg-background/70 py-1 pl-3.5 pr-1 focus-within:border-primary/50">
          <textarea
            ref={ref}
            value={value}
            rows={1}
            placeholder={placeholder}
            aria-label={placeholder}
            enterKeyHint={coarse ? "enter" : "send"}
            onFocus={() => onFocusChange?.(true)}
            onBlur={() => onFocusChange?.(false)}
            onChange={(e) => {
              onChange(e.target.value);
              onTyping?.();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !coarse && !e.nativeEvent.isComposing) {
                e.preventDefault();
                if (canSend) onSend();
              }
            }}
            // No text-sm: the global 16px floor must win or iOS zooms on focus.
            className="max-h-32 min-h-9 flex-1 resize-none self-center bg-transparent py-1.5 text-foreground outline-none placeholder:text-muted-foreground"
          />
          <div className="relative grid size-9 shrink-0 place-items-center self-end">
            <AnimatePresence initial={false} mode="popLayout">
              {canSend ? (
                <motion.button
                  key="send"
                  type="button"
                  aria-label="Send"
                  // Keep the keyboard up: a tap on Send must not blur the field.
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={onSend}
                  initial={{ opacity: 0, transform: pop }}
                  animate={{ opacity: 1, transform: "scale(1)" }}
                  exit={{ opacity: 0, transform: pop, transition: { duration: 0.1 } }}
                  transition={{ duration: 0.14, ease: EASE_OUT }}
                  className="hit-slop transition-none grid size-8 place-items-center rounded-full bg-primary text-primary-foreground"
                >
                  <ArrowUp className="size-4" strokeWidth={2.5} aria-hidden />
                </motion.button>
              ) : idleAction ? (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12 }}
                >
                  {idleAction}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
