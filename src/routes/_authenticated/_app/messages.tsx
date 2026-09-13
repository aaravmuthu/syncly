import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/quorum/AppShell";
import { Avatar } from "@/components/quorum/Avatar";
import { useFriends } from "@/lib/quorum/nicknames";
import { Button, Empty, GlassPill, Skeleton } from "@/components/quorum/ui";
import { PullToRefresh } from "@/components/quorum/interactions";
import { ChatSheet } from "@/components/quorum/dm/ChatSheet";
import { DirectChat } from "@/components/quorum/dm/DirectChat";
import { SquadChat } from "@/components/quorum/SquadChat";
import { listContacts, listInbox, openThread } from "@/lib/quorum/dm.functions";

type Search = { peer?: string; thread?: string; group?: string };

export const Route = createFileRoute("/_authenticated/_app/messages")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    ...(typeof s.peer === "string" ? { peer: s.peer } : {}),
    ...(typeof s.thread === "string" ? { thread: s.thread } : {}),
    ...(typeof s.group === "string" ? { group: s.group } : {}),
  }),
  loader: ({ context }) => {
    void context.queryClient.ensureQueryData({ queryKey: ["dm-inbox"], queryFn: () => listInbox() });
    void context.queryClient.ensureQueryData({
      queryKey: ["dm-contacts"],
      queryFn: () => listContacts(),
    });
  },
  head: () => ({
    meta: [
      { title: "Messages — Syncly" },
      {
        name: "description",
        content:
          "Direct messages and squad chats in one place: live typing indicators, read receipts, safety status cards and 1-tap location sharing.",
      },
      { property: "og:title", content: "Messages — Syncly" },
      {
        property: "og:description",
        content: "Real-time DMs and squad chats with map-aware safety cards.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => null,
});

const stamp = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
};

export function MessagesPage() {
  const location = useRouterState({ select: (state) => state.location });
  const searchRef = useRef<Search>({});
  if (location.pathname === "/messages") searchRef.current = location.search as Search;
  const search = searchRef.current;
  const { alias } = useFriends();
  const navigate = useNavigate();
  const fetchInbox = useServerFn(listInbox);
  const fetchContacts = useServerFn(listContacts);
  const open = useServerFn(openThread);

  const inbox = useQuery({ queryKey: ["dm-inbox"], queryFn: () => fetchInbox(), refetchInterval: 30_000 });
  const contacts = useQuery({ queryKey: ["dm-contacts"], queryFn: () => fetchContacts() });

  const [query, setQuery] = useState("");
  const [browseNew, setBrowseNew] = useState(false);
  const [thread, setThread] = useState<string | null>(search.thread ?? null);
  const [group, setGroup] = useState<string | null>(search.group ?? null);

  /* opening from a map card: ?peer=<profileId> resolves to a thread */
  useEffect(() => {
    if (!search.peer) return;
    let alive = true;
    void open({ data: { peerId: search.peer } })
      .then((r) => {
        if (!alive) return;
        setThread(r.threadId);
        void navigate({ to: "/messages", search: { thread: r.threadId }, replace: true });
      })
      .catch(() => toast.error("Couldn't open that chat"));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.peer]);

  const q = query.trim().toLowerCase();
  const threads = useMemo(
    () =>
      (inbox.data?.threads ?? []).filter(
        (t) =>
          !q ||
          alias(t.peer?.id, t.peer?.display_name).toLowerCase().includes(q) ||
          (t.peer?.display_name ?? "").toLowerCase().includes(q),
      ),
    [inbox.data, q, alias],
  );
  const squads = useMemo(
    () => (inbox.data?.squads ?? []).filter((s) => !q || s.name.toLowerCase().includes(q)),
    [inbox.data, q],
  );
  const newContacts = useMemo(() => {
    const existing = new Set((inbox.data?.threads ?? []).map((t) => t.peer?.id));
    return (contacts.data ?? []).filter(
      (c) =>
        !existing.has(c.id) &&
        (!q || c.name.toLowerCase().includes(q) || c.circles.some((x) => x.toLowerCase().includes(q))),
    );
  }, [contacts.data, inbox.data, q]);

  async function startWith(peerId: string) {
    try {
      const r = await open({ data: { peerId } });
      setThread(r.threadId);
    } catch {
      toast.error("Couldn't start that chat");
    }
  }

  return (
    <>
      <PageHeader title="Messages" subtitle="DMs and squad chats, all in one place" />
      <PullToRefresh onRefresh={async () => void (await inbox.refetch())}>
        <div className="space-y-5">
          <GlassPill as="label" className="flex items-center gap-2 rounded-full px-3.5 py-2.5">
            <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people, handles or circles"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </GlassPill>

          {inbox.isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-16 rounded-2xl" />
              ))}
            </div>
          ) : inbox.isError ? (
            <Empty
              title="Couldn't load your chats"
              body="Check your connection and try again."
              action={<Button onClick={() => inbox.refetch()}>Try again</Button>}
            />
          ) : (
            <>
              {threads.length > 0 ? (
                <section className="space-y-2">
                  <h2 className="text-sm font-semibold text-muted-foreground">
                    Direct messages
                  </h2>
                  {threads.map((t) => (
                    <Row
                      key={t.id}
                      onClick={() => setThread(t.id)}
                      avatar={
                        <Avatar
                          url={t.peer?.avatar_url}
                          emoji={t.peer?.avatar_emoji}
                          name={alias(t.peer?.id, t.peer?.display_name)}
                          size={44}
                        />
                      }
                      title={alias(t.peer?.id, t.peer?.display_name)}
                      preview={
                        t.last ? `${t.last.mine ? "You: " : ""}${t.last.content}` : "Start the conversation"
                      }
                      at={stamp(t.lastAt)}
                      unread={t.unread}
                    />
                  ))}
                </section>
              ) : null}

              {squads.length > 0 ? (
                <section className="space-y-2">
                  <h2 className="text-sm font-semibold text-muted-foreground">
                    Squad chats
                  </h2>
                  {squads.map((s) => (
                    <Row
                      key={s.id}
                      onClick={() => setGroup(s.id)}
                      avatar={
                        <span className="grid size-11 place-items-center rounded-full bg-secondary text-lg">
                          {s.avatar_url ? (
                            <img
                              src={s.avatar_url}
                              alt=""
                              className="size-11 rounded-full object-cover"
                            />
                          ) : (
                            s.emoji
                          )}
                        </span>
                      }
                      title={s.name}
                      preview={s.last?.content ?? "No messages yet"}
                      at={stamp(s.lastAt)}
                      unread={s.unread}
                    />
                  ))}
                </section>
              ) : null}

              {newContacts.length > 0 ? (
                q || browseNew || (threads.length === 0 && squads.length === 0) ? (
                  <section className="space-y-2">
                    <h2 className="text-sm font-semibold text-muted-foreground">
                      Start a new chat
                    </h2>
                    {newContacts.slice(0, 12).map((c) => (
                      <Row
                        key={c.id}
                        onClick={() => void startWith(c.id)}
                        avatar={
                          <Avatar url={c.avatar_url} emoji={c.avatar_emoji} name={c.name} size={44} />
                        }
                        title={c.name}
                        preview={c.circles.join(" · ") || "In your circles"}
                        at=""
                        unread={0}
                      />
                    ))}
                  </section>
                ) : (
                  <button
                    type="button"
                    onClick={() => setBrowseNew(true)}
                    className="tap-target pressable flex w-full items-center gap-2 rounded-2xl border border-dashed border-border px-3.5 py-3 text-sm font-medium text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                  >
                    <UserPlus className="h-4 w-4" aria-hidden /> Start a new chat
                  </button>
                )
              ) : null}

              {threads.length === 0 && squads.length === 0 && newContacts.length === 0 ? (
                <Empty
                  title="No chats yet"
                  body="Join or create a circle to start messaging your squad — or tap Message on someone's map pin."
                />
              ) : null}
            </>
          )}
        </div>
      </PullToRefresh>

      <ChatSheet
        open={Boolean(thread)}
        onOpenChange={(v) => {
          if (!v) {
            setThread(null);
            void navigate({ to: "/messages", search: {}, replace: true });
          }
        }}
      >
        {thread ? <DirectChat threadId={thread} className="min-h-0 flex-1" /> : null}
      </ChatSheet>

      <ChatSheet open={Boolean(group)} onOpenChange={(v) => !v && setGroup(null)}>
        {group ? (
          <div className="flex min-h-0 flex-1 flex-col p-2">
            <SquadChat groupId={group} className="min-h-0 flex-1 rounded-2xl" />
          </div>
        ) : null}
      </ChatSheet>
    </>
  );
}

function Row({
  avatar,
  title,
  preview,
  at,
  unread,
  onClick,
}: {
  avatar: React.ReactNode;
  title: string;
  preview: string;
  at: string;
  unread: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border border-border/60 bg-card/60 px-3.5 py-3 text-left transition active:scale-[0.99] hover:border-primary/40"
    >
      {avatar}
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          {/* "New member" is the literal default display_name for anyone who
              hasn't set a real name yet -- not a unique identifier, so two
              different unnamed people would otherwise render as identical,
              indistinguishable rows. Style it as a visible placeholder
              instead of a real name. */}
          {title === "New member" ? (
            <span className="truncate text-sm italic text-muted-foreground">No name set</span>
          ) : (
            <span className="truncate text-sm font-semibold">{title}</span>
          )}
          <span className="shrink-0 text-caption text-muted-foreground">{at}</span>
        </span>
        <span className="mt-0.5 flex items-center justify-between gap-2">
          <span className="truncate text-xs text-muted-foreground">{preview}</span>
          {unread > 0 ? (
            <span className="grid min-w-5 shrink-0 place-items-center rounded-full bg-primary px-1.5 text-caption font-bold text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </span>
      </span>
    </button>
  );
}

