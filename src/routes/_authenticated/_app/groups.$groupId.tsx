import { Avatar } from "@/components/quorum/Avatar";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Clock,
  Lock,
  MessageCircle,
  Pencil,
  Plus,
  Settings as SettingsIcon,
  ThumbsUp,
  X,
  XCircle,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/quorum/AppShell";
import { InviteCard } from "@/components/quorum/InviteCard";
import { GroupSettings } from "@/components/quorum/GroupSettings";
import { GroupAppearance } from "@/components/quorum/GroupAppearance";
import { Button, Card, Empty, Pill, Skeleton } from "@/components/quorum/ui";
import { statusTone } from "@/components/quorum/status-tone";
import { getGroup } from "@/lib/quorum/plan.functions";
import { PlanWizard } from "@/components/quorum/PlanWizard";
import { SquadChat } from "@/components/quorum/SquadChat";
import { PullToRefresh, SwipeBack } from "@/components/quorum/interactions";
import { categoryMeta } from "@/lib/quorum/types";
import { categoryIcon } from "@/lib/quorum/icons";
import { estCostLabel } from "@/lib/quorum/estcost";

export const Route = createFileRoute("/_authenticated/_app/groups/$groupId")({
  loader: ({ context, params }) => {
    void context.queryClient.ensureQueryData({
      queryKey: ["group", params.groupId],
      queryFn: () => getGroup({ data: { groupId: params.groupId } }),
    });
  },
  head: () => ({
    meta: [
      { title: "Group — Syncly" },
      { name: "description", content: "Members, invite code, and plans for this Syncly group." },
      { property: "og:title", content: "Group — Syncly" },
      { property: "og:description", content: "Members, invite code, and plans for this group." },
    ],
  }),
  component: GroupPage,
});

type Tab = "plans" | "chat" | "settings";

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "plans", label: "Plans", icon: Zap },
  { id: "chat", label: "Chat", icon: MessageCircle },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

