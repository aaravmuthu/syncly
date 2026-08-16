import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/quorum/AppShell";
import { Card, Button, Pill, Empty, Skeleton } from "@/components/quorum/ui";
import { JoinGroupModal } from "@/components/quorum/JoinGroupModal";
import { takePendingInvite } from "@/lib/quorum/invite";
import { getMe, listGroups, listPlans } from "@/lib/quorum/plan.functions";
import { categoryMeta } from "@/lib/quorum/types";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Your plans — Quorum" },
      {
        name: "description",
        content:
          "See what your groups are planning, what still needs your private answers, and what's already locked in.",
      },
      { property: "og:title", content: "Your plans — Quorum" },
      { property: "og:description", content: "Group plans that work for everyone, privately." },
    ],
  }),
  component: HomePage,
});

const STATUS_TONE: Record<string, "neutral" | "good" | "warn" | "accent"> = {
  collecting: "warn",
  voting: "accent",
  finalized: "good",
  draft: "neutral",
};

function HomePage() {
  const navigate = useNavigate();
  const [joinOpen, setJoinOpen] = useState(false);
  const me = useQuery({ queryKey: ["me"], queryFn: useServerFn(getMe) });
  const groups = useQuery({ queryKey: ["groups"], queryFn: useServerFn(listGroups) });
  const plans = useQuery({ queryKey: ["plans"], queryFn: useServerFn(listPlans) });

  useEffect(() => {
    if (me.data && !me.data.onboarded) void navigate({ to: "/onboarding" });
  }, [me.data, navigate]);

  // Picks up an invite code saved before sign-in and joins that group.
  useEffect(() => {
    if (!me.data?.onboarded) return;
    const code = takePendingInvite();
    if (code) void navigate({ to: "/join/$code", params: { code }, replace: true });
  }, [me.data, navigate]);

  const active = (plans.data ?? []).filter(
    (p) => p.status === "collecting" || p.status === "voting",
  );
  const settled = (plans.data ?? []).filter((p) => p.status === "finalized");

  return (
    <AppShell
      title={me.data ? `Hey, ${me.data.display_name.split(" ")[0]}` : "Home"}
      subtitle="Everyone answers privately. Quorum only shows what works for the whole group."
      action={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setJoinOpen(true)}>
            Join
          </Button>
          <Link to="/groups">
            <Button>New plan</Button>
          </Link>
        </div>
      }
    >
      <JoinGroupModal open={joinOpen} onClose={() => setJoinOpen(false)} />

      {plans.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 rounded-3xl" />
          <Skeleton className="h-28 rounded-3xl" />
        </div>
      ) : null}

      {!plans.isLoading && active.length === 0 && settled.length === 0 ? (
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

      {active.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Needs attention
          </h2>
          {active.map((p) => {
            const meta = categoryMeta(p.category);
            const g = p.groups as { name?: string; emoji?: string } | null;
            return (
              <Link key={p.id} to="/plans/$planId" params={{ planId: p.id }}>
                <Card className="transition hover:border-primary/40">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{g?.emoji ?? meta.emoji}</span>
                        <span className="truncate">{g?.name ?? meta.label}</span>
                      </div>
                      <h3 className="mt-1 font-display text-lg font-semibold">{p.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {p.status === "collecting"
                          ? "Waiting on private answers from the group"
                          : "Compatible options are ready — cast your vote"}
                      </p>
                    </div>
                    <Pill tone={STATUS_TONE[p.status] ?? "neutral"}>
                      {p.status === "collecting" ? "Collecting" : "Voting"}
                    </Pill>
                  </div>
                </Card>
              </Link>
            );
          })}
        </section>
      ) : null}

      {settled.length > 0 ? (
        <section className="mt-8 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Locked in
          </h2>
          {settled.map((p) => (
            <Link key={p.id} to="/plans/$planId" params={{ planId: p.id }}>
              <Card className="transition hover:border-primary/40">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-display text-base font-semibold">{p.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {p.compatibility_score ?? 0}% group compatibility
                    </p>
                  </div>
                  <Pill tone="good">Final</Pill>
                </div>
              </Card>
            </Link>
          ))}
        </section>
      ) : null}

      {(groups.data ?? []).length > 0 ? (
        <section className="mt-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Your groups
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {(groups.data ?? []).map((raw) => {
              const g = raw as unknown as Record<string, unknown>;
              const id = String(g["id"]);
              return (
                <Link key={id} to="/groups/$groupId" params={{ groupId: id }}>
                  <Card className="flex items-center gap-3 transition hover:border-primary/40">
                    <span className="text-2xl">{String(g["emoji"] ?? "✨")}</span>
                    <div>
                      <p className="font-semibold">{String(g["name"])}</p>
                      <p className="text-xs text-muted-foreground">
                        {String(g["member_count"] ?? 1)} members
                      </p>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}
    </AppShell>
  );
}
