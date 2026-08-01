import { useMemo, useState } from "react";
import { Target } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TIER_LABELS, TIER_ORDER, type TierId } from "@/lib/gpacalc/types";
import { pointsToGrade, requiredPoints, type GpaResult, type ResolvedScale } from "@/lib/gpacalc/engine";

interface Props {
  cumulative: GpaResult;
  scale: ResolvedScale;
}

export function WhatIf({ cumulative, scale }: Props) {
  const [target, setTarget] = useState("5.0");
  const [futureCredits, setFutureCredits] = useState("6");
  const [tier, setTier] = useState<TierId>("ap");

  const result = useMemo(() => {
    const t = Number(target) || 0;
    const fc = Number(futureCredits) || 0;
    return requiredPoints(
      {
        currentPoints: cumulative.weighted,
        currentCredits: cumulative.credits,
        futureCredits: fc,
        target: t,
      },
      scale.maxPoints,
    );
  }, [target, futureCredits, cumulative, scale]);

  const neededGrade = pointsToGrade(Math.max(0, result.neededPoints), tier, scale);

  return (
    <section className="rounded-2xl border border-border bg-card/70 p-5 backdrop-blur-xl">
      <div className="flex items-center gap-2">
        <Target className="size-4 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">What-if target calculator</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        See exactly what you need in upcoming semesters to hit a cumulative goal.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Target cumulative GPA</Label>
          <Input value={target} onChange={(e) => setTarget(e.target.value)} className="tabular-nums" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Upcoming credits</Label>
          <Input
            value={futureCredits}
            onChange={(e) => setFutureCredits(e.target.value)}
            className="tabular-nums"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Course difficulty</Label>
          <Select value={tier} onValueChange={(v) => setTier(v as TierId)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIER_ORDER.map((t) => (
                <SelectItem key={t} value={t}>
                  {TIER_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Current base</Label>
          <div className="flex h-10 items-center rounded-lg border border-border bg-secondary/30 px-3 text-sm tabular-nums text-foreground">
            {cumulative.weighted.toFixed(3)} over {cumulative.credits.toFixed(1)} cr
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-border bg-secondary/30 p-4">
        {result.alreadyMet ? (
          <p className="text-sm text-success">
            You are already at or above {target} — anything passing keeps you there.
          </p>
        ) : result.possible ? (
          <p className="text-sm text-foreground">
            You need to average{" "}
            <span className="font-semibold text-primary tabular-nums">
              {result.neededPoints.toFixed(3)}
            </span>{" "}
            grade points across those {futureCredits} credits
            {neededGrade !== null && (
              <>
                {" "}
                — roughly a{" "}
                <span className="font-semibold text-primary tabular-nums">
                  {neededGrade.toFixed(1)}
                </span>{" "}
                in every {TIER_LABELS[tier]} course.
              </>
            )}
          </p>
        ) : (
          <p className="text-sm text-destructive">
            Not reachable: {result.neededPoints.toFixed(3)} points exceeds the scale maximum of{" "}
            {scale.maxPoints.toFixed(1)}. Add more credits or lower the target.
          </p>
        )}
      </div>
    </section>
  );
}
