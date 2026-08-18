import { Avatar } from "@/components/quorum/Avatar";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell } from "@/components/quorum/AppShell";
import { InviteCard } from "@/components/quorum/InviteCard";
import { GroupSettings } from "@/components/quorum/GroupSettings";
import { GroupAppearance } from "@/components/quorum/GroupAppearance";
import { Button, Card, Pill, Skeleton } from "@/components/quorum/ui";
import { getGroup } from "@/lib/quorum/plan.functions";
import { PlanWizard } from "@/components/quorum/PlanWizard";
import { SquadChat } from "@/components/quorum/SquadChat";

export const Route = createFileRoute("/_authenticated/groups/$groupId")({
  head: () => ({
    meta: [
      { title: "Group — Quorum" },
      { name: "description", content: "Members, invite code, and plans for this Quorum group." },
      { property: "og:title", content: "Group — Quorum" },
      { property: "og:description", content: "Members, invite code, and plans for this group." },
    ],
  }),
  component: GroupPage,
});

type Tab = "plans" | "chat" | "settings";

const TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: "plans", label: "Plans", emoji: "⚡" },
  { id: "chat", label: "Chat", emoji: "💬" },
  { id: "settings", label: "Settings", emoji: "⚙️" },
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
      <AppShell title="Group">
        <Skeleton className="h-32 rounded-3xl" />
      </AppShell>
    );
  }
  if (!q.data) return <AppShell title="Group not found">{null}</AppShell>;

  const { group, members, plans, myProfileId } = q.data;
  const memberIds = members.map((m) => m.profile_id);
  const myRole = members.find((m) => m.profile_id === myProfileId)?.role;
  const canManage = myRole === "owner" || myRole === "admin";
  const activeIndex = TABS.findIndex((t) => t.id === tab);

  return (
    <AppShell
      title={`${group.emoji} ${group.name}`}
      subtitle={`${members.length} members · invite code ${group.invite_code}`}
    >
      {/* Sub-tab bar */}
      <div className="relative mt-1 grid grid-cols-3 gap-1 rounded-2xl border border-border bg-secondary/50 p-1">
        <span
          className="absolute inset-y-1 left-1 rounded-xl bg-primary/15 ring-1 ring-primary/40 transition-transform duration-300 ease-out"
          style={{ width: "calc((100% - 0.5rem) / 3)", transform: `translateX(${activeIndex * 100}%)` }}
          aria-hidden
        />
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`tap-target relative z-10 rounded-xl px-3 py-2 text-xs font-semibold transition active:scale-95 ${
              tab === t.id ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="mr-1">{t.emoji}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden">
        <div key={tab} className="animate-fade-in mt-4">
          {tab === "plans" ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <SquadStats
                  plans={plans as unknown as { status: string; location_area?: string | null }[]}
                />
                <Button onClick={() => setWizard(true)}>+ Launch New Plan</Button>
              </div>

              {plans.length === 0 ? (
                <Card>
                  <p className="text-sm text-muted-foreground">
                    No plans yet — tap “Launch New Plan” to pick a vibe.
                  </p>
                </Card>
              ) : null}

              {(plans as unknown as GroupPlan[]).map((p) => (
                <PlanCard key={p.id} plan={p} />
              ))}
            </section>
          ) : null}

          {tab === "chat" ? <SquadChat groupId={groupId} className="h-[70vh]" /> : null}

          {tab === "settings" ? (
            <section className="space-y-6">
              <InviteCard code={group.invite_code} groupName={group.name} />

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
                          <span className="block text-sm font-medium">
                            {p?.display_name ?? "Member"}
                          </span>
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
    </AppShell>
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
