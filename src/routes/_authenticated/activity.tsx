import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/quorum/AppShell";
import { Button, Card, Empty, Skeleton } from "@/components/quorum/ui";
import { listActivity } from "@/lib/quorum/plan.functions";
import { useNotifications, useMarkNotificationsRead } from "@/lib/quorum/useNotifications";
import { pushPermission, requestPush } from "@/lib/quorum/push";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({
    meta: [
      { title: "Activity — Quorum" },
      {
        name: "description",
        content: "A running feed of what your groups planned, answered, voted on, and locked in.",
      },
      { property: "og:title", content: "Activity — Quorum" },
      { property: "og:description", content: "What changed across your groups and plans." },
    ],
  }),
  component: ActivityPage,
});

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

const ICON: Record<string, string> = {
  group_created: "◍",
  member_joined: "＋",
  plan_created: "◈",
  constraints_submitted: "✎",
  recommendations_ready: "✦",
  plan_finalized: "✓",
  parent_response: "☂",
};

function ActivityPage() {
  const feed = useQuery({ queryKey: ["activity"], queryFn: useServerFn(listActivity) });
  const { notifications, unread } = useNotifications();
  const markRead = useMarkNotificationsRead();
  const [perm, setPerm] = useState<string>("unsupported");

  useEffect(() => {
    setPerm(pushPermission());
  }, []);

  return (
    <AppShell
      title="Activity"
      subtitle="Everything that moved across your groups and plans."
      action={
        unread > 0 ? (
          <Button variant="secondary" onClick={() => void markRead()}>
            Mark all read
          </Button>
        ) : null
      }
    >
      {perm === "default" ? (
        <Card className="mb-4 flex items-center justify-between gap-3 p-4">
          <div>
            <p className="text-sm font-medium">Turn on browser notifications</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Get pinged when a plan needs your answer or gets locked in.
            </p>
          </div>
          <Button
            onClick={async () => {
              setPerm(await requestPush());
            }}
          >
            Enable
          </Button>
        </Card>
      ) : null}

      {notifications.length ? (
        <section className="mb-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Notifications
          </h2>
          <div className="space-y-2.5">
            {notifications.slice(0, 8).map((n) => (
              <Card
                key={n.id}
                className={`flex items-start gap-3 p-4 ${n.read ? "" : "ring-1 ring-primary/30"}`}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-2xl bg-secondary text-sm">
                  {ICON[n.type] ?? "•"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{n.title}</p>
                  {n.body ? <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p> : null}
                  <p className="mt-0.5 text-xs text-muted-foreground">{timeAgo(n.created_at)}</p>
                </div>
                {n.plan_id ? (
                  <Link
                    to="/plans/$planId"
                    params={{ planId: n.plan_id }}
                    onClick={() => void markRead([n.id])}
                    className="shrink-0 text-xs font-medium text-primary"
                  >
                    Open
                  </Link>
                ) : null}
              </Card>
            ))}
          </div>
          <h2 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Group feed
          </h2>
        </section>
      ) : null}

      {feed.isLoading ? (
        <div className="space-y-2.5">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-3xl" />
          ))}
        </div>
      ) : null}

      {!feed.isLoading && (feed.data ?? []).length === 0 ? (
        <Empty
          title="Nothing has happened yet"
          body="Once you join a group and start a plan, every answer, vote and decision shows up here — without revealing anyone's private details."
          action={
            <Link to="/groups">
              <Button>Go to groups</Button>
            </Link>
          }
        />
      ) : null}

      <div className="space-y-2.5">
        {(feed.data ?? []).map((e) => (
          <Card key={e.id} className="flex items-start gap-3 p-4">
            <span className="grid size-9 shrink-0 place-items-center rounded-2xl bg-secondary text-sm">
              {ICON[e.type] ?? "•"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm">{e.message}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{timeAgo(e.created_at)}</p>
            </div>
            {e.plan_id ? (
              <Link
                to="/plans/$planId"
                params={{ planId: e.plan_id }}
                className="shrink-0 text-xs font-medium text-primary"
              >
                Open
              </Link>
            ) : null}
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
