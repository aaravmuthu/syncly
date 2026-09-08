import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { askSyncly, type ConciergeTurn, type SynclyPlanRef } from "@/lib/quorum/aiplus.functions";
import { ChatSheetShell } from "./ChatSheetShell";

const STARTERS = [
  "What's happening across my groups this week?",
  "What needs my answer right now?",
  "What should my squad do next?",
];

type Turn = ConciergeTurn & { planRef?: SynclyPlanRef };

/**
 * Site-wide AI entry point, reachable from every page (mounted in AppShell's
 * header). Unlike Plan Concierge, this sees a summary across every group the
 * member is in, not one plan — same group-safe-facts rule, and its only
 * "action" is a plain navigation link, never a mutation.
 */
export function AskSynclySheet() {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);

  const askFn = useServerFn(askSyncly);
  const ask = useMutation({
    mutationFn: (question: string) => askFn({ data: { question, history: turns } }),
    onSuccess: (r) => setTurns((prev) => [...prev, { role: "assistant", content: r.answer, planRef: r.planRef }]),
    onError: (e: unknown) => {
      setTurns((prev) => prev.slice(0, -1));
      toast.error("Ask Syncly couldn't answer", {
        description: e instanceof Error ? e.message : "Please try again.",
      });
    },
  });

  const send = (text: string) => {
    setTurns((prev) => [...prev, { role: "user", content: text }]);
    ask.mutate(text);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ask Syncly"
        className="pressable active:pressable-active rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <Sparkles className="size-5" aria-hidden />
      </button>

      <ChatSheetShell
        open={open}
        onClose={() => setOpen(false)}
        title="Ask Syncly"
        description="Everything across your groups, in one place"
        emptyHint="Ask about anything across your groups — what's coming up, what needs you, what to plan next."
        starters={STARTERS}
        turns={turns}
        pending={ask.isPending}
        onSend={send}
        renderTurnExtra={(t) =>
          t.planRef ? (
            <Link
              to="/plans/$planId"
              params={{ planId: t.planRef.planId }}
              onClick={() => setOpen(false)}
              className="mr-auto mt-1.5 inline-flex max-w-[90%] items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
            >
              View {t.planRef.title} →
            </Link>
          ) : null
        }
      />
    </>
  );
}
