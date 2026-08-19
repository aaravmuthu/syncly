import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Sparkles, KeyRound } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { AppShell } from "@/components/quorum/AppShell";
import { TeenSafetyBar } from "@/components/quorum/guardian/TeenSafetyBar";
import { Button, Empty, Skeleton } from "@/components/quorum/ui";
import { ConflictCard, QuickActions } from "@/components/quorum/ConflictCard";
import { JoinGroupModal } from "@/components/quorum/JoinGroupModal";
import {
  ActionCard,
  AvatarStack,
  ConfirmedCard,
  Glass,
  GroupsRail,
  MapThumb,
  Progress,
  StatusTag,
  WeatherChip,
  WeekStrip,
  dayKey,
  formatWhen,
  startOfWeek,
  CostBadge,
  type DashPlan,
} from "@/components/quorum/DashboardParts";
import { takePendingInvite } from "@/lib/quorum/invite";
import { getMe, getDashboard, listGroups } from "@/lib/quorum/plan.functions";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Your week — Syncly" },
      {
        name: "description",
        content:
          "A weekly timeline of your group plans: what needs your private answer, what's up for a vote, and what's already locked in.",
      },
      { property: "og:title", content: "Your week — Syncly" },
      {
        property: "og:description",
        content: "Group plans that work for everyone, privately.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();
  const [joinOpen, setJoinOpen] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const me = useQuery({ queryKey: ["me"], queryFn: useServerFn(getMe) });
  const groups = useQuery({ queryKey: ["groups"], queryFn: useServerFn(listGroups) });
  const dash = useQuery({ queryKey: ["dashboard"], queryFn: useServerFn(getDashboard) });

  useEffect(() => {
    if (me.data && !me.data.onboarded) void navigate({ to: "/onboarding" });
  }, [me.data, navigate]);

  useEffect(() => {
    if (!me.data?.onboarded) return;
    const code = takePendingInvite();
    if (code) void navigate({ to: "/join/$code", params: { code }, replace: true });
  }, [me.data, navigate]);

  const plans = (dash.data?.plans ?? []) as unknown as DashPlan[];

  const weekStart = useMemo(() => {
    const base = startOfWeek(new Date());
    base.setDate(base.getDate() + weekOffset * 7);
    return base;
  }, [weekOffset]);

  const marks = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const p of plans) {
      if (!p.window_start) continue;
      const key = dayKey(p.window_start);
      (map[key] ??= []).push(p.status);
    }
    return map;
  }, [plans]);

  const dayFiltered = useMemo(
    () =>
      selectedDay
        ? plans.filter((p) => p.window_start && dayKey(p.window_start) === selectedDay)
        : plans,
    [plans, selectedDay],
  );

  const conflicted = dayFiltered.filter(
    (p) => (p.conflicts?.length ?? 0) > 0 && (p.alternatives?.length ?? 0) > 0,
  );
  const needsAction = dayFiltered.filter(
    (p) =>
      !conflicted.includes(p) &&
      p.i_attending == null &&
      ((p.status === "collecting" && !p.i_responded) || (p.status === "voting" && !p.i_voted)),
  );
  const answeredActive = dayFiltered.filter(
    (p) =>
      (p.status === "collecting" || p.status === "voting") &&
      p.i_attending != null &&
      !conflicted.includes(p),
  );
  const otherActive = dayFiltered.filter(
    (p) =>
      (p.status === "collecting" || p.status === "voting") &&
      !needsAction.includes(p) &&
      !answeredActive.includes(p) &&
      !conflicted.includes(p),
  );
  const confirmed = dayFiltered
    .filter((p) => p.status === "finalized")
    .sort(
      (a, b) =>
        new Date(a.window_start ?? a.created_at).getTime() -
        new Date(b.window_start ?? b.created_at).getTime(),
    );

  // Up next: soonest confirmed plan, else the most urgent thing waiting on you.
  const upNext =
    confirmed.find(
      (p) => new Date(p.window_start ?? p.created_at).getTime() >= Date.now() - 864e5,
    ) ??
    needsAction[0] ??
    confirmed[0] ??
    otherActive[0] ??
    null;

  const groupList = (groups.data ?? []).map((raw) => {
    const g = raw as unknown as Record<string, unknown>;
    return {
      id: String(g["id"]),
      name: String(g["name"] ?? "Group"),
      emoji: String(g["emoji"] ?? "✨"),
      members: Number(g["member_count"] ?? 1),
    };
  });

  const empty = !dash.isLoading && plans.length === 0;

  return (
    <AppShell
      title={me.data ? `Hey, ${String(me.data.display_name).split(" ")[0]}` : "Home"}
      subtitle="Everyone answers privately. Syncly only shows what works for the whole group."
    >
      <JoinGroupModal open={joinOpen} onClose={() => setJoinOpen(false)} />

      <div className="space-y-6">
        {me.data && (me.data.home_lat == null || me.data.home_lon == null) ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-warning/40 bg-warning/10 px-4 py-3">
            <p className="text-sm">
              <span className="mr-1">📍</span>
              Add your home address to get exact drive distances to every spot.
            </p>
            <Link to="/settings">
              <Button variant="outline">Set address</Button>
            </Link>
          </div>
        ) : null}
        {me.data && me.data.account_type !== "guardian" ? (
          <TeenSafetyBar sharing={Boolean(me.data.location_sharing_enabled)} />
        ) : null}

        <WeekStrip
          weekStart={weekStart}
          selected={selectedDay}
          onSelect={setSelectedDay}
          marks={marks}
          onShift={(d) => setWeekOffset((v) => v + d)}
        />

        {/* Quick actions */}
        <div className="flex gap-2">
          <Link to="/groups" className="flex-1">
            <Button className="w-full">
              <Sparkles className="h-4 w-4" /> Magic AI plan
            </Button>
          </Link>
          <Button variant="outline" onClick={() => setJoinOpen(true)}>
            <KeyRound className="h-4 w-4" /> Join code
          </Button>
        </div>

        {dash.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-44 rounded-3xl" />
            <Skeleton className="h-28 rounded-3xl" />
          </div>
        ) : null}

        {empty ? (
          <Empty
            title="No plans yet"
            body="Create a group, invite the people you actually make plans with, then start a plan. Everyone fills out their own private questionnaire."
            action={
              <Link to="/groups">
                <Button>Set up a group</Button>
              </Link>
            }
          />
        ) : null}

        {upNext ? <UpNextHero plan={upNext} /> : null}

        {selectedDay && dayFiltered.length === 0 ? (
          <Glass className="text-center text-sm text-muted-foreground">
            Nothing scheduled on{" "}
            {new Date(`${selectedDay}T12:00:00`).toLocaleDateString(undefined, {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
            .{" "}
            <button
              type="button"
              className="font-semibold text-primary"
              onClick={() => setSelectedDay(null)}
            >
              Show the whole week
            </button>
          </Glass>
        ) : null}

        {conflicted.length > 0 ? (
          <Section title="Conflict — quick re-vote" accent="text-amber-500">
            <div className="grid gap-3">
              {conflicted.map((p) => (
                <ConflictCard
                  key={p.id}
                  planId={p.id}
                  title={p.title}
                  conflicts={p.conflicts ?? []}
                  alternatives={p.alternatives ?? []}
                  original={p.original_option ?? null}
                />
              ))}
            </div>
          </Section>
        ) : null}

        <LayoutGroup>
          <AnimatePresence initial={false} mode="popLayout">
            {needsAction.length > 0 ? (
              <MotionSection key="needs" title="Needs your action" accent="text-emerald-500">
                <div className="grid gap-3 sm:grid-cols-2">
                  <AnimatePresence initial={false} mode="popLayout">
                    {needsAction.map((p) => (
                      <MotionCard key={p.id}>
                        <div className="flex h-full flex-col gap-2">
                          <div className="flex-1">
                            <ActionCard plan={p} />
                          </div>
                          <QuickActions planId={p.id} answered={p.i_attending ?? null} />
                        </div>
                      </MotionCard>
                    ))}
                  </AnimatePresence>
                </div>
              </MotionSection>
            ) : null}

            {answeredActive.length > 0 ? (
              <MotionSection key="answered" title="Your confirmed plans" accent="text-emerald-400">
                <div className="grid gap-3 sm:grid-cols-2">
                  <AnimatePresence initial={false} mode="popLayout">
                    {answeredActive.map((p) => (
                      <MotionCard key={p.id}>
                        <div className="flex h-full flex-col gap-2">
                          <div className="flex-1">
                            <ActionCard plan={p} />
                          </div>
                          <QuickActions planId={p.id} answered={p.i_attending ?? null} />
                        </div>
                      </MotionCard>
                    ))}
                  </AnimatePresence>
                </div>
              </MotionSection>
            ) : null}

            {confirmed.length > 0 ? (
              <MotionSection key="locked" title="Locked in with the group" accent="text-indigo-400">
                <div className="grid gap-3">
                  <AnimatePresence initial={false} mode="popLayout">
                    {confirmed.map((p) => (
                      <MotionCard key={p.id}>
                        <ConfirmedCard plan={p} />
                      </MotionCard>
                    ))}
                  </AnimatePresence>
                </div>
              </MotionSection>
            ) : null}

            {otherActive.length > 0 ? (
              <MotionSection key="waiting" title="Waiting on the group" accent="text-amber-500">
                <div className="grid gap-3 sm:grid-cols-2">
                  <AnimatePresence initial={false} mode="popLayout">
                    {otherActive.map((p) => (
                      <MotionCard key={p.id}>
                        <ActionCard plan={p} />
                      </MotionCard>
                    ))}
                  </AnimatePresence>
                </div>
              </MotionSection>
            ) : null}
          </AnimatePresence>
        </LayoutGroup>

        {groupList.length > 0 ? (
          <Section title="Active circles">
            <GroupsRail groups={groupList} />
          </Section>
        ) : null}
      </div>
    </AppShell>
  );
}

const cardSpring = { type: "spring", stiffness: 300, damping: 25 } as const;

function MotionSection({
  title,
  accent,
  children,
}: {
  title: string;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={cardSpring}
      className="space-y-3"
    >
      <h2
        className={`text-xs font-semibold uppercase tracking-wide ${accent ?? "text-muted-foreground"}`}
      >
        {title}
      </h2>
      {children}
    </motion.section>
  );
}

function MotionCard({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={cardSpring}
      className="h-full"
    >
      {children}
    </motion.div>
  );
}

function Section({
  title,
  accent,
  children,
}: {
  title: string;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2
        className={`text-xs font-semibold uppercase tracking-wide ${accent ?? "text-muted-foreground"}`}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function UpNextHero({ plan }: { plan: DashPlan }) {
  const rec = plan.selected_recommendation;
  const cta =
    plan.status === "voting"
      ? plan.i_voted
        ? "See the tally"
        : "Cast vote"
      : plan.status === "collecting"
        ? plan.i_responded
          ? "View plan"
          : "Answer privately"
        : "View plan";
  const tag =
    plan.status === "finalized" && rec?.suggested_start
      ? `Confirmed ${formatTime(rec.suggested_start)}`
      : undefined;

  return (
    <Glass className="relative overflow-hidden p-5">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--primary)_35%,transparent),transparent_70%)] blur-2xl"
      />
      <div className="relative space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Up next
          </p>
          <StatusTag status={plan.status} label={tag} />
        </div>

        <div className="flex gap-4">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="truncate text-xs text-muted-foreground">
              {plan.groups?.emoji ?? "✨"} {plan.groups?.name ?? "Group"}
            </p>
            <h2 className="font-display text-2xl font-semibold leading-tight">{plan.title}</h2>
            <p className="text-sm text-muted-foreground">
              {formatWhen(plan.window_start)}
              {rec?.location_name
                ? ` · ${rec.location_name}`
                : plan.location_area
                  ? ` · ${plan.location_area}`
                  : ""}
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <WeatherChip planId={plan.id} />
              <CostBadge min={plan.est_cost_min} max={plan.est_cost_max} />
            </div>
          </div>
          <MapThumb lat={rec?.lat} lon={rec?.lon} className="hidden h-28 w-40 shrink-0 sm:block" />
        </div>

        {plan.status !== "finalized" ? (
          <Progress
            done={plan.status === "voting" ? plan.vote_count : plan.responded_count}
            total={Math.max(plan.participant_count, 1)}
          />
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <AvatarStack people={plan.participants} max={5} />
          <Link to="/plans/$planId" params={{ planId: plan.id }}>
            <Button>{cta}</Button>
          </Link>
        </div>
      </div>
    </Glass>
  );
}

function formatTime(t: string) {
  const [h = "0", m = "00"] = t.split(":");
  const hour = Number(h);
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${m} ${suffix}`;
}
