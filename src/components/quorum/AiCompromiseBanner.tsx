import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "@/lib/quorum/toast";
import { Button, Card, Pill } from "./ui";
import { prettyTime } from "./time-format";
import { applyAiCompromise, getAiCompromise } from "@/lib/quorum/ai.functions";
import { AiGlyph } from "./ai/AiGlyph";

/**
 * Sits above the voting options. Reads group-safe conflict aggregates and
 * offers the host a one-tap fix for curfew / budget / vote-split clashes.
 */
export function AiCompromiseBanner({
  planId,
  isHost,
  enabled,
}: {
  planId: string;
  isHost: boolean;
  enabled: boolean;
}) {
  const qc = useQueryClient();
  const fetchCompromise = useServerFn(getAiCompromise);
  const q = useQuery({
    queryKey: ["ai-compromise", planId],
    queryFn: () => fetchCompromise({ data: { planId } }),
    enabled,
    staleTime: 60_000,
  });

  const applyFn = useServerFn(applyAiCompromise);
  const apply = useMutation({
    mutationFn: (input: {
      data: {
        planId: string;
        startTime?: string | null;
        recommendationId?: string | null;
        timeZone?: string;
      };
    }) => applyFn(input),
    onSuccess: (r) => {
      toast.success(r.requiresNewVote ? "Time updated" : "Compromise applied", {
        description: r.requiresNewVote
          ? r.optionsReady
            ? "Review the refreshed options and vote again."
            : "Collect answers or refresh options to continue."
          : "Everyone has been notified.",
      });
      void qc.invalidateQueries({ queryKey: ["plan", planId] });
      void qc.invalidateQueries({ queryKey: ["ai-compromise", planId] });
    },
    onError: (e: unknown) =>
      toast.error("Couldn't apply that", {
        description: e instanceof Error ? e.message : "Please try again.",
      }),
  });

  const c = q.data;
  if (!enabled || !c?.needed) return null;

  return (
    <Card className="border-primary/40 bg-primary/5">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="accent" className="gap-1.5">
          <AiGlyph className="size-3.5" /> AI compromise
        </Pill>
        {c.suggestedStart ? <Pill tone="neutral">Start {prettyTime(c.suggestedStart)}</Pill> : null}
        {c.suggestedRecommendationTitle ? (
          <Pill tone="neutral">{c.suggestedRecommendationTitle}</Pill>
        ) : null}
      </div>
      <p className="mt-2 font-display text-base font-semibold">{c.headline}</p>
      <p className="mt-1 text-sm text-muted-foreground">{c.detail}</p>
      {isHost && (c.suggestedStart || c.suggestedRecommendationId) ? (
        <Button
          className="mt-3"
          loading={apply.isPending}
          orb="weaving"
          onClick={() =>
            apply.mutate({
              data: {
                planId,
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                startTime: c.suggestedStart,
                recommendationId: c.suggestedRecommendationId,
              },
            })
          }
        >
          Apply AI compromise
        </Button>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          {isHost
            ? "Refresh the options to find a change that works."
            : "Ask the host to review the options."}
        </p>
      )}
    </Card>
  );
}
