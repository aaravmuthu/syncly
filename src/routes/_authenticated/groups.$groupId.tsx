import { Avatar } from "@/components/quorum/Avatar";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { isValidZip } from "@/lib/quorum/location";
import { AppShell } from "@/components/quorum/AppShell";
import { InviteCard } from "@/components/quorum/InviteCard";
import { GroupSettings } from "@/components/quorum/GroupSettings";
import { Button, Card, Field, Pill, Skeleton, inputClass } from "@/components/quorum/ui";
import { createPlan, getGroup } from "@/lib/quorum/plan.functions";
import { getGroupMemory } from "@/lib/quorum/insight.functions";
import { CATEGORIES, type PlanCategory } from "@/lib/quorum/types";
import { PlaceAutocomplete } from "@/components/quorum/PlaceAutocomplete";
import { CreatePlanPanel } from "@/components/quorum/CreatePlanPanel";
import { RADIUS_OPTIONS, VIBES } from "@/lib/quorum/vibes";

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

function GroupPage() {
  const { groupId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchGroup = useServerFn(getGroup);
  const q = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => fetchGroup({ data: { groupId } }),
  });

  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<PlanCategory>("dinner");
  const [windowStart, setWindowStart] = useState("");
  const [zip, setZip] = useState("");
  const [vibe, setVibe] = useState<string | null>(null);
  const [radius, setRadius] = useState<number>(10);

  // Group memory: aggregate patterns from past plans, used only to pre-fill.
  const fetchMemory = useServerFn(getGroupMemory);
  const memory = useQuery({
    queryKey: ["group-memory", groupId],
    queryFn: () => fetchMemory({ data: { groupId } }),
  });
  const topCategory = ((memory.data?.favorite_activities as
    { category: string; count: number }[] | null) ?? [])[0];
  const topArea = ((memory.data?.common_locations as { area: string; count: number }[] | null) ??
    [])[0];

  const create = useMutation({
    mutationFn: useServerFn(createPlan),
    onError: (e: unknown) =>
      toast.error("Could not create the plan", {
        description: e instanceof Error ? e.message : "Please try again.",
      }),
    onSuccess: (plan) => {
      toast.success("Plan created", {
        description: "Everyone gets their own private questionnaire.",
      });
      void qc.invalidateQueries({ queryKey: ["group", groupId] });
      void qc.invalidateQueries({ queryKey: ["plans"] });
      void navigate({ to: "/plans/$planId", params: { planId: (plan as { id: string }).id } });
    },
  });

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

  return (
    <AppShell
      title={`${group.emoji} ${group.name}`}
      subtitle={`${members.length} members · invite code ${group.invite_code}`}
      action={
        <Button onClick={() => setCreating((v) => !v)}>{creating ? "Cancel" : "New plan"}</Button>
      }
    >
      <InviteCard code={group.invite_code} groupName={group.name} />

      <SquadStats plans={plans as unknown as { status: string; location_area?: string | null }[]} />


      {creating ? (
        <CreatePlanPanel groupId={groupId} memberIds={memberIds} inviteCode={group.invite_code} />
      ) : null}

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Plans
        </h2>
        {plans.length === 0 ? (
          <Card>
            <p className="text-sm text-muted-foreground">No plans in this group yet.</p>
          </Card>
        ) : null}
        {plans.map((p) => (
          <Link key={p.id} to="/plans/$planId" params={{ planId: p.id }}>
            <Card className="flex items-center justify-between transition hover:border-primary/40">
              <div>
                <p className="font-display font-semibold">{p.title}</p>
                <p className="text-xs text-muted-foreground capitalize">{p.category}</p>
              </div>
              <Pill tone={p.status === "finalized" ? "good" : "accent"}>{p.status}</Pill>
            </Card>
          </Link>
        ))}
      </section>

      <section className="mt-8">
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
                  <span className="block text-sm font-medium">{p?.display_name ?? "Member"}</span>
                  {meta ? (
                    <span className="block text-xs text-muted-foreground">{meta}</span>
                  ) : null}
                  {p?.bio ? <p className="mt-0.5 text-xs text-muted-foreground">{p.bio}</p> : null}
                </div>
                <span className="text-xs capitalize text-muted-foreground">{m.role}</span>
              </div>
            );
          })}
        </Card>
      </section>

      {members.find((m) => m.profile_id === myProfileId)?.role === "owner" ||
      members.find((m) => m.profile_id === myProfileId)?.role === "admin" ? (
        <section className="mt-8">
          <GroupAppearance
            groupId={groupId}
            initial={{
              name: group.name,
              emoji: (group as { emoji?: string }).emoji,
              avatar_url: (group as { avatar_url?: string | null }).avatar_url ?? null,
              cover_theme: (group as { cover_theme?: string | null }).cover_theme ?? null,
            }}
          />
        </section>
      ) : null}

      <GroupSettings
        groupId={groupId}
        groupName={group.name}
        members={members as never}
        myProfileId={myProfileId}
      />
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
    <p className="mt-3 text-xs text-muted-foreground">
      {done.length} hangout{done.length === 1 ? "" : "s"} completed
      {top ? ` • Most frequent spot: ${top}` : ""}
    </p>
  );
}

