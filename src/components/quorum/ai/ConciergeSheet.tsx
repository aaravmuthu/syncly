import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "motion/react";
import { Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/quorum/Modal";
import { Button, Spinner } from "@/components/quorum/ui";
import { askPlanConcierge, type ConciergeTurn } from "@/lib/quorum/aiplus.functions";

const STARTERS = [
  "Which option works best for everyone?",
  "What will this cost each of us?",
  "What time should we actually meet?",
  "Any backup if the weather turns?",
];

/**
 * Plan concierge: a conversational assistant that answers questions about one
 * plan using group-safe facts only (no member's private answers).
 */
export function ConciergeSheet({ planId, planTitle }: { planId: string; planTitle: string }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<ConciergeTurn[]>([]);
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const askFn = useServerFn(askPlanConcierge);
  const ask = useMutation({
    mutationFn: (question: string) => askFn({ data: { planId, question, history: turns } }),
    onSuccess: (r: { answer: string }) =>
      setTurns((prev) => [...prev, { role: "assistant", content: r.answer }]),
    onError: (e: unknown) => {
      setTurns((prev) => prev.slice(0, -1));
      toast.error("The concierge couldn't answer", {
        description: e instanceof Error ? e.message : "Please try again.",
      });
    },
  });

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [turns, ask.isPending]);

  const send = (text: string) => {
    const q = text.trim();
    if (!q || ask.isPending) return;
    setTurns((prev) => [...prev, { role: "user", content: q }]);
    setInput("");
    ask.mutate(q);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const trigger = (
    <motion.button
      type="button"
      onClick={() => setOpen(true)}
      whileHover={{ scale: 1.04, y: -2 }}
      whileTap={{ scale: 0.94 }}
      transition={{ type: "spring", stiffness: 420, damping: 26 }}
      className="fixed bottom-24 left-4 z-[60] inline-flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg"
    >
      <Sparkles className="h-4 w-4" aria-hidden />
      Ask AI
    </motion.button>
  );

  return (
    <>
      {/* Portaled to <body>: route content sits inside PageTransition's animated
          wrapper, whose transform/will-change makes it the containing block for
          position:fixed descendants. */}
      {mounted ? createPortal(trigger, document.body) : null}


      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Plan concierge"
        description={planTitle}
      >
        <div ref={scroller} className="max-h-[46dvh] space-y-3 overflow-y-auto pr-1">
          {turns.length === 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Ask anything about this plan — options, cost, timing or backups.
              </p>
              <div className="flex flex-wrap gap-2">
                {STARTERS.map((s) => (
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
            </div>
          ) : null}

          <AnimatePresence initial={false}>
            {turns.map((t, i) => (
              <motion.div
                key={`${i}-${t.role}`}
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 360, damping: 28 }}
                className={
                  t.role === "user"
                    ? "ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-sm text-primary-foreground"
                    : "mr-auto max-w-[90%] rounded-2xl rounded-bl-md border border-border bg-secondary/60 px-3.5 py-2.5 text-sm"
                }
              >
                <MessageBody text={t.content} />
              </motion.div>
            ))}
          </AnimatePresence>

          {ask.isPending ? (
            <div className="mr-auto inline-flex items-center gap-2 rounded-2xl border border-border px-3.5 py-2.5 text-sm text-muted-foreground">
              <Spinner className="h-3.5 w-3.5" /> Thinking…
            </div>
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
            placeholder="Ask the concierge…"
            aria-label="Ask the plan concierge"
            className="h-11 flex-1 rounded-2xl border border-border bg-background px-3.5 text-sm outline-none focus:border-primary/60"
          />
          <Button type="submit" disabled={!input.trim() || ask.isPending} className="h-11 px-4">
            <Send className="h-4 w-4" aria-hidden />
          </Button>
        </form>
      </Modal>
    </>
  );
}

/** Renders the model's light markdown (bullets + bold) without a dependency. */
function MessageBody({ text }: { text: string }) {
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
