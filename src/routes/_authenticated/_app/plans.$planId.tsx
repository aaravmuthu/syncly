import { Avatar } from "@/components/quorum/Avatar";
import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle2,
  Compass,
  Crown,
  MapPin,
  Pencil,
  Shuffle,
  Star,
  Utensils,
} from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/quorum/AppShell";
import { CarpoolShield } from "@/components/quorum/guardian/CarpoolShield";
import { PlanInsights } from "@/components/quorum/PlanInsights";
import { AiCompromiseBanner } from "@/components/quorum/AiCompromiseBanner";
import {
  CompromiseNote,
  PlanBGuardian,
  useCompromiseSummaries,
} from "@/components/quorum/PlanAiInsights";
import { ConstraintForm } from "@/components/quorum/ConstraintForm";
import { QuickResponse } from "@/components/quorum/QuickResponse";
import { BudgetFitPill, CostBadge } from "@/components/quorum/DashboardParts";
import { Button, Card, Meter, Pill, Skeleton } from "@/components/quorum/ui";
import { FinalizedPlanHub } from "@/components/quorum/FinalizedPlanHub";
import { VenueMap } from "@/components/quorum/VenueMap";
import { SpotBrowser } from "@/components/quorum/SpotBrowser";
import { ChatDrawer } from "@/components/quorum/ChatDrawer";
import { ConciergeSheet } from "@/components/quorum/ai/ConciergeSheet";
import { estimateCost, formatRange } from "@/lib/quorum/cost";
import {
  castVote,
  finalizePlan,
  generateRecommendations,
  getPlan,
  getSummaryShareLink,
  requestParentApproval,
  submitConstraints,
} from "@/lib/quorum/plan.functions";
import { categoryMeta, type ScoreBreakdown } from "@/lib/quorum/types";
import { directionsUrl } from "@/lib/quorum/vibes";
import { toast } from "sonner";
import { VenueDetailModal, type VenueDetail } from "@/components/quorum/VenueDetailModal";
import { venuePhoto, venueStats } from "@/lib/quorum/venuePhotos";
import { haptic } from "@/lib/quorum/haptics";
import { SwipeBack } from "@/components/quorum/interactions";

export const Route = createFileRoute("/_authenticated/_app/plans/$planId")({
  loader: ({ context, params }) => {
    void context.queryClient.ensureQueryData({
      queryKey: ["plan", params.planId],
      queryFn: () => getPlan({ data: { planId: params.planId } }),
    });
  },
  head: () => ({
    meta: [
      { title: "Plan — Syncly" },
      {
        name: "description",
        content:
          "Answer privately, then see only the options that genuinely work for everyone in the group.",
      },
      { property: "og:title", content: "Plan — Syncly" },
      { property: "og:description", content: "Private answers in, one workable plan out." },
    ],
  }),
  component: PlanPage,
});

/** Conflict banner + one-tap alternative ballot for this plan. */
function PlanConflictBanner({
  planId,
  title,
  recs,
}: {
  planId: string;
  title: string;
  recs: {
    id: string;
    title: string;
    subtitle: string | null;
    cost_min: number | null;
    cost_max: number | null;
    suggested_start: string | null;
    tags: string[];
  }[];
}) {
  const fetchConflicts = useServerFn(getPlanConflicts);
  const q = useQuery({
    queryKey: ["plan-conflicts", planId],
    queryFn: () => fetchConflicts({ data: { planId } }),
    retry: false,
  });
  const conflicts = q.data?.conflicts ?? [];
  const alternatives = recs.filter((r) => (r.tags ?? []).includes("alternative"));
  const original = recs.find((r) => !(r.tags ?? []).includes("alternative")) ?? null;
  if (!conflicts.length || !alternatives.length) return null;

  return (
    <ConflictCard
      planId={planId}
      title={title}
      conflicts={conflicts.map((c) => ({ id: c.id, kind: c.kind, detail: c.detail }))}
      alternatives={alternatives.map((r) => ({
        id: r.id,
        title: r.title,
        subtitle: r.subtitle,
        cost_min: r.cost_min,
        cost_max: r.cost_max,
        suggested_start: r.suggested_start,
        tags: r.tags ?? [],
      }))}
      original={original ? { id: original.id, title: original.title } : null}
    />
  );
}

