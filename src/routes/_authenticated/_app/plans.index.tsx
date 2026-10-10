import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { toast } from "@/lib/quorum/toast";
import {
  ArrowRight,
  BellOff,
  Car,
  CheckCircle2,
  ChevronDown,
  Clock,
  Crown,
  DollarSign,
  Lock,
  MapPin,
  ThumbsUp,
  Users,
  XCircle,
  Zap,
} from "lucide-react";
import { PageHeader } from "@/components/quorum/AppShell";
import { Avatar } from "@/components/quorum/Avatar";
import { Empty, Pill, Skeleton, Button } from "@/components/quorum/ui";
import { PullToRefresh, SpotlightCard, SwipeRow } from "@/components/quorum/interactions";
import { getDashboard } from "@/lib/quorum/plan.functions";
import { confirmAttendance } from "@/lib/quorum/conflict.functions";
import { categoryIcon } from "@/lib/quorum/icons";
import { estCostLabel } from "@/lib/quorum/estcost";
import { ListSearch, ListFilters } from "@/components/quorum/ListControls";
import { BudgetFitPill } from "@/components/quorum/DashboardParts";

export const Route = createFileRoute("/_authenticated/_app/plans/")({
  loader: ({ context }) => {
    void context.queryClient.ensureQueryData({
      queryKey: ["dashboard"],
      queryFn: () => getDashboard(),
    });
  },
  head: () => ({
    meta: [
      { title: "All plans — Syncly" },
      {
        name: "description",
        content: "Every plan across your groups: collecting answers, open for votes, or locked in.",
      },
      { property: "og:title", content: "All plans — Syncly" },
      { property: "og:description", content: "Every plan across your groups in one place." },
    ],
  }),
  component: () => null,
});

type DashPlan = Awaited<ReturnType<typeof getDashboard>>["plans"][number];

/** Ticks every 30s so countdowns stay live without a per-card timer. */
function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}

const isEnded = (status: string) => status === "completed" || status === "cancelled";

function countdown(target: string | null | undefined, now: number) {
  if (!target) return null;
  const diff = new Date(target).getTime() - now;
  if (Number.isNaN(diff) || diff <= 0) return null;
  const mins = Math.floor(diff / 60_000);
  const days = Math.floor(mins / 1440);
  if (days >= 1) return `${days}d ${Math.floor((mins % 1440) / 60)}h left to vote`;
  const h = Math.floor(mins / 60);
  return h >= 1 ? `${h}h ${mins % 60}m left to vote` : `${mins}m left to vote`;
}

function whenLabel(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return sameDay
    ? `Today @ ${time}`
    : `${d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} @ ${time}`;
}

/** Simple curfew guard: anything landing past 10 PM gets flagged for review. */
function curfewState(endIso: string | null | undefined) {
  if (!endIso) return null;
  const d = new Date(endIso);
  if (Number.isNaN(d.getTime())) return null;
  const past10 = d.getHours() >= 22 || d.getHours() < 4;
  return past10 ? ("warn" as const) : ("ok" as const);
}

const PLAN_FILTERS = [
  { id: "all", label: "All plans" },
  { id: "live", label: "Live" },
  { id: "finalized", label: "Locked in" },
  { id: "past", label: "Past plans" },
] as const;

