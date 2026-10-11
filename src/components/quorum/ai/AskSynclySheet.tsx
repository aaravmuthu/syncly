import { useEffect, useState } from "react";
import { ASK_EVENT } from "./ask-event";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { toast } from "@/lib/quorum/toast";
import { Button, Card, Pill } from "@/components/quorum/ui";
import {
  askSyncly,
  type ConciergeTurn,
  type SynclyAction,
  type SynclyPlanRef,
} from "@/lib/quorum/aiplus.functions";
import { openPlanBuilder } from "./plan-builder-event";
import { recentAiHistory } from "@/lib/quorum/ai-chat";
import { ChatSheetShell } from "./ChatSheetShell";
import { AiGlyph } from "./AiGlyph";

const STARTERS = [
  "What's happening across my groups this week?",
  "What needs my answer right now?",
  "Plan a movie night with my squad this weekend",
];

type Turn = ConciergeTurn & {
  planRef?: SynclyPlanRef;
  action?: SynclyAction;
};

/**
 * Site-wide AI entry point, reachable from every page (mounted in AppShell's
 * header). Unlike Plan Concierge, this sees a summary across every group the
 * member is in, not one plan. Same propose-then-confirm contract as the
 * concierge's actions: Ask Syncly only ever proposes a group + a restated
 * request via create_plan; nothing is created until the member taps "Build
 * it with Sync", reviews the itinerary in the plan builder, and launches it
 * there themselves.
 */
export function AskSynclySheet({ trigger = "icon" }: { trigger?: "icon" | "menu" }) {
  const [open, setOpen] = useState(false);
  // Only the always-mounted header instance listens, so one event opens
  // exactly one sheet (the overflow-menu copy only exists while it's open).
  useEffect(() => {
    if (trigger !== "icon") return;
    const onAsk = () => setOpen(true);
    window.addEventListener(ASK_EVENT, onAsk);
    return () => window.removeEventListener(ASK_EVENT, onAsk);
  }, [trigger]);
  const [turns, setTurns] = useState<Turn[]>([]);

  const [failedQuestion, setFailedQuestion] = useState<string | null>(null);
  const askFn = useServerFn(askSyncly);
  const ask = useMutation({
    mutationFn: (question: string) =>
      askFn({ data: { question, history: recentAiHistory(turns) } }),
    onSuccess: (r) =>
      setTurns((prev) => [
        ...prev,
        { role: "assistant", content: r.answer, planRef: r.planRef, action: r.action },
      ]),
    onError: (e: unknown, question: string) => {
      setFailedQuestion(question);
      toast.error("Ask Syncly couldn't answer", {
        description: e instanceof Error ? e.message : "Please try again.",
      });
    },
  });

  const buildPlan = (action: SynclyAction) => {
    setOpen(false);
    openPlanBuilder({ prompt: action.prompt, groupId: action.groupId, autoStart: true });
  };

  const send = (text: string) => {
    setFailedQuestion(null);
    setTurns((prev) => [...prev, { role: "user", content: text }]);
    ask.mutate(text);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ask Syncly"
        className={
          trigger === "menu"
            ? "relative flex min-h-11 w-full cursor-default select-none items-center gap-2 rounded-xl px-2 py-2.5 text-sm outline-none transition-colors hover:bg-secondary focus:bg-secondary"
            : "tap-target pressable active:pressable-active inline-flex items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        }
      >
        <Sparkles className="size-5" aria-hidden />
        {trigger === "menu" ? <span>Ask Syncly</span> : null}
      </button>

      <ChatSheetShell
        open={open}
        onClose={() => setOpen(false)}
        title="Ask Syncly"
        description="Everything across your groups, in one place"
        emptyHint="Ask about anything across your groups — what's coming up, what needs you, or ask it to plan something new."
        starters={STARTERS}
        turns={turns}
        pending={ask.isPending}
        pendingState="searching"
        pendingLabel="Looking through your squads…"
        onSend={send}
        errorMessage={
          failedQuestion ? "The question could not be answered. You can retry it." : undefined
        }
        onRetry={
          failedQuestion
            ? () => {
                const question = failedQuestion;
                setFailedQuestion(null);
                ask.mutate(question);
              }
            : undefined
        }
        renderTurnExtra={(t) => {
          if (t.action?.type === "create_plan") {
            return (
              <Card className="mr-auto mt-2 max-w-[90%] border-primary/40 bg-primary/5 p-3">
                <Pill tone="accent" className="gap-1.5">
                  <AiGlyph className="size-3.5" /> Suggested plan
                </Pill>
                <p className="mt-2 text-sm font-medium">{actionLabel(t.action)}</p>
                <Button className="mt-2 h-9 px-3 text-xs" onClick={() => buildPlan(t.action!)}>
                  Build it with Sync
                </Button>
              </Card>
            );
          }
          return t.planRef ? (
            <Link
              to="/plans/$planId"
              params={{ planId: t.planRef.planId }}
              onClick={() => setOpen(false)}
              className="mr-auto mt-1.5 inline-flex max-w-[90%] items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
            >
              View {t.planRef.title} →
            </Link>
          ) : null;
        }}
      />
    </>
  );
}

function actionLabel(action: SynclyAction): string {
  return `"${action.prompt}" in ${action.groupName}`;
}
