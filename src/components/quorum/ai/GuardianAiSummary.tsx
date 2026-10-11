import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion, useReducedMotion } from "motion/react";
import { ShieldCheck } from "lucide-react";
import { Button, Card, Skeleton } from "@/components/quorum/ui";
import {
  getGuardianAiSummary,
  type GuardianAiSummary as Summary,
} from "@/lib/quorum/aiplus.functions";
import { AiActivity } from "./AiActivity";
import { AiGlyph } from "./AiGlyph";

/** Plain-language AI evening summary for a parent about one linked teen. */
export function GuardianAiSummaryCard({ teenProfileId }: { teenProfileId?: string | null }) {
  const reduce = useReducedMotion();
  const fetchSummary = useServerFn(getGuardianAiSummary);
  const q = useQuery({
    queryKey: ["guardian-ai-summary", teenProfileId ?? "first"],
    queryFn: () =>
      fetchSummary({ data: { teenProfileId: teenProfileId ?? null } }) as Promise<Summary>,
    staleTime: 10 * 60_000,
  });

  if (q.isPending) {
    return (
      <Card>
        <AiActivity sync state="composing" label="Summarizing tonight…" />
        <Skeleton className="mt-3 h-3 w-full" />
        <Skeleton className="mt-2 h-3 w-3/4" />
      </Card>
    );
  }
  const s = q.data;
  if (!s)
    return (
      <Card>
        <p role="alert" className="text-sm">
          The summary could not be loaded.
        </p>
        <Button className="mt-2" onClick={() => void q.refetch()}>
          Retry summary
        </Button>
      </Card>
    );

  return (
    <Card className="border-primary/25 ring-1 ring-primary/10">
      <div className="flex items-center gap-2">
        <AiGlyph className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Tonight, in plain language</h2>
      </div>
      {!s.aiGenerated ? (
        <p className="mt-2 text-caption text-muted-foreground">Basic summary · AI is unavailable</p>
      ) : null}
      <p className="mt-2 text-sm leading-relaxed">{s.summary}</p>
      {s.watchouts.length ? (
        <ul className="mt-3 space-y-1.5">
          {s.watchouts.map((w, i) => (
            <motion.li
              key={w}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 28, delay: i * 0.06 }}
              className="flex items-start gap-2 rounded-2xl border border-border bg-secondary/50 px-3 py-2 text-sm"
            >
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
              <span>{w}</span>
            </motion.li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