export function PlansPage() {
  const dash = useQuery({ queryKey: ["dashboard"], queryFn: useServerFn(getDashboard) });
  const qc = useQueryClient();
  const now = useNow();
  // Ended plans sink below live ones; sort is stable so recency order holds.
  const plans = [...(dash.data?.plans ?? [])].sort(
    (a, b) => Number(isEnded(a.status)) - Number(isEnded(b.status)),
  );
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<(typeof PLAN_FILTERS)[number]["id"]>("all");
  const shown = plans.filter((plan) => {
    const text = `${plan.title} ${plan.groups?.name ?? ""}`.toLocaleLowerCase();
    return (
      text.includes(search.trim().toLocaleLowerCase()) &&
      (filter === "all" ||
        (filter === "live" && !isEnded(plan.status)) ||
        (filter === "finalized" && plan.status === "finalized") ||
        (filter === "past" && isEnded(plan.status)))
    );
  });
  const [muted, setMuted] = useState<string[]>([]);

  const attend = useMutation({
    mutationFn: useServerFn(confirmAttendance),
    onSuccess: () => {
      toast.success("You're in 🎉");
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Plans"
        subtitle={
          plans.length > 0 && plans.every((p) => isEnded(p.status))
            ? "Nothing live right now. Past plans are below."
            : "Everything your groups are working out right now."
        }
      />
      <ListSearch value={search} onChange={setSearch} label="Search plans or squads" />
      <ListFilters
        options={PLAN_FILTERS}
        value={filter}
        onChange={setFilter}
        label="Filter plans"
      />
      {!dash.isLoading && !dash.isError && plans.length > 0 && shown.length === 0 ? (
        <Empty
          title="No matching plans"
          body="Try another search or show all your plans."
          action={
            <Button
              variant="outline"
              onClick={() => {
                setSearch("");
                setFilter("all");
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : null}
      {dash.isLoading ? <Skeleton className="h-40 rounded-surface" /> : null}

      {dash.isError ? (
        <Empty
          title="Couldn't load your plans"
          body="Check your connection and try again."
          action={<Button onClick={() => dash.refetch()}>Try again</Button>}
        />
      ) : null}

      {!dash.isLoading && !dash.isError && plans.length === 0 ? (
        <Empty
          title="Nothing planned"
          body="Plans start inside a group so the right people get asked."
          action={
            <Link
              to="/groups"
              className="tap-target pressable inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              <Users className="size-4" aria-hidden /> Go to groups
            </Link>
          }
        />
      ) : null}

      <PullToRefresh onRefresh={() => dash.refetch()}>
        <div className="mx-auto w-full max-w-4xl space-y-4">
          {shown.map((p, i) => (
            <SwipeRow
              key={p.id}
              disabled={attend.isPending || p.status === "finalized" || isEnded(p.status)}
              left={{
                label: "I'm in",
                icon: <ThumbsUp className="size-4" />,
                tone: "primary",
                onAction: () => attend.mutate({ data: { planId: p.id, attending: true } }),
              }}
              right={{
                label: muted.includes(p.id) ? "Restore" : "Dim",
                icon: <BellOff className="size-4" />,
                tone: "muted",
                onAction: () => {
                  if (muted.includes(p.id)) {
                    setMuted((m) => m.filter((id) => id !== p.id));
                  } else {
                    setMuted((m) => [...m, p.id]);
                    toast("Plan dimmed for this visit", {
                      action: {
                        label: "Undo",
                        onClick: () => setMuted((m) => m.filter((id) => id !== p.id)),
                      },
                    });
                  }
                },
              }}
            >
              <PlanCard
                plan={p}
                now={now}
                index={i}
                muted={muted.includes(p.id) || isEnded(p.status)}
                myProfileId={dash.data?.myProfileId ?? null}
              />
            </SwipeRow>
          ))}
        </div>
      </PullToRefresh>
      <p className="mt-4 text-center text-xs text-muted-foreground md:hidden">
        Swipe a plan right to join · left to dim
      </p>
    </>
  );
}

/**
 * A plan card used to stack up to five simultaneous badges (voting/locked,
 * budget fit, conflicts, curfew, countdown) plus a full metadata row and a
 * carpool strip -- all visible at once. `primaryPill` collapses that down to
 * the single most urgent thing a glance actually needs; everything else
 * (location, cost, consensus %, budget fit, and any status that isn't the
 * one shown) moves behind the "Details" disclosure below, the same
 * tap-to-reveal pattern TeenSafetyBar's "Safety tools" already uses.
 */
function primaryPill(args: {
  status: string;
  finalized: boolean;
  conflictCount: number;
  curfew: "ok" | "warn" | null;
  left: string | null;
}): { tone: "good" | "bad" | "warn" | "accent" | "neutral"; icon: typeof Lock; label: string } {
  if (args.status === "completed") return { tone: "good", icon: CheckCircle2, label: "Completed" };
  if (args.status === "cancelled") return { tone: "neutral", icon: Clock, label: "Expired" };
  if (args.finalized) return { tone: "good", icon: Lock, label: "Locked in" };
  if (args.conflictCount > 0) {
    return {
      tone: "bad",
      icon: XCircle,
      label: `${args.conflictCount} conflict${args.conflictCount > 1 ? "s" : ""}`,
    };
  }
  if (args.curfew === "warn") return { tone: "warn", icon: Clock, label: "Curfew warning" };
  if (args.left) return { tone: "accent", icon: Clock, label: args.left };
  return { tone: "accent", icon: Zap, label: "Voting active" };
}

function PlanCard({
  plan,
  now,
  index,
  muted = false,
  myProfileId,
}: {
  plan: DashPlan;
  now: number;
  index: number;
  muted?: boolean;
  myProfileId: string | null;
}) {
  const reduce = useReducedMotion();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const Icon = categoryIcon(plan.category);
  const group = plan.groups as { name?: string; emoji?: string } | null;
  const finalized = plan.status === "finalized" || plan.status === "completed";
  const rec = plan.selected_recommendation as {
    title?: string;
    address?: string | null;
    location_name?: string | null;
  } | null;

  const total = Math.max(plan.participant_count, 1);
  const votedPct = Math.round((plan.responded_count / total) * 100);
  const cost = estCostLabel(plan.est_cost_min, plan.est_cost_max);
  const left = finalized || isEnded(plan.status) ? null : countdown(plan.window_start, now);
  const when = whenLabel(plan.window_start);
  const curfew = curfewState(plan.window_end);
  const isOrganizer = Boolean(myProfileId) && plan.created_by === myProfileId;
  const conflictCount = plan.conflicts.length;
  const pill = primaryPill({ status: plan.status, finalized, conflictCount, curfew, left });
  // Anything not already surfaced as the one primary pill still belongs in
  // the details disclosure below, so a real curfew warning or countdown
  // never silently disappears just because a conflict took the primary slot.
  const showCurfewInDetails = curfew === "warn" && pill.label !== "Curfew warning";
  const showCountdownInDetails = Boolean(left) && pill.label !== left;
  const showConflictsInDetails = conflictCount > 0 && !pill.label.includes("conflict");
  const hasDetails =
    Boolean(rec?.title || rec?.address || plan.location_area) ||
    Boolean(cost) ||
    plan.compatibility_score != null ||
    Boolean(plan.budget_fit) ||
    showCurfewInDetails ||
    showCountdownInDetails ||
    showConflictsInDetails ||
    plan.rides.length > 0;

  return (
    <SpotlightCard
      as="article"
      // .surface already supplies background/border/radius/blur -- the old
      // rounded-3xl + border-border/70 + backdrop-blur-xl here were
      // redundant, cascade-order-dependent overrides of the same properties.
      className={`surface p-5 shadow-xl transition-colors hover:border-primary/40 ${
        muted ? "opacity-60" : ""
      }`}
    >
      <motion.div
        initial={reduce ? false : { opacity: 0, transform: "translateY(6px)" }}
        animate={{ opacity: 1, transform: "translateY(0px)" }}
        transition={{
          duration: 0.18,
          ease: [0.23, 1, 0.32, 1],
          delay: Math.min(index, 3) * 0.025,
        }}
      >
        {/* Top bar -- one priority pill instead of stacking voting/locked +
          budget-fit side by side; everything else that used to compete for
          this row lives in the details disclosure below. */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
              <Icon className="size-4" />
            </span>
            <span className="truncate text-xs font-medium text-muted-foreground">
              {group?.name ?? "Your squad"}
            </span>
            {isOrganizer ? (
              <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground">
                <Crown className="size-3.5 text-primary" aria-hidden /> Organizer
              </span>
            ) : null}
          </div>
          <Pill tone={pill.tone} className="shrink-0">
            <pill.icon className="size-3.5" aria-hidden /> {pill.label}
          </Pill>
        </div>

        {/* Hero */}
        <h3 className="mt-3 font-display text-lg font-semibold">{plan.title}</h3>

        {/* Members + details toggle -- avatar stack stays visible (who's in,
          at a glance); location/cost/consensus/budget-fit/carpool and any
          status not already shown above wait behind this tap, the same
          disclosure pattern TeenSafetyBar uses for its "Safety tools". */}
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex -space-x-2">
            {plan.participants.slice(0, 5).map((m) => (
              <span key={m.profile_id} className="relative">
                <Avatar
                  url={m.avatar_url}
                  emoji={m.emoji}
                  name={m.name}
                  size={30}
                  className="ring-2 ring-background"
                />
                {m.responded ? (
                  <CheckCircle2 className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full bg-background text-success" />
                ) : null}
              </span>
            ))}
            {plan.participants.length > 5 ? (
              <span className="grid size-[30px] place-items-center rounded-full bg-secondary text-caption font-semibold ring-2 ring-background">
                +{plan.participants.length - 5}
              </span>
            ) : null}
          </div>

          {hasDetails ? (
            <button
              type="button"
              onClick={() => setDetailsOpen((v) => !v)}
              aria-expanded={detailsOpen}
              className="tap-target inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
            >
              Details
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${detailsOpen ? "rotate-180" : ""}`}
                aria-hidden
              />
            </button>
          ) : null}
        </div>

        {hasDetails && detailsOpen ? (
          <div className="mt-4 space-y-4 border-t border-border/60 pt-4">
            {rec?.title || rec?.address || plan.location_area || cost || when ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                {rec?.title || rec?.address || plan.location_area ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" />
                    {rec?.title ?? rec?.location_name ?? plan.location_area}
                    {rec?.address ? ` • ${rec.address}` : ""}
                  </span>
                ) : null}
                {cost ? (
                  <span className="inline-flex items-center gap-1">
                    <DollarSign className="size-3.5" />
                    {cost}
                  </span>
                ) : null}
                {when ? (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3.5" />
                    {when}
                  </span>
                ) : null}
              </div>
            ) : null}

            {/* Consensus */}
            <div>
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-muted-foreground">
                  {plan.responded_count} of {plan.participant_count} voted
                  {plan.compatibility_score != null
                    ? ` • ${plan.compatibility_score}% fair point match`
                    : ""}
                </span>
                <span className="font-semibold tabular-nums">{votedPct}%</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
                <motion.div
                  className="h-full w-full origin-left rounded-full bg-primary"
                  initial={false}
                  animate={{ transform: `scaleX(${votedPct / 100})` }}
                  transition={{ type: "spring", stiffness: 320, damping: 34 }}
                />
              </div>
            </div>

            {plan.budget_fit ||
            showConflictsInDetails ||
            curfew === "ok" ||
            showCurfewInDetails ||
            showCountdownInDetails ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <BudgetFitPill budgetFit={plan.budget_fit} />
                {showConflictsInDetails ? (
                  <Pill tone="bad">
                    <XCircle className="size-3.5" /> {conflictCount} conflict
                    {conflictCount > 1 ? "s" : ""}
                  </Pill>
                ) : null}
                {curfew === "ok" ? (
                  <Pill tone="good">
                    <CheckCircle2 className="size-3.5" /> Curfew compliant
                  </Pill>
                ) : showCurfewInDetails ? (
                  <Pill tone="warn">
                    <Clock className="size-3.5" /> Curfew warning (past 10 PM)
                  </Pill>
                ) : null}
                {showCountdownInDetails ? (
                  <Pill tone="accent">
                    <Clock className="size-3.5" /> {left}
                  </Pill>
                ) : null}
              </div>
            ) : null}

            {/* Carpool quick bar */}
            {plan.rides.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {plan.rides.slice(0, 3).map((r) => (
                  <span
                    key={r.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs"
                  >
                    <Car className="size-3.5 text-primary" />
                    {r.driver_name ? `${r.driver_name} driving` : r.car_label} • {r.seats_taken}{" "}
                    riders
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <Link
          to="/plans/$planId"
          params={{ planId: plan.id }}
          className="tap-target pressable mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-92"
        >
          Open plan dashboard <ArrowRight className="size-4" aria-hidden />
        </Link>
      </motion.div>
    </SpotlightCard>
  );
}
