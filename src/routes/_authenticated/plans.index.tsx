import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  BellOff,
  Car,
  CheckCircle2,
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
import { AppShell } from "@/components/quorum/AppShell";
import { Avatar } from "@/components/quorum/Avatar";
import { Empty, Pill, Skeleton, Button } from "@/components/quorum/ui";
import {
  Magnetic,
  PullToRefresh,
  SpotlightCard,
  SwipeRow,
} from "@/components/quorum/interactions";
import { getDashboard } from "@/lib/quorum/plan.functions";
import { confirmAttendance } from "@/lib/quorum/conflict.functions";
import { categoryIcon } from "@/lib/quorum/icons";
import { estCostLabel } from "@/lib/quorum/estcost";


export const Route = createFileRoute("/_authenticated/plans/")({
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
  component: PlansPage,
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

function PlansPage() {
  const dash = useQuery({ queryKey: ["dashboard"], queryFn: useServerFn(getDashboard) });
  const qc = useQueryClient();
  const now = useNow();
  const plans = dash.data?.plans ?? [];
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
    <AppShell title="Plans" subtitle="Everything your groups are working out right now.">
      {dash.isLoading ? <Skeleton className="h-40 rounded-3xl" /> : null}

      {!dash.isLoading && plans.length === 0 ? (
        <Empty
          title="Nothing planned"
          body="Plans start inside a group so the right people get asked."
          action={
            <Link to="/groups">
              <Button>
                <Users className="size-4" /> Go to groups
              </Button>
            </Link>
          }
        />
      ) : null}

      <PullToRefresh onRefresh={() => dash.refetch()}>
        <div className="mx-auto w-full max-w-4xl space-y-4">
          {plans.map((p, i) => (
            <SwipeRow
              key={p.id}
              disabled={p.status === "finalized" || p.status === "completed"}
              left={{
                label: "I'm in",
                icon: <ThumbsUp className="size-4" />,
                tone: "primary",
                onAction: () => attend.mutate({ data: { planId: p.id, attending: true } }),
              }}
              right={{
                label: "Mute",
                icon: <BellOff className="size-4" />,
                tone: "muted",
                onAction: () => {
                  setMuted((m) => (m.includes(p.id) ? m : [...m, p.id]));
                  toast("Muted — you won't get pings for this plan");
                },
              }}
            >
              <PlanCard plan={p} now={now} index={i} muted={muted.includes(p.id)} />
            </SwipeRow>
          ))}
        </div>
      </PullToRefresh>
      <p className="mt-4 text-center text-xs text-muted-foreground md:hidden">
        Swipe a plan right to join · left to mute
      </p>
    </AppShell>
  );
}

function PlanCard({
  plan,
  now,
  index,
  muted = false,
}: {
  plan: DashPlan;
  now: number;
  index: number;
  muted?: boolean;
}) {
  const Icon = categoryIcon(plan.category);
  const group = plan.groups as { name?: string; emoji?: string } | null;
  const finalized = plan.status === "finalized" || plan.status === "completed";
  const rec = plan.selected_recommendation as
    | { title?: string; address?: string | null; location_name?: string | null }
    | null;

  const total = Math.max(plan.participant_count, 1);
  const votedPct = Math.round((plan.responded_count / total) * 100);
  const cost = estCostLabel(plan.est_cost_min, plan.est_cost_max)?.replace("💵 ", "") ?? null;
  const left = finalized ? null : countdown(plan.window_start, now);
  const when = whenLabel(plan.window_start);
  const curfew = curfewState(plan.window_end);

  return (
    <SpotlightCard
      as="article"
      tilt
      className={`surface rounded-3xl border border-border/70 p-5 shadow-xl backdrop-blur-xl transition-colors hover:border-primary/40 ${
        muted ? "opacity-60" : ""
      }`}
    >
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 26, delay: Math.min(index, 6) * 0.04 }}
      >
      {/* Top bar */}

      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
            <Icon className="size-4" />
          </span>
          <span className="truncate text-xs font-medium text-muted-foreground">
            {group?.name ?? "Your squad"}
          </span>
          <Crown className="size-3.5 shrink-0 text-warning" />
        </div>
        {finalized ? (
          <Pill tone="good">
            <Lock className="size-3.5" /> Locked in
          </Pill>
        ) : (
          <Pill tone="accent" className="animate-pulse">
            <Zap className="size-3.5" /> Voting active
          </Pill>
        )}
      </div>

      {/* Hero */}
      <h3 className="mt-3 font-display text-lg font-semibold">{plan.title}</h3>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
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

      {/* Consensus */}
      <div className="mt-4">
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
            className="h-full rounded-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${votedPct}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          />
        </div>
      </div>

      {/* Members + badges */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
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
            <span className="grid size-[30px] place-items-center rounded-full bg-secondary text-[10px] font-semibold ring-2 ring-background">
              +{plan.participants.length - 5}
            </span>
          ) : null}
        </div>

        {plan.conflicts.length > 0 ? (
          <Pill tone="bad">
            <XCircle className="size-3.5" /> {plan.conflicts.length} conflict
            {plan.conflicts.length > 1 ? "s" : ""}
          </Pill>
        ) : null}

        {curfew === "ok" ? (
          <Pill tone="good">
            <CheckCircle2 className="size-3.5" /> Curfew compliant
          </Pill>
        ) : curfew === "warn" ? (
          <Pill tone="warn">
            <Clock className="size-3.5" /> Curfew warning (past 10 PM)
          </Pill>
        ) : null}

        {left ? (
          <Pill tone="accent">
            <Clock className="size-3.5" /> {left}
          </Pill>
        ) : null}
      </div>

      {/* Carpool quick bar */}
      {plan.rides.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {plan.rides.slice(0, 3).map((r) => (
            <span
              key={r.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs"
            >
              <Car className="size-3.5 text-primary" />
              {r.driver_name ? `${r.driver_name} driving` : r.car_label} • {r.seats_taken} riders
            </span>
          ))}
        </div>
      ) : null}

      <Link to="/plans/$planId" params={{ planId: plan.id }} className="mt-4 block">
        <Button className="w-full active:scale-95">
          Open plan dashboard <ArrowRight className="size-4" />
        </Button>
      </Link>
    </motion.article>
  );
}
