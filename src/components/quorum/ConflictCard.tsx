import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui";
import { castResolutionVote, confirmAttendance, flagConflict } from "@/lib/quorum/conflict.functions";

export type ConflictAlt = {
  id: string;
  title: string;
  subtitle: string | null;
  cost_min: number | null;
  cost_max: number | null;
  suggested_start: string | null;
  tags: string[];
};

const LABELS: Record<string, string> = {
  "time-shift": "Earlier start",
  budget: "Lower cost",
  location: "Closer spot",
};

const altLabel = (tags: string[]) =>
  tags.map((t) => LABELS[t]).find(Boolean) ?? "Adjusted option";

/** Auto-pivot banner + 1-tap re-vote poll shown on the dashboard timeline. */
export function ConflictCard({
  planId,
  title,
  conflicts,
  alternatives,
  original,
}: {
  planId: string;
  title: string;
  conflicts: { id: string; kind: string; detail: string | null }[];
  alternatives: ConflictAlt[];
  original: { id: string; title: string } | null;
}) {
  const qc = useQueryClient();
  const vote = useMutation({
    mutationFn: useServerFn(castResolutionVote),
    onSuccess: (raw) => {
      const r = raw as { locked: boolean; votes: number; needed: number };
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["plan", planId] });
      toast.success(r.locked ? "Locked in for everyone" : "Vote counted", {
        description: r.locked
          ? "Calendars and timelines have been updated."
          : `${r.votes}/${r.needed} needed for the group to agree.`,
      });
    },
    onError: (e: unknown) =>
      toast.error("Could not record that vote", {
        description: e instanceof Error ? e.message : "Try again.",
      }),
  });

  return (
    <div className="glass-card space-y-3 border-amber-400/35 p-4">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-500">
            Conflict detected
          </p>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">
            Plan conflict detected for {conflicts.length} member{conflicts.length === 1 ? "" : "s"}.
            Voting on alternatives.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {alternatives.map((a, i) => (
          <button
            key={a.id}
            type="button"
            disabled={vote.isPending}
            onClick={() => vote.mutate({ data: { planId, recommendationId: a.id } })}
            className="w-full rounded-2xl border border-border px-3 py-2.5 text-left text-sm transition hover:bg-secondary disabled:opacity-60"
          >
            <span className="font-medium">
              Vote Option {String.fromCharCode(65 + i)} · {altLabel(a.tags)}
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {a.title}
              {a.cost_max != null ? ` · $${a.cost_min ?? 0}–${a.cost_max}/person` : ""}
              {a.suggested_start ? ` · ${String(a.suggested_start).slice(0, 5)}` : ""}
            </span>
          </button>
        ))}
        {original ? (
          <Button
            variant="outline"
            className="w-full"
            loading={vote.isPending}
            onClick={() => vote.mutate({ data: { planId, recommendationId: original.id } })}
          >
            Keep original
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** 1-tap timeline actions: confirm attendance or raise a conflict. */
export function QuickActions({ planId }: { planId: string }) {
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["dashboard"] });
    void qc.invalidateQueries({ queryKey: ["plan", planId] });
  };

  const confirm = useMutation({
    mutationFn: useServerFn(confirmAttendance),
    onSuccess: () => {
      refresh();
      toast.success("You're marked as going");
    },
  });
  const flag = useMutation({
    mutationFn: useServerFn(flagConflict),
    onSuccess: (raw) => {
      const r = raw as { alternatives: number };
      refresh();
      toast.success("Conflict flagged", {
        description: r.alternatives
          ? `${r.alternatives} alternatives are up for a quick re-vote.`
          : "The group has been notified.",
      });
    },
    onError: (e: unknown) =>
      toast.error("Could not flag that", {
        description: e instanceof Error ? e.message : "Try again.",
      }),
  });

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        className="flex-1 py-2 text-xs"
        loading={confirm.isPending}
        onClick={() => confirm.mutate({ data: { planId, attending: true } })}
      >
        I'm in
      </Button>
      <Button
        variant="ghost"
        className="flex-1 py-2 text-xs"
        loading={flag.isPending}
        onClick={() =>
          flag.mutate({ data: { planId, kind: "manual", detail: "This time doesn't work for me" } })
        }
      >
        Doesn't work
      </Button>
    </div>
  );
}
