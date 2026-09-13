import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Pill } from "@/components/quorum/ui";
import {
  askSyncly,
  type ConciergeTurn,
  type SynclyAction,
  type SynclyPlanRef,
} from "@/lib/quorum/aiplus.functions";
import { launchAiPlan } from "@/lib/quorum/planner.functions";
import { ChatSheetShell } from "./ChatSheetShell";

const STARTERS = [
  "What's happening across my groups this week?",
  "What needs my answer right now?",
  "Plan a movie night with my squad this weekend",
];

type LaunchedPlan = { planId: string; title: string };
type Turn = ConciergeTurn & { planRef?: SynclyPlanRef; action?: SynclyAction; launched?: LaunchedPlan };

/**
 * Site-wide AI entry point, reachable from every page (mounted in AppShell's
 * header). Unlike Plan Concierge, this sees a summary across every group the
 * member is in, not one plan. Same propose-then-confirm contract as the
 * concierge's actions: Ask Syncly only ever proposes a group + a restated
 * request via create_plan; nothing is created until an explicit tap here
 * calls the same already-authorized launchAiPlan a manual "Launch Plan"
 * button would.
 */
export function AskSynclySheet({ trigger = "icon" }: { trigger?: "icon" | "menu" }) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const qc = useQueryClient();

  const askFn = useServerFn(askSyncly);
  const ask = useMutation({
    mutationFn: (question: string) => askFn({ data: { question, history: turns } }),
    onSuccess: (r) =>
      setTurns((prev) => [
        ...prev,
        { role: "assistant", content: r.answer, planRef: r.planRef, action: r.action },
      ]),
    onError: (e: unknown) => {
      setTurns((prev) => prev.slice(0, -1));
      toast.error("Ask Syncly couldn't answer", {
        description: e instanceof Error ? e.message : "Please try again.",
      });
    },
  });

  const runLaunch = useServerFn(launchAiPlan);
  const [launchingAt, setLaunchingAt] = useState<number | null>(null);

  const confirmCreatePlan = async (index: number, action: SynclyAction) => {
    setLaunchingAt(index);
    try {
      const result = (await runLaunch({ data: { groupId: action.groupId, prompt: action.prompt } })) as {
        planId: string;
        title: string;
        optionCount: number;
      };
      toast.success("Plan launched", {
        description: result.optionCount
          ? `${result.optionCount} fair-point options ready in ${action.groupName}.`
          : `Created in ${action.groupName} — everyone answers privately next.`,
      });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["group", action.groupId] });
      setTurns((prev) =>
        prev.map((t, i) =>
          i === index ? { ...t, launched: { planId: result.planId, title: result.title } } : t,
        ),
      );
    } catch (e) {
      toast.error("Couldn't launch that plan", {
        description: e instanceof Error ? e.message : "Try rephrasing it.",
      });
    } finally {
      setLaunchingAt(null);
    }
  };

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
        className={
          trigger === "menu"
            ? "relative flex min-h-11 w-full cursor-default select-none items-center gap-2 rounded-xl px-2 py-2.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
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
        onSend={send}
        renderTurnExtra={(t, i) => {
          if (t.launched) {
            return (
              <Link
                to="/plans/$planId"
                params={{ planId: t.launched.planId }}
                onClick={() => setOpen(false)}
                className="mr-auto mt-1.5 inline-flex max-w-[90%] items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
              >
                View {t.launched.title} →
              </Link>
            );
          }
          if (t.action?.type === "create_plan") {
            return (
              <Card className="mr-auto mt-2 max-w-[90%] border-primary/40 bg-primary/5 p-3">
                <Pill tone="accent">💡 Suggested plan</Pill>
                <p className="mt-2 text-sm font-medium">{actionLabel(t.action)}</p>
                <Button
                  className="mt-2 h-9 px-3 text-xs"
                  loading={launchingAt === i}
                  onClick={() => confirmCreatePlan(i, t.action!)}
                >
                  Launch it in {t.action.groupName}
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
