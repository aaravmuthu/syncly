import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/quorum/AppShell";
import { WeatherCard, AvailabilityHeatmap } from "@/components/quorum/PlanInsights";
import { ConstraintForm } from "@/components/quorum/ConstraintForm";
import { Button, Card, Meter, Pill, Skeleton } from "@/components/quorum/ui";
import { FinalizedPlanHub } from "@/components/quorum/FinalizedPlanHub";
import { VenueMap } from "@/components/quorum/VenueMap";
import { estimateCost, formatRange } from "@/lib/quorum/cost";
import {
  castVote,
  finalizePlan,
  generateRecommendations,
  getPlan,
  requestParentApproval,
  submitConstraints,
} from "@/lib/quorum/plan.functions";
import { categoryMeta, type ScoreBreakdown } from "@/lib/quorum/types";

export const Route = createFileRoute("/_authenticated/plans/$planId")({
  head: () => ({
    meta: [
      { title: "Plan — Quorum" },
      {
        name: "description",
        content:
          "Answer privately, then see only the options that genuinely work for everyone in the group.",
      },
      { property: "og:title", content: "Plan — Quorum" },
      { property: "og:description", content: "Private answers in, one workable plan out." },
    ],
  }),
  component: PlanPage,
});

function PlanPage() {
  const { planId } = Route.useParams();
  const qc = useQueryClient();
  const fetchPlan = useServerFn(getPlan);
  const q = useQuery({ queryKey: ["plan", planId], queryFn: () => fetchPlan({ data: { planId } }) });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["plan", planId] });

  const [editing, setEditing] = useState(false);
  const [approvalLink, setApprovalLink] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: useServerFn(submitConstraints),
    onSuccess: () => {
      setEditing(false);
      void invalidate();
    },
  });
  const generate = useMutation({
    mutationFn: useServerFn(generateRecommendations),
    onSuccess: () => void invalidate(),
  });
  const vote = useMutation({ mutationFn: useServerFn(castVote), onSuccess: () => void invalidate() });
  const finalize = useMutation({
    mutationFn: useServerFn(finalizePlan),
    onSuccess: () => void invalidate(),
  });
  const askParent = useMutation({
    mutationFn: useServerFn(requestParentApproval),
    onSuccess: (row) =>
      setApprovalLink(`${window.location.origin}/approve/${(row as { token: string }).token}`),
  });

  const data = q.data;
  const meta = data ? categoryMeta(data.plan.category) : null;

  const myParticipant = useMemo(
    () => data?.participants.find((p) => p.profile_id === data.meProfileId),
    [data],
  );
  const responded = data?.participants.filter((p) => p.responded).length ?? 0;
  const total = data?.participants.length ?? 0;

  if (q.isLoading || !data || !meta) {
    return (
      <AppShell title="Plan">
        <Skeleton className="h-40 rounded-3xl" />
      </AppShell>
    );
  }

  const needsMyAnswers = !myParticipant?.responded || editing;
  const votes = data.votes;
  const selected = data.plan.selected_recommendation_id;
  const headcount = Math.max(total, 1);
  const attendeeNames = data.participants
    .filter((p) => p.attending !== false)
    .map((p) => (p.profiles as { display_name?: string } | null)?.display_name ?? "Member");
  const cars = data.transport.map((t) => ({
    label: t.car_label,
    driver: t.driver_label ?? "A driver",
  }));
  const selectedRec = data.recommendations.find((r) => r.id === selected) ?? null;
  const backupRec =
    data.recommendations.find((r) => r.id !== selected && r.feasible) ??
    data.recommendations.find((r) => r.id !== selected) ??
    null;
  const latestApproval = data.approvals[0]?.status ?? null;

  return (
    <AppShell
      title={data.plan.title}
      subtitle={`${meta.emoji} ${meta.label} · ${responded} of ${total} have answered privately`}
    >
      {selectedRec ? (
        <FinalizedPlanHub
          planTitle={data.plan.title}
          windowStart={data.plan.window_start}
          rec={selectedRec}
          attendees={attendeeNames}
          cars={cars}
          approvalStatus={latestApproval}
        />
      ) : null}

      {needsMyAnswers ? (
        <ConstraintForm
          questionnaire={meta.questionnaire}
          initial={data.myConstraints}
          saving={submit.isPending}
          onSubmit={(payload) => submit.mutate({ data: { planId, payload } })}
        />
      ) : (
        <Card className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold">Your answers are in</p>
            <p className="text-sm text-muted-foreground">
              Private to you. Change them any time before the plan is locked.
            </p>
          </div>
          <Button variant="outline" onClick={() => setEditing(true)}>
            Edit
          </Button>
        </Card>
      )}

      <Card className="mt-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold">Group progress</p>
            <p className="text-sm text-muted-foreground">
              {responded === total
                ? "Everyone has answered — you can generate options."
                : `Waiting on ${total - responded} more ${total - responded === 1 ? "person" : "people"}.`}
            </p>
          </div>
          <Button
            variant={responded === total ? "primary" : "outline"}
            disabled={generate.isPending || responded === 0}
            onClick={() => generate.mutate({ data: { planId } })}
          >
            {generate.isPending ? "Working…" : "Find options"}
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {data.participants.map((p) => {
            const prof = p.profiles as { display_name?: string; avatar_emoji?: string } | null;
            return (
              <span
                key={p.profile_id}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${
                  p.responded ? "bg-success/15 text-success" : "bg-secondary text-muted-foreground"
                }`}
                title={p.responded ? "Completed questionnaire" : "Pending input"}
              >
                {prof?.avatar_emoji ?? "🙂"} {prof?.display_name ?? "Member"}
                <span className="opacity-75">
                  · {p.responded ? (selected ? "Ready" : "Answered") : "Pending"}
                </span>
              </span>
            );
          })}
        </div>
      </Card>

      <div className="mt-4 space-y-3">
        <WeatherCard planId={planId} />
        <AvailabilityHeatmap planId={planId} />
      </div>

      {data.recommendations.length > 0 ? (
        <section className="mt-8 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Options that work for the group
          </h2>
          <VenueMap
            venues={data.recommendations
              .filter(
                (r): r is typeof r & { lat: number; lon: number } =>
                  typeof r.lat === "number" && typeof r.lon === "number",
              )
              .map((r) => ({
                id: r.id,
                title: r.title,
                lat: r.lat,
                lon: r.lon,
                rank: r.rank,
                selected: selected === r.id,
              }))}
          />
          {data.recommendations.map((r) => {
            const b = (r.breakdown ?? {}) as unknown as ScoreBreakdown;
            const myVote = votes.find((v) => v.profile_id === data.meProfileId)?.recommendation_id;
            const count = votes.filter((v) => v.recommendation_id === r.id).length;
            const isSelected = selected === r.id;
            return (
              <Card
                key={r.id}
                className={isSelected ? "border-primary/60 ring-1 ring-primary/25" : undefined}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-lg font-semibold">{r.title}</h3>
                      {r.feasible ? (
                        <Pill tone="good">Works for everyone</Pill>
                      ) : (
                        <Pill tone="bad">Doesn't work for everyone</Pill>
                      )}
                      {isSelected ? <Pill tone="accent">Chosen</Pill> : null}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{r.subtitle}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {b.venue?.priceLevel ? `${b.venue.priceLevel} · ` : ""}${r.cost_min}–${r.cost_max}
                      {b.venue?.distanceMiles != null
                        ? ` · ${b.venue.distanceMiles} miles away`
                        : ` · ${r.travel_minutes} min away`}{" "}
                      · {r.suggested_start}–{r.suggested_end}
                      {b.venue?.rating != null ? ` · ★ ${b.venue.rating}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {b.venue?.address ?? r.location_name}
                      {b.venue?.distanceMiles != null ? ` · ${r.travel_minutes} min drive` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-display text-2xl font-semibold tabular-nums">{r.score}%</div>
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      match
                    </div>
                    {b.venue?.distanceMiles != null ? (
                      <div className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                        {b.venue.distanceMiles} mi
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                  <Meter label="Budget fit" value={b.budgetFit ?? 0} />
                  <Meter label="Schedule fit" value={b.scheduleFit ?? 0} />
                  <Meter label="Travel" value={b.travelFit ?? 0} />
                  <Meter label="Food needs" value={b.dietaryFit ?? 0} />
                  <Meter label="Preferences" value={b.preferenceFit ?? 0} />
                  <Meter label="Fairness" value={b.fairness ?? 0} />
                </div>

                {(() => {
                  const cost = estimateCost({
                    costMin: r.cost_min ?? 0,
                    costMax: r.cost_max ?? 0,
                    travelMinutes: r.travel_minutes ?? 0,
                    distanceMiles: b.venue?.distanceMiles ?? null,
                    category: data.plan.category,
                    headcount,
                  });
                  return (
                    <div className="mt-4 rounded-2xl bg-secondary/60 p-3.5">
                      <div className="flex items-baseline justify-between text-sm">
                        <span className="font-medium">Estimated per person</span>
                        <span className="font-semibold tabular-nums">
                          {formatRange(cost.perPersonMin, cost.perPersonMax)}
                        </span>
                      </div>
                      <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                        {cost.lines.map((l) => (
                          <li key={l.label} className="flex justify-between gap-3">
                            <span>{l.label}</span>
                            <span className="tabular-nums">{l.value}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })()}

                {(b.reasons ?? []).length ? (
                  <ul className="mt-4 space-y-1 text-sm">
                    {b.reasons.map((x) => (
                      <li key={x} className="text-muted-foreground">
                        <span className="mr-1.5 text-success">✓</span>
                        {x}
                      </li>
                    ))}
                    {(b.cautions ?? []).map((x) => (
                      <li key={x} className="text-muted-foreground">
                        <span className="mr-1.5 text-warning">!</span>
                        {x}
                      </li>
                    ))}
                  </ul>
                ) : null}

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <Button
                    variant={myVote === r.id ? "primary" : "outline"}
                    onClick={() => vote.mutate({ data: { planId, recommendationId: r.id } })}
                  >
                    {myVote === r.id ? "Your pick" : "Vote for this"}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {count} {count === 1 ? "vote" : "votes"}
                  </span>
                  <div className="flex-1" />
                  {!isSelected ? (
                    <Button
                      variant="ghost"
                      onClick={() => finalize.mutate({ data: { planId, recommendationId: r.id } })}
                    >
                      Lock this in
                    </Button>
                  ) : null}
                </div>
              </Card>
            );
          })}
          {selectedRec && backupRec ? (
            <Card className="border-dashed">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Pill tone="accent">Plan B</Pill>
                    <span className="text-xs text-muted-foreground">
                      {backupRec.score}% match
                    </span>
                  </div>
                  <p className="mt-1.5 font-display font-semibold">{backupRec.title}</p>
                  <p className="text-sm text-muted-foreground">
                    Ready to swap in if weather, timing or a last-minute change breaks Plan A.
                  </p>
                </div>
                <Button
                  variant="outline"
                  loading={finalize.isPending}
                  onClick={() =>
                    finalize.mutate({ data: { planId, recommendationId: backupRec.id } })
                  }
                >
                  Swap to backup plan
                </Button>
              </div>
            </Card>
          ) : null}

          <p className="px-1 text-xs text-muted-foreground">
            Scores come from everyone's private answers. Quorum never shows whose budget, curfew, or
            dietary need ruled an option out.
          </p>
        </section>
      ) : null}

      {data.transport.length > 0 ? (
        <section className="mt-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Getting there
          </h2>
          <Card className="space-y-2">
            {data.transport.map((t) => (
              <div key={t.id} className="flex items-center justify-between text-sm">
                <span className="font-medium">{t.car_label}</span>
                <span className="text-muted-foreground">{t.driver_label} is driving</span>
              </div>
            ))}
          </Card>
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Parent permission
        </h2>
        <Card>
          <p className="text-sm text-muted-foreground">
            Send a parent a link with only the details they need: what, where, when, and how you're
            getting home. They can approve, approve with a condition, or decline — no account required.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              disabled={askParent.isPending}
              onClick={() => askParent.mutate({ data: { planId } })}
            >
              {askParent.isPending ? "Creating…" : "Create approval link"}
            </Button>
            {approvalLink ? (
              <button
                type="button"
                className="truncate rounded-xl bg-secondary px-3 py-2 text-xs"
                onClick={() => void navigator.clipboard.writeText(approvalLink)}
              >
                Tap to copy: {approvalLink}
              </button>
            ) : null}
          </div>
          {data.approvals.length ? (
            <div className="mt-4 space-y-1.5">
              {data.approvals.map((a) => (
                <div key={a.id} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Request</span>
                  <Pill
                    tone={
                      a.status === "approved"
                        ? "good"
                        : a.status === "declined"
                          ? "bad"
                          : a.status === "approved_with_condition"
                            ? "warn"
                            : "neutral"
                    }
                  >
                    {a.status.replace(/_/g, " ")}
                    {a.condition_text ? ` — ${a.condition_text}` : ""}
                  </Pill>
                </div>
              ))}
            </div>
          ) : null}
        </Card>
      </section>
    </AppShell>
  );
}