function GroupPage() {
  const { groupId } = Route.useParams();
  const fetchGroup = useServerFn(getGroup);
  const q = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => fetchGroup({ data: { groupId } }),
  });

  const [tab, setTab] = useState<Tab>("plans");
  const [wizard, setWizard] = useState(false);

  if (q.isLoading) {
    return (
      <>
        <PageHeader backTo="/groups" title="Group" />
        <Skeleton className="h-32 rounded-surface" />
      </>
    );
  }
  if (q.isError)
    return (
      <>
        <PageHeader backTo="/groups" title="Group" />
        <Empty
          title="Couldn't load this group"
          body="Check your connection or ask a member to confirm you still have access."
          action={<Button onClick={() => void q.refetch()}>Try again</Button>}
        />
      </>
    );
  if (!q.data)
    return (
      <Empty
        title="Group not found"
        body="This group may have been removed or you may no longer have access."
      />
    );

  const { group, members, plans, myProfileId } = q.data;
  const memberIds = members.map((m) => m.profile_id);
  const myRole = members.find((m) => m.profile_id === myProfileId)?.role;
  const myDisplayName = (
    members.find((m) => m.profile_id === myProfileId)?.profiles as {
      display_name?: string | null;
    } | null
  )?.display_name;
  const canManage = myRole === "owner" || myRole === "admin";
  const activeIndex = TABS.findIndex((t) => t.id === tab);

  return (
    <>
      <PageHeader
        backTo="/groups"
        title={`${group.emoji} ${group.name}`}
        subtitle={`${members.length} member${members.length === 1 ? "" : "s"}`}
      />
      <SwipeBack>
        {/* Sub-tab bar */}
        <div className="relative mt-1 grid grid-cols-3 gap-1 rounded-2xl border border-border bg-secondary/50 p-1">
          <span
            className="absolute inset-y-1 left-1 rounded-xl bg-primary/15 ring-1 ring-primary/40 transition-transform duration-300 ease-out"
            style={{
              width: "calc((100% - 0.5rem) / 3)",
              transform: `translateX(${activeIndex * 100}%)`,
            }}
            aria-hidden
          />
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`tap-target relative z-10 flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition active:scale-[0.97] ${
                tab === t.id ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="size-3.5" aria-hidden />
              {t.label}
            </button>
          ))}
        </div>

        <div className="overflow-hidden">
          <div key={tab} className="animate-fade-in mt-4">
            {tab === "plans" ? (
              <PullToRefresh onRefresh={() => q.refetch()}>
                <section className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <SquadStats
                      plans={
                        plans as unknown as { status: string; location_area?: string | null }[]
                      }
                    />
                    <Button onClick={() => setWizard(true)}>
                      <Plus className="size-4" aria-hidden /> Launch new plan
                    </Button>
                  </div>

                  {plans.length === 0 ? (
                    <Card>
                      <p className="text-sm text-muted-foreground">
                        No plans yet — tap “Launch new plan” to pick a vibe.
                      </p>
                    </Card>
                  ) : null}

                  {(plans as unknown as GroupPlan[]).map((p) => (
                    <PlanCard key={p.id} plan={p} />
                  ))}
                </section>
              </PullToRefresh>
            ) : null}

            {tab === "chat" ? (
              <SquadChat groupId={groupId} className="h-[calc(100dvh-11rem)] min-h-72" />
            ) : null}

            {tab === "settings" ? (
              <section className="space-y-6">
                <InviteCard
                  code={group.invite_code}
                  groupName={group.name}
                  groupEmoji={(group as { emoji?: string }).emoji}
                  inviterName={myDisplayName}
                />

                {canManage ? (
                  <GroupAppearance
                    groupId={groupId}
                    initial={{
                      name: group.name,
                      emoji: (group as { emoji?: string }).emoji,
                      avatar_url: (group as { avatar_url?: string | null }).avatar_url ?? null,
                      cover_theme: (group as { cover_theme?: string | null }).cover_theme ?? null,
                    }}
                  />
                ) : null}

                <div>
                  <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Members
                  </h2>
                  <Card className="divide-y divide-border">
                    {members.map((m) => {
                      const p = m.profiles as {
                        display_name?: string;
                        avatar_emoji?: string;
                        avatar_url?: string | null;
                        bio?: string | null;
                        school?: string | null;
                        grad_year?: number | null;
                      } | null;
                      const meta = [p?.school, p?.grad_year ? `Class of ${p.grad_year}` : null]
                        .filter(Boolean)
                        .join(" · ");
                      return (
                        <div
                          key={m.profile_id}
                          className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0"
                        >
                          <Avatar
                            url={p?.avatar_url}
                            emoji={p?.avatar_emoji}
                            name={p?.display_name}
                            size={36}
                          />
                          <div className="flex-1">
                            {/* "New member" is the default display_name before setup. */}
                            {!p?.display_name || p.display_name === "New member" ? (
                              <span className="block text-sm">
                                <span className="font-medium">{group.name} member</span>
                                <span className="italic text-muted-foreground"> · no name yet</span>
                              </span>
                            ) : (
                              <span className="block text-sm font-medium">{p.display_name}</span>
                            )}
                            {meta ? (
                              <span className="block text-xs text-muted-foreground">{meta}</span>
                            ) : null}
                            {p?.bio ? (
                              <p className="mt-0.5 text-xs text-muted-foreground">{p.bio}</p>
                            ) : null}
                          </div>
                          <span className="text-xs capitalize text-muted-foreground">{m.role}</span>
                        </div>
                      );
                    })}
                  </Card>
                </div>

                <GroupSettings
                  groupId={groupId}
                  groupName={group.name}
                  members={members as never}
                  myProfileId={myProfileId}
                />
              </section>
            ) : null}
          </div>
        </div>

        {wizard ? (
          <PlanWizard groupId={groupId} memberIds={memberIds} onClose={() => setWizard(false)} />
        ) : null}
      </SwipeBack>
    </>
  );
}

/** Aggregate squad metrics shown on the group detail page. */
function SquadStats({ plans }: { plans: { status: string; location_area?: string | null }[] }) {
  const done = plans.filter((p) => p.status === "completed" || p.status === "finalized");
  const spots = new Map<string, number>();
  for (const p of done) {
    const area = (p.location_area ?? "").trim();
    if (area) spots.set(area, (spots.get(area) ?? 0) + 1);
  }
  const top = [...spots.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return (
    <p className="text-xs text-muted-foreground">
      {done.length} hangout{done.length === 1 ? "" : "s"} completed
      {top ? ` • Most frequent spot: ${top}` : ""}
    </p>
  );
}

type GroupPlan = {
  id: string;
  title: string;
  category: string;
  status: string;
  window_start: string | null;
  location_area: string | null;
  est_cost_min: number | null;
  est_cost_max: number | null;
  plan_participants?: {
    profile_id: string;
    responded: boolean;
    attending: boolean;
    profiles?: {
      display_name?: string | null;
      avatar_emoji?: string | null;
      avatar_url?: string | null;
    } | null;
  }[];
  plan_conflicts?: { id: string; resolved: boolean }[];
};

// Tone/icon come from the canonical statusTone() (ui.tsx) and its lucide
// equivalent -- only the label text is specific to this screen.
const STATUS_LABEL: Record<string, string> = {
  finalized: "Locked in",
  completed: "Completed",
  voting: "Voting active",
  recommending: "Voting active",
  collecting: "Voting active",
  draft: "Draft",
  cancelled: "Expired",
};

const STATUS_ICON: Record<string, LucideIcon> = {
  finalized: Lock,
  completed: CheckCircle2,
  voting: Zap,
  recommending: Zap,
  collecting: Zap,
  draft: Pencil,
  cancelled: X,
};

function whenLabel(iso: string | null) {
  if (!iso) return "Time TBD";
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const day = sameDay
    ? "Today"
    : d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  return `${day} @ ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

/** Rich, tappable plan card for the group Plans tab. */
function PlanCard({ plan }: { plan: GroupPlan }) {
  const meta = categoryMeta(plan.category);
  const CategoryIcon = categoryIcon(plan.category);
  const StatusIcon = STATUS_ICON[plan.status] ?? Zap;
  const status = { label: STATUS_LABEL[plan.status] ?? plan.status, tone: statusTone(plan.status) };
  const going = (plan.plan_participants ?? []).filter((p) => p.responded && p.attending);
  const conflicts = (plan.plan_conflicts ?? []).filter((c) => !c.resolved).length;
  const cost = estCostLabel(plan.est_cost_min, plan.est_cost_max);
  const names = going.map((g) => g.profiles?.display_name ?? "Member");

  return (
    <Link to="/plans/$planId" params={{ planId: plan.id }} className="block">
      <div className="surface p-4 transition-[transform,border-color] duration-150 ease-out hover:border-primary/30 active:scale-[0.99]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/25">
              <CategoryIcon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate font-display font-semibold">{plan.title}</p>
              <p className="truncate text-xs capitalize text-muted-foreground">
                {meta.label}
                {plan.location_area ? ` · ${plan.location_area}` : ""}
              </p>
            </div>
          </div>
          <Pill tone={status.tone}>
            <StatusIcon className="size-3.5" aria-hidden /> {status.label}
          </Pill>
        </div>

        <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">
            {whenLabel(plan.window_start)}
            {cost ? ` · ${cost}` : ""}
          </span>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex -space-x-2">
              {going.slice(0, 4).map((g) => (
                <Avatar
                  key={g.profile_id}
                  url={g.profiles?.avatar_url}
                  emoji={g.profiles?.avatar_emoji}
                  name={g.profiles?.display_name}
                  size={24}
                  className="ring-2 ring-card"
                />
              ))}
            </div>
            <span className="inline-flex min-w-0 items-center gap-1 truncate text-xs text-muted-foreground">
              {going.length > 0 ? <ThumbsUp className="size-3 shrink-0" aria-hidden /> : null}
              {going.length === 0
                ? "No responses yet"
                : `${names[0]}${going.length > 1 ? ` + ${going.length - 1} other${going.length > 2 ? "s" : ""}` : ""}`}
            </span>
            {conflicts > 0 ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warning/16 px-2 py-0.5 text-caption font-medium text-warning">
                <XCircle className="size-3" aria-hidden /> {conflicts} Conflict
                {conflicts === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </div>
      </div>
    </Link>
  );
}
