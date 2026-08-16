import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/quorum/AppShell";
import { Card, Empty, Pill, Skeleton, Button } from "@/components/quorum/ui";
import { listPlans } from "@/lib/quorum/plan.functions";
import { categoryMeta } from "@/lib/quorum/types";

export const Route = createFileRoute("/_authenticated/plans/")({
  head: () => ({
    meta: [
      { title: "All plans — Quorum" },
      {
        name: "description",
        content: "Every plan across your groups: collecting answers, open for votes, or locked in.",
      },
      { property: "og:title", content: "All plans — Quorum" },
      { property: "og:description", content: "Every plan across your groups in one place." },
    ],
  }),
  component: PlansPage,
});

function PlansPage() {
  const plans = useQuery({ queryKey: ["plans"], queryFn: useServerFn(listPlans) });

  return (
    <AppShell title="Plans" subtitle="Everything your groups are working out right now.">
      {plans.isLoading ? <Skeleton className="h-24 rounded-3xl" /> : null}
      {!plans.isLoading && (plans.data ?? []).length === 0 ? (
        <Empty
          title="Nothing planned"
          body="Plans start inside a group so the right people get asked."
          action={
            <Link to="/groups">
              <Button>Go to groups</Button>
            </Link>
          }
        />
      ) : null}
      <div className="space-y-3">
        {(plans.data ?? []).map((p) => {
          const meta = categoryMeta(p.category);
          const g = p.groups as { name?: string; emoji?: string } | null;
          return (
            <Link key={p.id} to="/plans/$planId" params={{ planId: p.id }}>
              <Card className="flex items-center justify-between gap-3 transition hover:border-primary/40">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">
                    {g?.emoji ?? meta.emoji} {g?.name ?? meta.label}
                  </p>
                  <p className="font-display font-semibold">{p.title}</p>
                  {p.compatibility_score != null ? (
                    <p className="text-xs text-muted-foreground">
                      Best option: {p.compatibility_score}% compatible
                    </p>
                  ) : null}
                </div>
                <Pill tone={p.status === "finalized" ? "good" : "accent"}>{p.status}</Pill>
              </Card>
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}
