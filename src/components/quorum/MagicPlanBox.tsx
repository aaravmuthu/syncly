import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui";
import { magicPlanDraft, type MagicPlanResult } from "@/lib/quorum/ai.functions";
import type { PlanCategory } from "@/lib/quorum/types";

export type MagicApply = {
  title: string;
  category: PlanCategory;
  date: string | null;
  zip: string | null;
};

/**
 * Natural-language plan creator. Parses the sentence with Lovable AI, then
 * probes the live venue services so the host sees real candidates instantly.
 */
export function MagicPlanBox({
  fallbackZip,
  onApply,
}: {
  fallbackZip?: string | null;
  onApply: (draft: MagicApply) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<MagicPlanResult | null>(null);
  const run = useMutation({
    mutationFn: useServerFn(magicPlanDraft),
    onSuccess: (draft) => {
      setResult(draft);
      onApply({
        title: draft.title,
        category: draft.category,
        date: draft.date,
        zip: draft.zip,
      });
      toast.success("Plan drafted", { description: "Review the fields below before creating." });
    },
    onError: (e: unknown) =>
      toast.error("Could not read that prompt", {
        description: e instanceof Error ? e.message : "Try describing the plan again.",
      }),
  });

  return (
    <div className="rounded-3xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" aria-hidden />
        <h3 className="text-sm font-semibold">Magic Create with AI</h3>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Describe it the way you'd text it. We'll fill in the details and look up real venues.
      </p>
      <textarea
        className="mt-3 min-h-20 w-full resize-y rounded-2xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary/50"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Dinner and bowling in Frisco this Friday around 7 PM under $30 each"
      />
      <Button
        className="mt-3 w-full"
        loading={run.isPending}
        disabled={!prompt.trim()}
        onClick={() => run.mutate({ data: { prompt, fallbackZip: fallbackZip ?? null } })}
      >
        {run.isPending ? "Reading your plan…" : "Draft it for me"}
      </Button>

      {result ? (
        <div className="mt-4 space-y-2">
          <div className="flex flex-wrap gap-1.5 text-xs">
            <Chip>{result.category}</Chip>
            {result.date ? <Chip>{result.date}</Chip> : null}
            {result.time ? <Chip>{result.time}</Chip> : null}
            {result.maxSpendPerPerson != null ? <Chip>≤ ${result.maxSpendPerPerson}/person</Chip> : null}
            {result.searchRadiusMiles != null ? <Chip>{result.searchRadiusMiles} mi radius</Chip> : null}
            {result.areaLabel ? <Chip>{result.areaLabel}</Chip> : null}
          </div>
          {result.candidates.length ? (
            <div className="rounded-2xl border border-border bg-background/60 p-3">
              <p className="text-xs font-medium text-muted-foreground">Nearby right now</p>
              <ul className="mt-1.5 space-y-1">
                {result.candidates.map((c) => (
                  <li key={c.title} className="flex items-baseline justify-between gap-3 text-xs">
                    <span className="truncate">{c.title}</span>
                    <span className="shrink-0 text-muted-foreground">
                      ${c.costMin}–{c.costMax}
                      {c.distanceMiles != null ? ` · ${c.distanceMiles.toFixed(1)} mi` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Add a ZIP code below and we'll pull live venues when the plan is created.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-border bg-background px-2 py-0.5 capitalize">
      {children}
    </span>
  );
}
