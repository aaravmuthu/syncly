import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Button, Card, Pill } from "@/components/quorum/ui";
import {
  askPlanConcierge,
  type ConciergeAction,
  type ConciergeTurn,
} from "@/lib/quorum/aiplus.functions";
import { castVote } from "@/lib/quorum/plan.functions";
import { applyAiCompromise } from "@/lib/quorum/ai.functions";
import { sendMessage } from "@/lib/quorum/chat.functions";
import { ChatSheetShell } from "./ChatSheetShell";
import { AiGlyph } from "./AiGlyph";

const STARTERS = [
  "Which option works best for everyone?",
  "What will this cost each of us?",
  "What time should we actually meet?",
  "Vote for the top option for me",
];

type Turn = ConciergeTurn & { action?: ConciergeAction; taken?: boolean };

/**
 * Plan concierge: a conversational assistant that answers questions about one
 * plan using group-safe facts only (no member's private answers), and can
 * propose one action per reply (vote, retime, lock in an option, nudge the
 * group chat). The model only ever proposes -- an explicit tap here is what
 * actually calls the same authorized mutation a manual button press would.
 */
export function ConciergeSheet({
  planId,
  planTitle,
  groupId,
  isHost,
}: {
  planId: string;
  planTitle: string;
  groupId: string;
  isHost: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const qc = useQueryClient();
  const askFn = useServerFn(askPlanConcierge);
  const ask = useMutation({
    mutationFn: (question: string) => askFn({ data: { planId, question, history: turns } }),
    onSuccess: (r) => setTurns((prev) => [...prev, { role: "assistant", content: r.answer, action: r.action }]),
    onError: (e: unknown) => {
      setTurns((prev) => prev.slice(0, -1));
      toast.error("The concierge couldn't answer", {
        description: e instanceof Error ? e.message : "Please try again.",
      });
    },
  });

  const runVote = useServerFn(castVote);
  const runCompromise = useServerFn(applyAiCompromise);
  const runNudge = useServerFn(sendMessage);
  const [actingOn, setActingOn] = useState<number | null>(null);

  const confirmAction = async (index: number, action: ConciergeAction) => {
    setActingOn(index);
    try {
      switch (action.type) {
        case "cast_vote":
          await runVote({ data: { planId, recommendationId: action.recommendationId } });
          toast.success(`Voted for ${action.recommendationTitle}`);
          void qc.invalidateQueries({ queryKey: ["plan", planId] });
          break;
        case "change_time":
          await runCompromise({ data: { planId, startTime: action.newStartTime } });
          toast.success(`Start time changed to ${action.newStartTime}`);
          void qc.invalidateQueries({ queryKey: ["plan", planId] });
          break;
        case "select_option":
          await runCompromise({ data: { planId, recommendationId: action.recommendationId } });
          toast.success(`${action.recommendationTitle} locked in`, {
            description: "Everyone has been notified.",
          });
          void qc.invalidateQueries({ queryKey: ["plan", planId] });
          break;
        case "send_nudge":
          await runNudge({ data: { groupId, planId, content: action.message } });
          toast.success("Sent to the group chat");
          break;
      }
      setTurns((prev) => prev.map((t, i) => (i === index ? { ...t, taken: true } : t)));
    } catch (e) {
      toast.error("Couldn't do that", {
        description: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setActingOn(null);
    }
  };

  const send = (text: string) => {
    setTurns((prev) => [...prev, { role: "user", content: text }]);
    ask.mutate(text);
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
      <AiGlyph className="h-4 w-4" />
      Ask AI
    </motion.button>
  );

  return (
    <>
      {/* Portaled to <body>: route content sits inside an animated wrapper
          elsewhere in the app whose transform/will-change would make it the
          containing block for position:fixed descendants. */}
      {mounted ? createPortal(trigger, document.body) : null}

      <ChatSheetShell
        open={open}
        onClose={() => setOpen(false)}
        title="Plan concierge"
        description={planTitle}
        emptyHint="Ask anything about this plan — options, cost, timing or backups."
        starters={STARTERS}
        turns={turns}
        pending={ask.isPending}
        onSend={send}
        renderTurnExtra={(t, i) =>
          t.action ? (
            <ActionCard
              action={t.action}
              isHost={isHost}
              taken={Boolean(t.taken)}
              pending={actingOn === i}
              onConfirm={() => confirmAction(i, t.action!)}
            />
          ) : null
        }
      />
    </>
  );
}

const HOST_ONLY = new Set<ConciergeAction["type"]>(["change_time", "select_option"]);

function ActionCard({
  action,
  isHost,
  taken,
  pending,
  onConfirm,
}: {
  action: ConciergeAction;
  isHost: boolean;
  taken: boolean;
  pending: boolean;
  onConfirm: () => void;
}) {
  const needsHost = HOST_ONLY.has(action.type);
  const blocked = needsHost && !isHost;

  const label =
    action.type === "cast_vote"
      ? `Vote for ${action.recommendationTitle}`
      : action.type === "change_time"
        ? `Change start time to ${action.newStartTime}`
        : action.type === "select_option"
          ? `Lock in ${action.recommendationTitle}`
          : "Send this to the group chat";

  return (
    <Card className="mr-auto mt-2 max-w-[90%] border-primary/40 bg-primary/5 p-3">
      <div className="flex items-center gap-2">
        <Pill tone="accent">💡 Suggested action</Pill>
        {blocked ? <Pill tone="neutral">Host only</Pill> : null}
      </div>
      {action.type === "send_nudge" ? (
        <p className="mt-2 text-sm italic text-muted-foreground">&ldquo;{action.message}&rdquo;</p>
      ) : null}
      {action.type === "change_time" && action.reason ? (
        <p className="mt-1 text-xs text-muted-foreground">{action.reason}</p>
      ) : null}
      {taken ? (
        <p className="mt-2 text-xs font-medium text-success">Done ✓</p>
      ) : blocked ? (
        <p className="mt-2 text-xs text-muted-foreground">Ask your host to do this.</p>
      ) : (
        <Button className="mt-2 h-9 px-3 text-xs" loading={pending} onClick={onConfirm}>
          {label}
        </Button>
      )}
    </Card>
  );
}
