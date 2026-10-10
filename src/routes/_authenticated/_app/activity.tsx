import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Bell, Lock, MessageCircle, X, Zap, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/quorum/AppShell";
import { Button, Empty, Skeleton } from "@/components/quorum/ui";
import { Avatar } from "@/components/quorum/Avatar";
import { useFriends } from "@/lib/quorum/friends-context";
import { listActivity } from "@/lib/quorum/plan.functions";
import { useNotifications, useMarkNotificationsRead } from "@/lib/quorum/useNotifications";
import { pushPermission, requestPush } from "@/lib/quorum/push";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  LongPress,
  PullToRefresh,
  SpotlightCard,
  SwipeRow,
} from "@/components/quorum/interactions";
import { toast } from "@/lib/quorum/toast";

export const Route = createFileRoute("/_authenticated/_app/activity")({
  loader: ({ context }) => {
    void context.queryClient.ensureQueryData({
      queryKey: ["activity"],
      queryFn: () => listActivity(),
    });
  },
  head: () => ({
    meta: [
      { title: "Activity — Syncly" },
      {
        name: "description",
        content: "A running feed of what your groups planned, answered, voted on, and locked in.",
      },
      { property: "og:title", content: "Activity — Syncly" },
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

// Colors route through the app's semantic tokens, not raw Tailwind hues --
// cyan/purple in particular weren't part of the design-token palette at all.
const KIND: Record<
  Kind,
  { badge: LucideIcon; badgeClass: string; glow: string; hover: string; label: string; cta: string }
> = {
  action: {
    badge: Zap,
    badgeClass: "bg-primary text-primary-foreground animate-pulse",
    glow: "from-primary/18",
    hover: "hover:border-primary/30",
    label: "Action needed",
    cta: "Vote now →",
  },
  locked: {
    badge: Lock,
    badgeClass: "bg-success text-background",
    glow: "from-success/16",
    hover: "hover:border-success/30",
    label: "Locked in",
    cta: "View plan",
  },
  groups: {
    badge: MessageCircle,
    badgeClass: "bg-secondary-foreground/80 text-secondary",
    glow: "from-foreground/10",
    hover: "hover:border-foreground/20",
    label: "Group",
    cta: "View plan",
  },
  conflict: {
    badge: AlertTriangle,
    badgeClass: "bg-warning text-foreground dark:text-background",
    glow: "from-warning/18",
    hover: "hover:border-warning/35",
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
  actorId?: string | null;
  actorName?: string | null;
  actorAvatarUrl?: string | null;
  actorEmoji?: string | null;
  onOpen?: () => void;
};

function ActivityCard({ item }: { item: FeedItem }) {
  const k = KIND[item.kind];
  const { alias, openFriend } = useFriends();
  const actorName = item.actorId ? alias(item.actorId, item.actorName) : item.actorName;
  return (
    <SpotlightCard
      as="article"
      className={cn(
        "group surface relative overflow-hidden p-4 transition-[border-color,box-shadow] duration-200 ease-out",
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
        <span
          className="relative shrink-0"
          role={item.actorId ? "button" : undefined}
          tabIndex={item.actorId ? 0 : undefined}
          onClick={() => item.actorId && openFriend(item.actorId)}
        >
          <Avatar
            url={item.actorAvatarUrl}
            emoji={item.actorEmoji}
            name={actorName}
            size={40}
            className="ring-1 ring-border"
          />
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 grid size-5 place-items-center rounded-full shadow-md ring-2 ring-card",
              k.badgeClass,
            )}
            aria-label={k.label}
          >
            <k.badge className="size-3" aria-hidden />
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug">{item.title}</p>
          {item.body ? <p className="mt-0.5 text-sm text-muted-foreground">{item.body}</p> : null}
          <p className="mt-1 text-xs text-muted-foreground">
            {actorName ? `${actorName} • ` : ""}
            {timeAgo(item.created_at)}
          </p>
        </div>
        {item.plan_id ? (
          <Link
            to="/plans/$planId"
            params={{ planId: item.plan_id }}
            onClick={item.onOpen}
            className={cn(
              "hit-slop shrink-0 self-center rounded-full px-3.5 py-2 text-xs font-semibold transition-[opacity,background-color,transform] ease-out active:scale-[0.97]",
              item.kind === "action"
                ? "bg-primary text-primary-foreground hover:opacity-90"
                : item.kind === "conflict"
                  ? "bg-warning text-foreground hover:opacity-90 dark:text-background"
                  : "border border-border bg-secondary/70 text-foreground hover:bg-secondary",
            )}
          >
            {k.cta}
          </Link>
        ) : null}
      </div>
    </SpotlightCard>
  );
}

const FILTERS: { id: "all" | Kind; label: string }[] = [
  { id: "all", label: "All" },
  { id: "action", label: "Action needed" },
  { id: "locked", label: "Locked in" },
  { id: "groups", label: "Groups" },
];

function ActivityPage() {
  const feed = useQuery({ queryKey: ["activity"], queryFn: useServerFn(listActivity) });
  const {
    notifications,
    unread,
    isError: notificationsError,
    refetch: refetchNotifications,
  } = useNotifications();
  const markRead = useMarkNotificationsRead();
  const [perm, setPerm] = useState<string>("unsupported");
  const [dismissed, setDismissed] = useState(false);
  const [filter, setFilter] = useState<"all" | Kind>("all");
  const [hidden, setHidden] = useState<string[]>([]);

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
      actorId: e.actorId,
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
    hidden.includes(i.id)
      ? false
      : filter === "all"
        ? true
        : filter === "action"
          ? i.kind === "action" || i.kind === "conflict"
          : i.kind === filter,
  );

  return (
    <>
      <PageHeader
        title="Activity"
        subtitle="Everything that moved across your groups and plans."
        action={
          unread > 0 ? (
            <Button variant="outline" onClick={() => void markRead()}>
              Mark all read
            </Button>
          ) : null
        }
      />
      {perm === "default" && !dismissed ? (
        <div className="surface mb-4 flex items-center gap-3 px-4 py-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
            <Bell className="size-4" aria-hidden />
          </span>
          <p className="min-w-0 flex-1 text-xs text-muted-foreground">
            <span className="block text-sm font-medium text-foreground">Stay in the loop</span>
            Get pinged when a plan needs your vote or locks in.
          </p>
          <button
            onClick={async () => setPerm(await requestPush())}
            className="tap-target shrink-0 rounded-full bg-primary px-3.5 text-xs font-semibold text-primary-foreground transition-colors hover:opacity-90"
          >
            Enable
          </button>
          <button
            aria-label="Dismiss"
            onClick={() => setDismissed(true)}
            className="tap-target grid shrink-0 place-items-center rounded-full p-1.5 text-muted-foreground hover:bg-secondary"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      ) : null}

      <div className="scrollbar-none sticky top-0 z-10 -mx-1 mb-4 flex snap-x gap-2 overflow-x-auto px-1 py-2 backdrop-blur-md">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "hit-slop shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-[color,background-color,border-color,transform] ease-out active:scale-[0.97]",
              filter === f.id
                ? "border-primary/40 bg-primary/15 text-foreground"
                : "border-border bg-secondary/70 text-muted-foreground hover:border-foreground/20",
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
            <Skeleton key={i} className="h-20 rounded-surface" />
          ))}
        </div>
      ) : null}

      {feed.isError || notificationsError ? (
        <Empty
          title="Couldn't load all activity"
          body="Check your connection and try again."
          action={
            <Button
              onClick={() => {
                void feed.refetch();
                void refetchNotifications();
              }}
            >
              Try again
            </Button>
          }
        />
      ) : null}
      {!feed.isLoading && !feed.isError && !notificationsError && visible.length === 0 ? (
        items.length > 0 ? (
          // A filter came up empty, not the feed -- don't show the first-run copy.
          <Empty
            title={
              filter === "locked"
                ? "No plans locked in yet"
                : filter === "action"
                  ? "You're all caught up"
                  : "No group updates yet"
            }
            body="Nothing in this filter right now."
            action={
              <Button variant="outline" onClick={() => setFilter("all")}>
                Show all activity
              </Button>
            }
          />
        ) : (
          <Empty
            title="Nothing has happened yet"
            body="Once you join a group and start a plan, every answer, vote and decision shows up here — without revealing anyone's private details."
            action={
              <Link to="/groups">
                <Button>Go to groups</Button>
              </Link>
            }
          />
        )
      ) : null}

      <PullToRefresh onRefresh={() => feed.refetch()}>
        <div className="space-y-2.5">
          {visible.map((item) => (
            <SwipeRow
              key={item.id}
              left={
                item.plan_id
                  ? {
                      label: "I'm in",
                      tone: "primary",
                      onAction: () => toast.success("Marked as interested"),
                    }
                  : undefined
              }
              right={{
                label: hidden.includes(item.id) ? "Muted" : "Ignore",
                tone: "muted",
                onAction: () => setHidden((h) => (h.includes(item.id) ? h : [...h, item.id])),
              }}
            >
              <LongPress
                title={item.title}
                actions={[
                  { label: "Mark as read", onSelect: () => item.onOpen?.() },
                  {
                    label: "Hide this update",
                    destructive: true,
                    onSelect: () => setHidden((h) => [...h, item.id]),
                  },
                ]}
              >
                <ActivityCard item={item} />
              </LongPress>
            </SwipeRow>
          ))}
        </div>
      </PullToRefresh>
    </>
  );
}
