import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Sparkles, KeyRound } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { PageHeader } from "@/components/quorum/AppShell";
import { TeenSafetyBar } from "@/components/quorum/guardian/TeenSafetyBar";
import { Button, Empty, Skeleton } from "@/components/quorum/ui";
import { ConflictCard, QuickActions } from "@/components/quorum/ConflictCard";
import { LiveActivityCard } from "@/components/quorum/LiveActivityCard";
import { SquadDigestCard } from "@/components/quorum/ai/SquadDigest";
import { FindMySquad } from "@/components/quorum/FindMySquad";
import { JoinGroupModal } from "@/components/quorum/JoinGroupModal";
import { PullToRefresh, SpotlightCard } from "@/components/quorum/interactions";

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

export const Route = createFileRoute("/_authenticated/_app/home")({
  // Fire-and-forget: with defaultPreload "intent" on the router, this starts
  // warming the same query cache HomePage reads from as soon as a Link to
  // here is touched/hovered, not after the route has already switched and
  // the component mounted. Not awaited, so it never blocks navigation --
  // useQuery below just picks up whatever's already in flight or cached.
  loader: ({ context }) => {
    void context.queryClient.ensureQueryData({ queryKey: ["me"], queryFn: () => getMe() });
    void context.queryClient.ensureQueryData({ queryKey: ["groups"], queryFn: () => listGroups() });
    void context.queryClient.ensureQueryData({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
  },
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

  const plans = useMemo(
    () => (dash.data?.plans ?? []) as unknown as DashPlan[],
    [dash.data?.plans],
  );

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

  const { conflicted, needsAction, answeredActive, otherActive, activeNow, upcoming, memories } =
    useMemo(() => {
      const conflicted = dayFiltered.filter(
        (p) => (p.conflicts?.length ?? 0) > 0 && (p.alternatives?.length ?? 0) > 0,
      );
      const needsAction = dayFiltered.filter(
        (p) =>
          !conflicted.includes(p) &&
          p.i_attending == null &&
          ((p.status === "collecting" && !p.i_responded) ||
            (p.status === "voting" && !p.i_voted)),
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

      const isPast = (p: DashPlan) =>
        new Date(p.window_start ?? p.created_at).getTime() < Date.now() - 6 * 3600e3;
      const todayKey = dayKey(new Date().toISOString());

      // Live Activity carousel: anything needing you, answered-but-live, or happening today.
      const activeNow = [
        ...needsAction,
        ...answeredActive,
        ...otherActive,
        ...confirmed.filter((p) => p.window_start && dayKey(p.window_start) === todayKey),
      ];
      const upcoming = confirmed.filter((p) => !isPast(p) && !activeNow.includes(p));
      const memories = confirmed.filter((p) => isPast(p) && !activeNow.includes(p)).slice(0, 5);

      return { conflicted, needsAction, answeredActive, otherActive, activeNow, upcoming, memories };
    }, [dayFiltered]);

  const groupList = useMemo(
    () =>
      (groups.data ?? []).map((raw) => {
        const g = raw as unknown as Record<string, unknown>;
        return {
          id: String(g["id"]),
          name: String(g["name"] ?? "Group"),
          emoji: String(g["emoji"] ?? "✨"),
          members: Number(g["member_count"] ?? 1),
        };
      }),
    [groups.data],
  );

  const empty = !dash.isLoading && !dash.isError && plans.length === 0;

  return (
    <>
      <PageHeader
        title={me.data ? `Hey, ${String(me.data.display_name).split(" ")[0]}` : "Home"}
        subtitle="Everyone answers privately. Syncly only shows what works for the whole group."
      />
      <JoinGroupModal open={joinOpen} onClose={() => setJoinOpen(false)} />

      <PullToRefresh
        onRefresh={async () => {
          await Promise.all([dash.refetch(), groups.refetch()]);
        }}
      >
      <div className="space-y-6">

        <WeekStrip
          weekStart={weekStart}
          selected={selectedDay}
          onSelect={setSelectedDay}
          marks={marks}
          onShift={(d) => setWeekOffset((v) => v + d)}
        />

        {/* Quick actions -- Magic AI plan is the hero action here, Join
            code stays a smaller secondary affordance beside it. */}
        <div className="flex items-stretch gap-2">
          <Link to="/groups" className="flex-1">
            <Button className="h-14 w-full text-base">
              <Sparkles className="h-5 w-5" /> Magic AI plan
            </Button>
          </Link>
          <Button variant="outline" className="h-14" onClick={() => setJoinOpen(true)}>
            <KeyRound className="h-4 w-4" /> Join code
          </Button>
        </div>

        {dash.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-44 rounded-3xl" />
            <Skeleton className="h-28 rounded-3xl" />
          </div>
        ) : null}

        {/* A failed fetch previously fell through to the same "No plans
            yet" empty state as genuinely having zero plans -- indistinguishable
            to the user. */}
        {dash.isError ? (
          <Empty
            title="Couldn't load your week"
            body="Check your connection and try again."
            action={<Button onClick={() => dash.refetch()}>Try again</Button>}
          />
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
          <Section title="Conflicts" accent="text-foreground">
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
          {activeNow.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-title font-semibold tracking-tight">Active right now</h2>
              <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <AnimatePresence initial={false} mode="popLayout">
                  {activeNow.map((p) => (
                    <motion.div
                      key={p.id}
                      layout
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={cardSpring}
                      className="w-[88%] shrink-0 snap-start sm:w-[420px]"
                    >
                      <SpotlightCard tilt className="rounded-surface">
                        <LiveActivityCard plan={p} />
                      </SpotlightCard>
                    </motion.div>

                  ))}
                </AnimatePresence>
              </div>
            </section>
          ) : null}
        </LayoutGroup>

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

        <SquadDigestCard />

        <FindMySquad />

        {upcoming.length > 0 || memories.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-title font-semibold tracking-tight">Upcoming &amp; memories</h2>
            <div className="grid gap-3">
              {upcoming.map((p) => (
                <ConfirmedCard key={p.id} plan={p} />
              ))}
              {memories.map((p) => (
                <Link
                  key={p.id}
                  to="/plans/$planId"
                  params={{ planId: p.id }}
                  className="flex items-center gap-3 rounded-surface border border-border bg-card/30 px-4 py-3 backdrop-blur-3xl"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-muted-foreground">
                      {p.title}
                    </p>
                    <p className="truncate text-xs font-medium text-muted-foreground/70">
                      {formatWhen(p.window_start)} · {p.groups?.name ?? "Group"}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {groupList.length > 0 ? (
          <Section title="Active circles">
            <GroupsRail groups={groupList} />
          </Section>
        ) : !groups.isLoading ? (
          <Section title="Active circles">
            <Empty
              title="No groups yet"
              body="Create a squad or join one with a six-character code to start planning together."
              action={
                <Link to="/groups">
                  <Button>Set up a group</Button>
                </Link>
              }
            />
          </Section>
        ) : null}
      </div>
      </PullToRefresh>
    </>
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
      <h2 className={`text-sm font-semibold ${accent ?? "text-muted-foreground"}`}>{title}</h2>
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
      <h2 className={`text-sm font-semibold ${accent ?? "text-muted-foreground"}`}>{title}</h2>
      {children}
    </section>
  );
}
