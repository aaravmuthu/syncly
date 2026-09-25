import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CloudRain } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Pill } from "./ui";
import {
  getCompromiseSummaries,
  getPlanBSuggestion,
  type PlanBSuggestion,
} from "@/lib/quorum/ai.functions";
import { finalizePlan } from "@/lib/quorum/plan.functions";
import { AiGlyph } from "./ai/AiGlyph";

/** AI "why this works" lines, keyed by recommendation id. */
export function useCompromiseSummaries(planId: string, enabled: boolean) {
  const fetchSummaries = useServerFn(getCompromiseSummaries);
  return useQuery({
    queryKey: ["plan-compromise", planId],
    queryFn: () => fetchSummaries({ data: { planId } }) as Promise<Record<string, string>>,
    enabled,
    staleTime: 10 * 60_000,
  });
}

export function CompromiseNote({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <div className="mt-3 flex items-start gap-2 rounded-2xl border border-primary/25 bg-primary/5 px-3 py-2.5">
      <AiGlyph className="mt-0.5 h-3.5 w-3.5 text-primary" />
      <p className="text-xs leading-relaxed">{text}</p>
    </div>
  );
}

/** Weather guardian: outdoor pick + rough forecast → one-click indoor swap. */
export function PlanBGuardian({ planId }: { planId: string }) {
  const qc = useQueryClient();
  const fetchSuggestion = useServerFn(getPlanBSuggestion);
  const q = useQuery({
    queryKey: ["plan-b", planId],
    queryFn: () => fetchSuggestion({ data: { planId } }) as Promise<PlanBSuggestion>,
    staleTime: 15 * 60_000,
  });
  const swap = useMutation({
    mutationFn: useServerFn(finalizePlan),
    onSuccess: () => {
      toast.success("Swapped to the indoor backup");
      void qc.invalidateQueries({ queryKey: ["plan", planId] });
      void qc.invalidateQueries({ queryKey: ["plan-b", planId] });
    },
    onError: (e: unknown) =>
      toast.error("Could not swap the plan", {
        description: e instanceof Error ? e.message : "Please try again.",
      }),
  });

  const s = q.data;
  if (!s?.needed || !s.pitch) return null;

  return (
    <Card className="border-warning/40 ring-1 ring-warning/20">
      <div className="flex items-start gap-3">
        <CloudRain className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">Weather guardian</p>
            <Pill tone="accent" className="gap-1">
              <AiGlyph className="h-3 w-3" /> AI
            </Pill>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{s.pitch}</p>
          {s.swapToId ? (
            <Button
              className="mt-3"
              variant="outline"
              loading={swap.isPending}
              onClick={() =>
                swap.mutate({ data: { planId, recommendationId: s.swapToId as string } })
              }
            >
              Swap to {s.swapToTitle}
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
