import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { isValidZip } from "@/lib/quorum/location";
import { AppShell } from "@/components/quorum/AppShell";
import { InviteCard } from "@/components/quorum/InviteCard";
import { Button, Card, Field, Pill, Skeleton, inputClass } from "@/components/quorum/ui";
import { createPlan, getGroup } from "@/lib/quorum/plan.functions";
import { CATEGORIES, type PlanCategory } from "@/lib/quorum/types";

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

  const create = useMutation({
    mutationFn: useServerFn(createPlan),
    onError: (e: unknown) =>
      toast.error("Could not create the plan", {
        description: e instanceof Error ? e.message : "Please try again.",
      }),
    onSuccess: (plan) => {
      toast.success("Plan created", { description: "Everyone gets their own private questionnaire." });
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

  const { group, members, plans } = q.data;
  const memberIds = members.map((m) => m.profile_id);

  return (
    <AppShell
      title={`${group.emoji} ${group.name}`}
      subtitle={`${members.length} members · invite code ${group.invite_code}`}
      action={<Button onClick={() => setCreating((v) => !v)}>{creating ? "Cancel" : "New plan"}</Button>}
    >
      <InviteCard code={group.invite_code} groupName={group.name} />

      {creating ? (
        <Card className="mb-6">
          <h2 className="font-display text-base font-semibold">Start a plan</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Everyone in the group gets their own private questionnaire. Nobody sees anyone else's answers.
          </p>
          <div className="mt-4 space-y-4">
            <Field label="What are you planning?">
              <input
                className={inputClass}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Saturday dinner"
              />
            </Field>
            <div>
              <span className="text-sm font-medium">Category</span>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategory(c.id)}
                    className={`rounded-2xl border px-3 py-2.5 text-left text-sm transition ${
                      category === c.id
                        ? "border-primary/50 bg-primary/8"
                        : "border-border hover:bg-secondary"
                    }`}
                  >
                    <span className="mr-1.5">{c.emoji}</span>
                    <span className="font-medium">{c.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <Field label="ZIP code" hint="Used to find real venues nearby and estimate travel">
              <input
                className={inputClass}
                inputMode="numeric"
                maxLength={5}
                value={zip}
                onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
                placeholder="75034"
              />
            </Field>
            <Field label="Target date" hint="Optional — helps narrow options">
              <input
                type="date"
                className={inputClass}
                value={windowStart}
                onChange={(e) => setWindowStart(e.target.value)}
              />
            </Field>
            <Button
              className="w-full"
              loading={create.isPending}
              disabled={!title.trim()}
              onClick={() => {
                if (!title.trim()) return toast.error("Give the plan a name first");
                if (zip && !isValidZip(zip)) return toast.error("Enter a valid 5-digit ZIP code");
                create.mutate({
                  data: {
                    groupId,
                    title,
                    category,
                    windowStart: windowStart || null,
                    zipCode: zip || null,
                    participantIds: memberIds,
                  },
                });
              }}
            >
              {create.isPending ? "Creating…" : "Create plan"}
            </Button>
          </div>
        </Card>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Plans</h2>
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
            const p = m.profiles as { display_name?: string; avatar_emoji?: string } | null;
            return (
              <div key={m.profile_id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="text-xl">{p?.avatar_emoji ?? "🙂"}</span>
                <span className="flex-1 text-sm font-medium">{p?.display_name ?? "Member"}</span>
                <span className="text-xs capitalize text-muted-foreground">{m.role}</span>
              </div>
            );
          })}
        </Card>
      </section>
    </AppShell>
  );
}
