import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Modal } from "./Modal";
import { CONFLICT_REASONS, confirmAttendance, flagConflict } from "@/lib/quorum/conflict.functions";
import { cn } from "@/lib/utils";

/**
 * The whole member response in two taps: "I'm In" or "Doesn't Work For Me"
 * followed by a single reason pill. No forms, no free text, no survey.
 */
export function QuickResponse({
  planId,
  compact = false,
  className,
}: {
  planId: string;
  compact?: boolean;
  className?: string;
}) {
  const qc = useQueryClient();
  const [picking, setPicking] = useState(false);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["dashboard"] });
    void qc.invalidateQueries({ queryKey: ["plan", planId] });
  };

  const confirm = useMutation({
    mutationFn: useServerFn(confirmAttendance),
    onSuccess: () => {
      refresh();
      toast.success("You're in 👍", { description: "The group can see you're confirmed." });
    },
    onError: (e: unknown) =>
      toast.error("Couldn't confirm", {
        description: e instanceof Error ? e.message : "Try again.",
      }),
  });

  const flag = useMutation({
    mutationFn: useServerFn(flagConflict),
    onSuccess: (raw) => {
      const r = raw as { alternatives: number; kind: string };
      setPicking(false);
      refresh();
      toast.success("Got it — the host knows", {
        description:
          r.kind === "budget"
            ? r.alternatives
              ? `${r.alternatives} cheaper options are up for a quick re-vote.`
              : "We asked the host to lower the cost estimate."
            : r.alternatives
              ? `${r.alternatives} adjusted options are up for a quick re-vote.`
              : "Your reason was shared without naming your details.",
      });
    },
    onError: (e: unknown) =>
      toast.error("Couldn't send that", {
        description: e instanceof Error ? e.message : "Try again.",
      }),
  });

  const busy = confirm.isPending || flag.isPending;

  return (
    <>
      <div className={cn("grid grid-cols-2 gap-2", className)}>
        <button
          type="button"
          disabled={busy}
          onClick={() => confirm.mutate({ data: { planId, attending: true } })}
          className={cn(
            "pressable rounded-2xl bg-emerald-500/15 font-semibold text-emerald-500 ring-1 ring-emerald-400/30 transition hover:bg-emerald-500/25 disabled:opacity-60",
            compact ? "px-3 py-2 text-sm" : "px-4 py-3.5 text-base",
          )}
        >
          I&apos;m In 👍
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setPicking(true)}
          className={cn(
            "pressable rounded-2xl bg-amber-400/12 font-semibold text-amber-500 ring-1 ring-amber-400/30 transition hover:bg-amber-400/20 disabled:opacity-60",
            compact ? "px-3 py-2 text-sm" : "px-4 py-3.5 text-base",
          )}
        >
          Doesn&apos;t Work For Me ✋
        </button>
      </div>

      <Modal open={picking} onClose={() => setPicking(false)} title="What's the blocker?">
        <p className="text-sm text-muted-foreground">
          One tap. We tell the host what to fix without sharing your private details.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {CONFLICT_REASONS.map((r) => (
            <button
              key={r.id}
              type="button"
              disabled={flag.isPending}
              onClick={() => flag.mutate({ data: { planId, kind: r.id } })}
              className="pressable rounded-2xl border border-border px-4 py-3 text-left text-sm font-medium transition hover:border-primary/50 hover:bg-primary/8 disabled:opacity-60"
            >
              {r.label}
            </button>
          ))}
        </div>
      </Modal>
    </>
  );
}
