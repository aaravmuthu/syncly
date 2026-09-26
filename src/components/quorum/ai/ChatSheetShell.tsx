import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Send } from "lucide-react";
import { Modal } from "@/components/quorum/Modal";
import { Button } from "@/components/quorum/ui";
import { AiActivity } from "./AiActivity";

export type BaseTurn = { role: "user" | "assistant"; content: string };

/**
 * Shared chat sheet chrome (Modal + scrollback + bubbles + starter chips +
 * input row) used by every AI chat surface (Plan Concierge, Ask Syncly).
 * Callers own their own turn state/mutation and pass an optional
 * `renderTurnExtra` slot for turn-specific content, like an action-confirm
 * card under an assistant reply.
 */
export function ChatSheetShell<T extends BaseTurn>({
  open,
  onClose,
  title,
  description,
  emptyHint,
  starters,
  turns,
  pending,
  onSend,
  renderTurnExtra,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  emptyHint: string;
  starters?: string[];
  turns: T[];
  pending: boolean;
  onSend: (text: string) => void;
  renderTurnExtra?: (turn: T, index: number) => ReactNode;
}) {
  const [input, setInput] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [turns, pending]);

  const send = (text: string) => {
    const q = text.trim();
    if (!q || pending) return;
    setInput("");
    onSend(q);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  return (
    <Modal open={open} onClose={onClose} title={title} description={description}>
      <div ref={scroller} className="max-h-[46dvh] space-y-3 overflow-y-auto pr-1">
        {turns.length === 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{emptyHint}</p>
            {starters?.length ? (
              <div className="flex flex-wrap gap-2">
                {starters.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary"
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <AnimatePresence initial={false}>
          {turns.map((t, i) => (
            <motion.div
              key={`${i}-${t.role}`}
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 360, damping: 28 }}
            >
              <div
                className={
                  t.role === "user"
                    ? "ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-sm text-primary-foreground"
                    : "mr-auto max-w-[90%] rounded-2xl rounded-bl-md border border-border bg-secondary/60 px-3.5 py-2.5 text-sm"
                }
              >
                <MessageBody text={t.content} />
              </div>
              {renderTurnExtra ? renderTurnExtra(t, i) : null}
            </motion.div>
          ))}
        </AnimatePresence>

        {pending ? (
          <AiActivity
            state="solving"
            label="Thinking…"
            className="mr-auto w-fit rounded-2xl border border-border px-3.5 py-2.5"
          />
        ) : null}
      </div>

      <form
        className="mt-4 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message…"
          aria-label={title}
          className="h-11 flex-1 rounded-2xl border border-border bg-background px-3.5 outline-none focus:border-primary/60"
        />
        <Button type="submit" disabled={!input.trim() || pending} className="h-11 px-4">
          <Send className="h-4 w-4" aria-hidden />
        </Button>
      </form>
    </Modal>
  );
}

/** Renders the model's light markdown (bullets + bold) without a dependency. */
export function MessageBody({ text }: { text: string }) {
  const lines = text.split("\n").filter((l) => l.trim().length);
  return (
    <div className="space-y-1.5 leading-relaxed">
      {lines.map((line, i) => {
        const bullet = /^\s*([-*•]|\d+\.)\s+/.test(line);
        const clean = line.replace(/^\s*([-*•]|\d+\.)\s+/, "").replace(/\*\*/g, "");
        return bullet ? (
          <p key={i} className="flex gap-2">
            <span aria-hidden className="text-primary">
              •
            </span>
            <span>{clean}</span>
          </p>
        ) : (
          <p key={i}>{clean}</p>
        );
      })}
    </div>
  );
}
