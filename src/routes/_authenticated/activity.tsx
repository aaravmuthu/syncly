import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/quorum/AppShell";
import { Button, Empty, Skeleton } from "@/components/quorum/ui";
import { Avatar } from "@/components/quorum/Avatar";
import { listActivity } from "@/lib/quorum/plan.functions";
import { useNotifications, useMarkNotificationsRead } from "@/lib/quorum/useNotifications";
import { pushPermission, requestPush } from "@/lib/quorum/push";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

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

type Kind = "action" | "locked" | "groups" | "conflict";

function kindOf(type: string): Kind {
  if (/conflict|curfew|revote|re_vote|declin|cancel/i.test(type)) return "conflict";
  if (/final|locked|approv|parent/i.test(type)) return "locked";
  if (/group|member|message|chat/i.test(type)) return "groups";
  return "action";
}

const KIND: Record<
  Kind,
  { badge: string; badgeClass: string; glow: string; hover: string; label: string; cta: string }
> = {
  action: {
    badge: "⚡",
    badgeClass: "bg-emerald-500 text-black animate-pulse",
    glow: "from-emerald-500/18",
    hover: "hover:border-emerald-400/30",
    label: "Action needed",
    cta: "Vote now →",
  },
  locked: {
    badge: "🔒",
    badgeClass: "bg-cyan-400 text-black",
    glow: "from-cyan-400/16",
    hover: "hover:border-cyan-300/30",
    label: "Locked in",
    cta: "View plan",
  },
  groups: {
    badge: "💬",
    badgeClass: "bg-purple-500 text-white",
    glow: "from-purple-500/14",
    hover: "hover:border-purple-400/30",
    label: "Group",
    cta: "View plan",
  },
  conflict: {
    badge: "⚠️",
    badgeClass: "bg-amber-400 text-black",
    glow: "from-amber-400/18",
    hover: "hover:border-amber-300/35",
    label: "Conflict",
    cta: "Quick re-vote",
  },
};

type FeedItem = {
  id: string;
  kind: Kind;
  title: string;
  body?: string | null;
  created_at: string;
  plan_id: string | null;
  unread?: boolean;
  actorName?: string | null;
  actorAvatarUrl?: string | null;
  actorEmoji?: string | null;
  onOpen?: () => void;
};

function ActivityCard({ item }: { item: FeedItem }) {
  const k = KIND[item.kind];
  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-3xl border border-white/10 bg-neutral-900/70 p-4 shadow-lg backdrop-blur-md transition-all",
        k.hover,
        item.unread ? "ring-1 ring-primary/25" : "",
      )}
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -left-10 -top-16 h-40 w-40 rounded-full bg-gradient-radial blur-3xl",
          "bg-gradient-to-br to-transparent",
          k.glow,
        )}
      />
      <div className="relative flex items-start gap-3">
        <span className="relative shrink-0">
          <Avatar
            url={item.actorAvatarUrl}
            emoji={item.actorEmoji}
            name={item.actorName}
            size={40}
            className="ring-1 ring-white/10"
          />
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 grid size-5 place-items-center rounded-full text-[10px] shadow-md ring-2 ring-neutral-900",
              k.badgeClass,
            )}
            aria-label={k.label}
          >
            {k.badge}
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug">{item.title}</p>
          {item.body ? (
            <p className="mt-0.5 text-sm text-muted-foreground">{item.body}</p>
          ) : null}
          <p className="mt-1 text-xs text-muted-foreground">
            {item.actorName ? `${item.actorName} • ` : ""}
            {timeAgo(item.created_at)}
          </p>
        </div>
        {item.plan_id ? (
          <Link
            to="/plans/$planId"
            params={{ planId: item.plan_id }}
            onClick={item.onOpen}
            className={cn(
              "shrink-0 self-center rounded-full px-3.5 py-2 text-xs font-semibold transition-all",
              item.kind === "action"
                ? "bg-emerald-500 text-black hover:bg-emerald-400"
                : item.kind === "conflict"
                  ? "bg-amber-400 text-black hover:bg-amber-300"
                  : "border border-white/15 bg-white/5 text-foreground backdrop-blur hover:bg-white/10",
            )}
          >
            {k.cta}
          </Link>
        ) : null}
      </div>
    </article>
  );
}