import { useFriends } from "@/lib/quorum/nicknames";
import { ConflictCard } from "@/components/quorum/ConflictCard";
import { getPlanConflicts } from "@/lib/quorum/conflict.functions";
function PlanPage() {
  const { planId } = Route.useParams();
  const { alias, openFriend } = useFriends();
  const qc = useQueryClient();
  const fetchPlan = useServerFn(getPlan);
  const q = useQuery({
    queryKey: ["plan", planId],
    queryFn: () => fetchPlan({ data: { planId } }),
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["plan", planId] });

  const [editing, setEditing] = useState(false);
  const [approvalLink, setApprovalLink] = useState<string | null>(null);
  const [venueDetail, setVenueDetail] = useState<VenueDetail | null>(null);
  const [shuffle, setShuffle] = useState(0);

  const submit = useMutation({
    mutationFn: useServerFn(submitConstraints),
    onSuccess: () => {
      setEditing(false);
      void invalidate();
    },
  });
  const generate = useMutation({
    mutationFn: useServerFn(generateRecommendations),
    onSuccess: (res: { count?: number } | undefined) => {
      void invalidate();
      toast.success("Fair spots ready", {
        description: `${res?.count ?? 0} options centered on your group's midpoint.`,
      });
    },
    onError: (e: unknown) =>
      toast.error("Couldn't find options", {
        description: e instanceof Error ? e.message : "Please try again.",
      }),
  });

  const vote = useMutation({
    mutationFn: useServerFn(castVote),
    onSuccess: () => {
      haptic("select");
      void invalidate();
    },
    onError: () => haptic("warn"),
  });
  const finalize = useMutation({
    mutationFn: useServerFn(finalizePlan),
    onSuccess: () => {
      haptic("success");
      void invalidate();
    },
    onError: () => haptic("warn"),
  });
  const askParent = useMutation({
    mutationFn: useServerFn(requestParentApproval),
    onSuccess: (row) =>
      setApprovalLink(`${window.location.origin}/approve/${(row as { token: string }).token}`),
  });
  const shareSummary = useMutation({
    mutationFn: useServerFn(getSummaryShareLink),
    onSuccess: (row) => {
      const { planId: sharedPlanId, sig } = row as { planId: string; sig: string };
      const link = `${window.location.origin}/approve/${sharedPlanId}.${sig}`;
      void navigator.clipboard.writeText(link);
      setApprovalLink(link);
      toast.success("Parent link copied", { description: link });
    },
    onError: (e: unknown) =>
      toast.error("Couldn't create the link", {
        description: e instanceof Error ? e.message : "Please try again.",
      }),
  });

  const data = q.data;
  const meta = data ? categoryMeta(data.plan.category) : null;

  const myParticipant = useMemo(
    () => data?.participants.find((p) => p.profile_id === data.meProfileId),
    [data],
  );
  const responded = data?.participants.filter((p) => p.responded).length ?? 0;
  const total = data?.participants.length ?? 0;
  // Must stay above the loading guard — hooks cannot run conditionally.
  const summaries = useCompromiseSummaries(planId, (data?.recommendations.length ?? 0) > 0);

  // Memoized for the same reason as Radar's pin arrays: VenueMap's marker
  // effect keys off this array's identity and tears down/rebuilds every
  // marker when it changes, so an inline .filter().map() here would rebuild
  // the whole venue map on every unrelated re-render of this page (there are
  // several pieces of local state above that do just that).
  const venueMapVenues = useMemo(() => {
    const recs = data?.recommendations ?? [];
    const selectedId = data?.plan.selected_recommendation_id;
    const category = data?.plan.category;
    return recs
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
        selected: selectedId === r.id,
        kind:
          ((r.breakdown ?? {}) as unknown as ScoreBreakdown).venue?.kind ??
          (category === "dinner" ? "food" : "activity"),
      }));
  }, [data?.recommendations, data?.plan.selected_recommendation_id, data?.plan.category]);

  // "Best match" (server rank) vs "Best for budget" — a first-class, one-tap
  // reorder rather than a hidden menu. Client-side only: same recommendation
  // set, just resorted by the engine's already-computed budgetFit.
  const [recSort, setRecSort] = useState<"match" | "budget">("match");
  const sortedRecs = useMemo(() => {
    const list = [...(data?.recommendations ?? [])];
    if (recSort === "budget") {
      list.sort((a, b) => {
        const bf = (r: typeof a) =>
          ((r.breakdown ?? {}) as unknown as ScoreBreakdown).budgetFit ?? 0;
        return bf(b) - bf(a);
      });
    }
    return list;
  }, [data?.recommendations, recSort]);

  if (q.isLoading || !data || !meta) {
    return (
      <>
        <PageHeader title="Plan" />
        <Skeleton className="h-40 rounded-3xl" />
      </>
    );
  }

  const votes = data.votes;
  const selected = data.plan.selected_recommendation_id;
  const headcount = Math.max(total, 1);
  const attendeeNames = data.participants
    .filter((p) => p.attending !== false)
    .map((p) =>
      alias(
        p.profile_id,
        (p.profiles as { display_name?: string } | null)?.display_name ?? "Member",
      ),
    );
  const cars = data.transport.map((t) => ({
    label: t.car_label,
    driver: t.driver_label ?? "A driver",
  }));
  const selectedRec = data.recommendations.find((r) => r.id === selected) ?? null;
  const topRec = selectedRec ?? data.recommendations[0] ?? null;
  const topBudgetFit = topRec
    ? (((topRec.breakdown ?? {}) as unknown as ScoreBreakdown).budgetFit ?? null)
    : null;

  const backupRec =
    data.recommendations.find((r) => r.id !== selected && r.feasible) ??
    data.recommendations.find((r) => r.id !== selected) ??
    null;
  const latestApproval = data.approvals[0]?.status ?? null;

  return (
    <>
      <PageHeader
        title={data.plan.title}
        subtitle={`${meta.label} · ${responded} of ${total} have answered privately`}
      />
      <SwipeBack>
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

        <CarpoolShield
          planId={data.plan.id}
          rides={data.transport}
          meProfileId={data.meProfileId}
        />

        {data.plan.created_by === data.meProfileId ? (
          <Card className="border-primary/25 bg-primary/[0.06]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="flex items-center gap-1.5 font-semibold">
                  <Crown className="size-4 text-warning" aria-hidden /> You organized this plan
                </p>
                <p className="text-sm text-muted-foreground">
                  {total - responded > 0
                    ? `Waiting for ${total - responded} squad response${total - responded === 1 ? "" : "s"}`
                    : "Everyone has responded — you're good to lock it in."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <CostBadge min={data.plan.est_cost_min} max={data.plan.est_cost_max} />
                <BudgetFitPill budgetFit={topBudgetFit} />
                <Button variant="outline" onClick={() => setEditing((v) => !v)}>
                  <Pencil className="size-4" aria-hidden /> {editing ? "Close" : "Edit Plan"}
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">
                  {myParticipant?.responded && myParticipant.attending !== false
                    ? "You're in for this one"
                    : myParticipant?.responded
                      ? "You flagged this — the host is adjusting"
                      : "Does this work for you?"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Two taps, no survey. Your reason stays private to you.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <CostBadge min={data.plan.est_cost_min} max={data.plan.est_cost_max} />
                <BudgetFitPill budgetFit={topBudgetFit} />
              </div>
            </div>
            <QuickResponse planId={planId} className="mt-3" />
            <button
              type="button"
              className="mt-3 text-xs font-medium text-primary underline-offset-4 hover:underline"
              onClick={() => setEditing((v) => !v)}
            >
              {editing ? "Hide extra details" : "Add optional details (budget, curfew, ride)"}
            </button>
          </Card>
        )}

        {editing ? (
          <div className="mt-4">
            <ConstraintForm
              questionnaire={meta.questionnaire}
              initial={data.myConstraints}
              saving={submit.isPending}
              onSubmit={(payload) => submit.mutate({ data: { planId, payload } })}
            />
          </div>
        ) : null}

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
              loading={generate.isPending}
              orb="searching"
              className="shrink-0"
              onClick={() => generate.mutate({ data: { planId, shuffle } })}
            >
              {generate.isPending ? "Finding fair spots…" : "Find options"}
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {data.participants.map((p) => {
              const prof = p.profiles as {
                display_name?: string;
                avatar_emoji?: string;
                avatar_url?: string | null;
              } | null;
              return (
                <span
                  key={p.profile_id}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${
                    p.responded
                      ? "bg-success/15 text-success"
                      : "bg-secondary text-muted-foreground"
                  }`}
                  title={p.responded ? "Completed questionnaire" : "Pending input"}
                >
                  <Avatar
                    url={prof?.avatar_url}
                    emoji={prof?.avatar_emoji}
                    name={alias(p.profile_id, prof?.display_name)}
                    size={18}
                    className="bg-transparent"
                  />
                  <button type="button" onClick={() => openFriend(p.profile_id)}>
                    {alias(p.profile_id, prof?.display_name)}
                  </button>
                  <span className="opacity-75">
                    · {p.responded ? (selected ? "Ready" : "Answered") : "Pending"}
                  </span>
                </span>
              );
            })}
          </div>
        </Card>

        <div className="mt-4 space-y-3">
          <SpotBrowser
            groupId={data.plan.group_id}
            planId={planId}
            canAdd={data.plan.created_by === data.meProfileId}
            onAdded={() => void invalidate()}
          />
          <PlanConflictBanner planId={planId} title={data.plan.title} recs={data.recommendations} />
          {data.recommendations.length > 0 ? <PlanBGuardian planId={planId} /> : null}
          <PlanInsights planId={planId} />
        </div>

        {data.recommendations.length > 0 ? (
          <section className="mt-8 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-muted-foreground">
                Top 3 options that work for everyone
              </h2>
              <div className="inline-flex rounded-full bg-secondary p-0.5 text-xs font-medium">
                {(
                  [
                    { id: "match", label: "Best match" },
                    { id: "budget", label: "Best for budget" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setRecSort(opt.id)}
                    className={`rounded-full px-3 py-1.5 transition ${
                      recSort === opt.id
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <AiCompromiseBanner
              planId={planId}
              isHost={data.plan.created_by === data.meProfileId}
              enabled={data.recommendations.length > 0}
            />
            <VenueMap venues={venueMapVenues} />
            {sortedRecs.map((r) => {
              const b = (r.breakdown ?? {}) as unknown as ScoreBreakdown;
              const myVote = votes.find(
                (v) => v.profile_id === data.meProfileId,
              )?.recommendation_id;
              const count = votes.filter((v) => v.recommendation_id === r.id).length;
              const isSelected = selected === r.id;
              return (
                <Card
                  key={r.id}
                  className={isSelected ? "border-primary/60 ring-1 ring-primary/25" : undefined}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      {b.optionLabel ? (
                        <p className="mb-1 text-caption font-semibold text-primary">
                          {b.optionLabel.emoji} {b.optionLabel.title}
                        </p>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-lg font-semibold">{r.title}</h3>
                        {r.feasible ? (
                          <Pill tone="good">Works for everyone</Pill>
                        ) : (
                          <Pill tone="bad">Doesn't work for everyone</Pill>
                        )}
                        <BudgetFitPill budgetFit={b.budgetFit} />
                        {isSelected ? <Pill tone="accent">Chosen</Pill> : null}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{r.subtitle}</p>
                      <button
                        type="button"
                        className="mt-2 block w-full overflow-hidden rounded-2xl text-left"
                        aria-label={`Photos and reviews for ${r.title}`}
                        onClick={() =>
                          setVenueDetail({
                            key: r.id,
                            title: r.title,
                            address: b.venue?.address ?? r.location_name,
                            subtitle: r.subtitle,
                            cuisine: b.venue?.cuisine ?? null,
                            category: r.category,
                            kind: b.venue?.kind ?? null,
                            priceLevel: b.venue?.priceLevel ?? null,
                            lat: r.lat ?? b.venue?.lat ?? null,
                            lon: r.lon ?? b.venue?.lon ?? null,
                          })
                        }
                      >
                        <span className="relative block">
                          <img
                            src={venuePhoto({
                              title: r.title,
                              cuisine: b.venue?.cuisine ?? null,
                              subtitle: r.subtitle,
                              category: r.category,
                              kind: b.venue?.kind ?? null,
                            })}
                            alt={`${r.title} — ${b.venue?.cuisine ?? r.category}`}
                            loading="lazy"
                            className="h-32 w-full object-cover transition active:scale-[0.98] hover:scale-[1.02]"
                          />
                          <span className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/70 to-transparent p-2">
                            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-caption font-semibold text-white backdrop-blur">
                              {b.venue?.rating != null ? (
                                <>
                                  <Star className="size-3 fill-current" aria-hidden />{" "}
                                  {b.venue.rating}
                                </>
                              ) : (
                                venueStats(r.id).ratingLabel
                              )}
                            </span>
                            <span className="rounded-full bg-white/15 px-2 py-0.5 text-caption font-semibold text-white backdrop-blur">
                              {b.venue?.priceLevel ?? "$$"}
                            </span>
                          </span>
                        </span>
                      </button>
                      <CompromiseNote text={summaries.data?.[r.id]} />
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {b.venue?.cuisine ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-caption font-medium">
                            {b.venue.kind === "activity" ? (
                              <Activity className="size-3" aria-hidden />
                            ) : (
                              <Utensils className="size-3" aria-hidden />
                            )}
                            {b.venue.cuisine}
                          </span>
                        ) : null}
                        {b.venue?.priceLevel ? (
                          <span className="rounded-full bg-secondary px-2 py-0.5 text-caption font-semibold tabular-nums">
                            {b.venue.priceLevel}
                          </span>
                        ) : null}
                        {b.venue?.rating != null ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-caption tabular-nums">
                            <Star className="size-3 fill-current" aria-hidden /> {b.venue.rating}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        ${r.cost_min}–${r.cost_max} · {r.suggested_start}–{r.suggested_end} ·{" "}
                        {r.travel_minutes} min drive
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {b.venue?.address ?? r.location_name}
                        {b.venue?.distanceMiles != null
                          ? ` · ${b.venue.distanceMiles} miles away`
                          : ""}
                      </p>
                      {b.fair?.drives?.length ? (
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          {b.fair.drives
                            .map((d) => `${d.miles} mi for ${d.name.split(" ")[0]}`)
                            .join(" • ")}
                        </p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {b.fair && b.fair.drives.length ? (
                          <Pill tone="accent">
                            <MapPin className="size-3.5" aria-hidden />{" "}
                            {b.fair.spreadMinutes <= 6
                              ? `Equal ~${b.fair.avgMinutes} min drive for everyone`
                              : `~${b.fair.avgMinutes} min average drive`}
                          </Pill>
                        ) : null}
                        {b.fair ? (
                          b.fair.curfewOk ? (
                            <Pill tone="good">
                              <CheckCircle2 className="size-3.5" aria-hidden /> Works with
                              everyone's curfew
                            </Pill>
                          ) : (
                            <Pill tone="warn">{b.fair.curfewNote}</Pill>
                          )
                        ) : null}
                      </div>

                      <a
                        href={directionsUrl({
                          lat: r.lat ?? b.venue?.lat ?? null,
                          lon: r.lon ?? b.venue?.lon ?? null,
                          address: b.venue?.address ?? r.location_name,
                          title: r.title,
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
                      >
                        <Compass className="size-3.5" aria-hidden /> Directions in Maps
                      </a>
                      <button
                        type="button"
                        className="mt-1.5 ml-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground underline-offset-4 hover:underline"
                        onClick={() =>
                          setVenueDetail({
                            key: r.id,
                            title: r.title,
                            address: b.venue?.address ?? r.location_name,
                            subtitle: r.subtitle,
                            cuisine: b.venue?.cuisine ?? null,
                            category: r.category,
                            kind: b.venue?.kind ?? null,
                            priceLevel: b.venue?.priceLevel ?? null,
                            lat: r.lat ?? b.venue?.lat ?? null,
                            lon: r.lon ?? b.venue?.lon ?? null,
                          })
                        }
                      >
                        Reviews & photos
                      </button>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-display text-2xl font-semibold tabular-nums">
                        {r.score}%
                      </div>
                      <div className="text-caption text-muted-foreground">Overall Match</div>
                      {b.venue?.distanceMiles != null ? (
                        <div className="mt-0.5 text-caption text-muted-foreground tabular-nums">
                          {b.venue.distanceMiles} mi
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                    <Meter label="Preference fit" value={b.overallFit ?? 0} />
                    <Meter label="Fairness" value={b.fairness ?? 0} />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Overall Match is 62% preference fit, 28% fairness, 10% ride coverage. Budget,
                    schedule, dietary and travel needs are pass/fail requirements, already reflected
                    in "{r.feasible ? "Works for everyone" : "Doesn't work for everyone"}" above.
                  </p>

                  {(() => {
                    const cost = estimateCost({
                      costMin: r.cost_min ?? 0,
                      costMax: r.cost_max ?? 0,
                      travelMinutes: r.travel_minutes ?? 0,
                      distanceMiles: b.venue?.distanceMiles ?? null,
                      category: data.plan.category,
                      headcount,
                      requiresDriving: b.requiresDriving,
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
                        <li key={x} className="flex items-start gap-1.5 text-muted-foreground">
                          <Check className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden />
                          {x}
                        </li>
                      ))}
                      {(b.cautions ?? []).map((x) => (
                        <li key={x} className="flex items-start gap-1.5 text-muted-foreground">
                          <AlertTriangle
                            className="mt-0.5 size-3.5 shrink-0 text-warning"
                            aria-hidden
                          />
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
                        onClick={() =>
                          finalize.mutate({ data: { planId, recommendationId: r.id } })
                        }
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

            <div className="flex justify-center">
              <Button
                variant="ghost"
                loading={generate.isPending}
                orb="searching"
                onClick={() => {
                  const next = shuffle + 1;
                  setShuffle(next);
                  generate.mutate({ data: { planId, shuffle: next } });
                }}
              >
                <Shuffle className="size-4" aria-hidden /> Shuffle · load 3 different options
              </Button>
            </div>

            <p className="px-1 text-xs text-muted-foreground">
              Only options that clear everyone's distance, curfew, and opening-hours limits are
              shown. Syncly never reveals whose constraint ruled an option out.
            </p>
          </section>
        ) : null}

        {data.transport.length > 0 ? (
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Getting there</h2>
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
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Parent permission</h2>
          <Card>
            <p className="text-sm text-muted-foreground">
              Send a parent a link with only the details they need: what, where, when, and how
              you're getting home. They can approve, approve with a condition, or decline — no
              account required.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                disabled={askParent.isPending}
                onClick={() => askParent.mutate({ data: { planId } })}
              >
                {askParent.isPending ? "Creating…" : "Create approval link"}
              </Button>
              <Button
                disabled={shareSummary.isPending}
                onClick={() => shareSummary.mutate({ data: { planId } })}
              >
                {shareSummary.isPending ? "Creating…" : "Share parent summary link"}
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

        <VenueDetailModal venue={venueDetail} onClose={() => setVenueDetail(null)} />
        <ConciergeSheet
          planId={planId}
          planTitle={data.plan.title}
          groupId={data.plan.group_id}
          isHost={data.plan.created_by === data.meProfileId}
        />
        <ChatDrawer groupId={data.plan.group_id} planId={planId} />
      </SwipeBack>
    </>
  );
}
