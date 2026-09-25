import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "motion/react";
import { Sparkles } from "lucide-react";
import { Card, Skeleton } from "@/components/quorum/ui";
import { AiActivity } from "./AiActivity";
import { getSquadDigest, type SquadDigest as Digest } from "@/lib/quorum/aiplus.functions";

/** AI recap of the week plus a "next best plan" nudge, for the home screen. */
export function SquadDigestCard() {
  const fetchDigest = useServerFn(getSquadDigest);
  const q = useQuery({
    queryKey: ["squad-digest"],
    queryFn: () => fetchDigest({}) as Promise<Digest>,
    staleTime: 10 * 60_000,
  });

  if (q.isPending) {
    return (
      <Card>
        <AiActivity state="composing" label="Writing your squad digest…" />
        <Skeleton className="mt-3 h-3 w-full" />
        <Skeleton className="mt-2 h-3 w-4/5" />
      </Card>
    );
  }
  const d = q.data;
  if (!d) return null;

  return (
    <Card className="border-primary/25 ring-1 ring-primary/10">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" aria-hidden />
        <h2 className="text-sm font-semibold">Your squad digest</h2>
      </div>
      <p className="mt-2 text-base font-semibold tracking-tight">{d.headline}</p>
      <ul className="mt-2 space-y-1.5">
        {d.bullets.map((b, i) => (
          <motion.li
            key={b}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28, delay: i * 0.06 }}
            className="flex gap-2 text-sm text-muted-foreground"
          >
            <span aria-hidden className="text-primary">
              •
            </span>
            <span>{b}</span>
          </motion.li>
        ))}
      </ul>
      {d.nextBest ? (
        <div className="mt-3 rounded-2xl border border-border bg-secondary/50 px-3 py-2.5">
          <p className="text-xs font-medium text-muted-foreground">Next best plan</p>
          <p className="mt-0.5 text-sm">{d.nextBest}</p>
        </div>
      ) : null}
    </Card>
  );
}