const FILTERS: { id: "all" | Kind; label: string }[] = [
  { id: "all", label: "All" },
  { id: "action", label: "Action Needed ⚡" },
  { id: "locked", label: "Locked In 🔒" },
  { id: "groups", label: "Groups 👥" },
];

function ActivityPage() {
  const feed = useQuery({ queryKey: ["activity"], queryFn: useServerFn(listActivity) });
  const { notifications, unread } = useNotifications();
  const markRead = useMarkNotificationsRead();
  const [perm, setPerm] = useState<string>("unsupported");
  const [dismissed, setDismissed] = useState(false);
  const [filter, setFilter] = useState<"all" | Kind>("all");

  useEffect(() => {
    setPerm(pushPermission());
  }, []);

  const items = useMemo<FeedItem[]>(() => {
    const notifItems: FeedItem[] = notifications.slice(0, 12).map((n) => ({
      id: `n-${n.id}`,
      kind: kindOf(n.type),
      title: n.title,
      body: n.body,
      created_at: n.created_at,
      plan_id: n.plan_id,
      unread: !n.read,
      onOpen: () => void markRead([n.id]),
    }));
    const feedItems: FeedItem[] = (feed.data ?? []).map((e) => ({
      id: `a-${e.id}`,
      kind: kindOf(e.type),
      title: e.message,
      created_at: e.created_at,
      plan_id: e.plan_id,
      actorName: e.actorName,
      actorAvatarUrl: e.actorAvatarUrl,
      actorEmoji: e.actorEmoji,
    }));
    return [...notifItems, ...feedItems].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [notifications, feed.data, markRead]);

  const actionCount = items.filter((i) => i.kind === "action" || i.kind === "conflict").length;
  const visible = items.filter((i) =>
    filter === "all" ? true : filter === "action" ? i.kind === "action" || i.kind === "conflict" : i.kind === filter,
  );

  return (
    <AppShell
      title="Activity"
      subtitle="Everything that moved across your groups and plans."
      action={
        unread > 0 ? (
          <Button variant="outline" onClick={() => void markRead()}>
            Mark all read
          </Button>
        ) : null
      }
    >
      {perm === "default" && !dismissed ? (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-neutral-900/70 px-4 py-3 shadow-lg backdrop-blur-md">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-base">
            🔔
          </span>
          <p className="min-w-0 flex-1 text-xs text-muted-foreground">
            <span className="block text-sm font-medium text-foreground">Stay in the loop</span>
            Get pinged when a plan needs your vote or locks in.
          </p>
          <button
            onClick={async () => setPerm(await requestPush())}
            className="shrink-0 rounded-full bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-black transition-colors hover:bg-emerald-400"
          >
            Enable
          </button>
          <button
            aria-label="Dismiss"
            onClick={() => setDismissed(true)}
            className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-white/10"
          >
            ✕
          </button>
        </div>
      ) : null}

      <div className="sticky top-0 z-10 -mx-1 mb-4 flex gap-2 overflow-x-auto px-1 py-2 backdrop-blur-md">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all",
              filter === f.id
                ? "border-emerald-400/40 bg-emerald-500/15 text-foreground"
                : "border-white/10 bg-neutral-900/60 text-muted-foreground hover:border-white/20",
            )}
          >
            {f.label}
            {f.id === "action" && actionCount > 0 ? ` (${actionCount})` : ""}
          </button>
        ))}
      </div>

      {feed.isLoading ? (
        <div className="space-y-2.5">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-3xl" />
          ))}
        </div>
      ) : null}

      {!feed.isLoading && visible.length === 0 ? (
        <Empty
          title={filter === "all" ? "Nothing has happened yet" : "Nothing here yet"}
          body="Once you join a group and start a plan, every answer, vote and decision shows up here — without revealing anyone's private details."
          action={
            <Link to="/groups">
              <Button>Go to groups</Button>
            </Link>
          }
        />
      ) : null}

      <div className="space-y-2.5">
        {visible.map((item) => (
          <ActivityCard key={item.id} item={item} />
        ))}
      </div>
    </AppShell>
  );
}
