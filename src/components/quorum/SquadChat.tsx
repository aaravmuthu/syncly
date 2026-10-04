import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Camera, Car, Copy, Lock, RotateCcw, Reply, Sparkles, Trash2, X, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/quorum/Avatar";
import { Button, Spinner } from "@/components/quorum/ui";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/quorum/haptics";
import { listMessages, markRead, sendMessage, uploadChatImage } from "@/lib/quorum/chat.functions";
import { prepareImageUpload } from "@/lib/quorum/safe-upload";
import { ChatComposer } from "@/components/quorum/chat/Composer";
import { clock, layoutRows, type ClusterPos } from "@/components/quorum/chat/layout";
import {
  BubbleSurface,
  RevealRow,
  SwipeRow,
  type MenuAction,
} from "@/components/quorum/chat/MessageBubble";
import { useRise } from "@/components/quorum/chat/motion";
import {
  JumpToLatest,
  SystemNote,
  ThreadEmpty,
  ThreadError,
  ThreadSkeleton,
  TimeHeader,
  TypingBubble,
} from "@/components/quorum/chat/ThreadParts";
import { useChatScroll } from "@/components/quorum/chat/useChatScroll";
import { usePendingMessages, type Pending } from "@/components/quorum/chat/usePendingMessages";

type Msg = {
  id: string;
  group_id: string;
  plan_id: string | null;
  sender_id: string | null;
  content: string;
  media_url: string | null;
  reply_to_id: string | null;
  system_type: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
  profiles?: {
    id: string;
    display_name: string;
    avatar_emoji: string | null;
    avatar_url: string | null;
  } | null;
  reply_to?: { id: string; content: string; profiles?: { display_name: string } | null } | null;
};

type Read = {
  message_id: string;
  profile_id: string;
  profiles?: {
    display_name: string;
    avatar_emoji: string | null;
    avatar_url: string | null;
  } | null;
};

type SendPayload = {
  groupId: string;
  planId: string | null;
  content: string;
  mediaUrl: string | null;
  replyToId: string | null;
};

type Item = { kind: "msg"; m: Msg } | { kind: "pending"; p: Pending<SendPayload> };

const KNOWN_SYSTEM = new Set(["plan_created", "ride_update", "plan_locked"]);

export function SquadChat({
  groupId,
  planId = null,
  className,
}: {
  groupId: string;
  planId?: string | null;
  className?: string;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fetchMessages = useServerFn(listMessages);
  const send = useServerFn(sendMessage);
  const mark = useServerFn(markRead);
  const upload = useServerFn(uploadChatImage);

  const key = useMemo(() => ["squad-chat", groupId, planId ?? "all"], [groupId, planId]);
  const q = useQuery({
    queryKey: key,
    queryFn: () => fetchMessages({ data: { groupId, planId } }),
  });

  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [uploading, setUploading] = useState(false);
  const [typers, setTypers] = useState<Record<string, { name: string; at: number }>>({});
  const fileRef = useRef<HTMLInputElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTyped = useRef(0);
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageIds = useRef<Set<string>>(new Set());
  /** Ids present on first load: only messages that arrive later animate in. */
  const initialIds = useRef<Set<string> | null>(null);

  const messages = useMemo(() => (q.data?.messages ?? []) as unknown as Msg[], [q.data?.messages]);
  const reads = useMemo(() => (q.data?.reads ?? []) as unknown as Read[], [q.data?.reads]);
  const me = q.data?.me ?? null;
  const hostId = q.data?.hostId ?? null;
  const myName = messages.find((m) => m.sender_id === me)?.profiles?.display_name ?? "Someone";
  messageIds.current = new Set(messages.map((m) => m.id));
  if (q.data && !initialIds.current) initialIds.current = new Set(messages.map((m) => m.id));

  const refetchSoon = useCallback(() => {
    if (refetchTimer.current) return;
    refetchTimer.current = setTimeout(() => {
      refetchTimer.current = null;
      void qc.invalidateQueries({ queryKey: key });
    }, 150);
  }, [qc, key]);

  const pend = usePendingMessages<SendPayload>(
    useCallback(
      async (payload) => {
        const r = await send({ data: payload });
        haptic("tap");
        refetchSoon();
        void qc.invalidateQueries({ queryKey: ["dm-inbox"] });
        return r;
      },
      [send, qc, refetchSoon],
    ),
  );
  const pendingRows = pend.visible(
    messages.map((m) => ({ id: m.id, sender: m.sender_id, content: m.content })),
    me,
  );

  const items = useMemo<Item[]>(
    () => [
      ...messages.map((m): Item => ({ kind: "msg", m })),
      ...pendingRows.map((p): Item => ({ kind: "pending", p })),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [messages, pend.pending],
  );
  const rows = useMemo(
    () =>
      layoutRows(items, (it) =>
        it.kind === "msg"
          ? {
              id: it.m.id,
              sender: it.m.sender_id,
              at: it.m.created_at,
              system: Boolean(it.m.system_type),
            }
          : { id: it.p.cid, sender: me, at: it.p.at, system: false },
      ),
    [items, me],
  );
  const scroll = useChatScroll(rows.length);

  const readsByMessage = useMemo(() => {
    const map = new Map<string, Read[]>();
    for (const r of reads) {
      if (r.profile_id === me) continue;
      map.set(r.message_id, [...(map.get(r.message_id) ?? []), r]);
    }
    return map;
  }, [reads, me]);

  /* the newest of my messages: it alone carries the receipt line */
  const lastMineKey = useMemo(() => {
    for (let i = rows.length - 1; i >= 0; i -= 1) {
      const it = rows[i]!.item;
      if (it.kind === "pending") return it.p.cid;
      if (!it.m.system_type && it.m.sender_id === me) return it.m.id;
    }
    return null;
  }, [rows, me]);

  /* live message + receipt stream ---------------------------------- */
  useEffect(() => {
    const channel = supabase
      .channel(`squad-chat:${groupId}:${planId ?? "all"}`, {
        config: { broadcast: { self: false } },
      })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "group_messages",
          filter: `group_id=eq.${groupId}`,
        },
        () => {
          refetchSoon();
          void qc.invalidateQueries({ queryKey: ["dm-inbox"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "message_reads" },
        ({ new: row }) => {
          // Reads for other chats arrive here too; only ours are worth a refetch.
          if (messageIds.current.has((row as { message_id?: string }).message_id ?? "")) {
            refetchSoon();
          }
        },
      )
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const p = payload as { id: string; name: string };
        if (!p?.id || p.id === me) return;
        setTypers((prev) => ({ ...prev, [p.id]: { name: p.name, at: Date.now() } }));
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, planId, me]);

  /* expire typing bubbles after 3s ---------------------------------- */
  useEffect(() => {
    const t = setInterval(() => {
      setTypers((prev) => {
        const next: typeof prev = {};
        let changed = false;
        for (const [id, v] of Object.entries(prev)) {
          if (Date.now() - v.at < 3000) next[id] = v;
          else changed = true;
        }
        return changed ? next : prev;
      });
    }, 500);
    return () => clearInterval(t);
  }, []);

  /* mark unread messages as read, only while the chat is on screen ----- */
  useEffect(() => {
    if (!me || messages.length === 0) return;
    const run = () => {
      if (document.visibilityState !== "visible") return;
      const mine = new Set(reads.filter((r) => r.profile_id === me).map((r) => r.message_id));
      const todo = messages
        .filter((m) => m.sender_id && m.sender_id !== me && !mine.has(m.id))
        .map((m) => m.id);
      if (todo.length > 0) void mark({ data: { messageIds: todo } });
    };
    run();
    document.addEventListener("visibilitychange", run);
    return () => document.removeEventListener("visibilitychange", run);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, me, reads.length]);

  const broadcastTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTyped.current < 900) return;
    lastTyped.current = now;
    void channelRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { id: me, name: myName },
    });
  }, [me, myName]);

  function submit(body: string, mediaUrl?: string | null) {
    const content = body.trim();
    if (!content && !mediaUrl) return;
    scroll.stick();
    haptic("tap");
    pend.enqueue(
      { groupId, planId, content, mediaUrl: mediaUrl ?? null, replyToId: replyTo?.id ?? null },
      content,
      messages.map((m) => m.id),
    );
    setText("");
    setReplyTo(null);
  }

  async function pickPhoto(file: File) {
    setUploading(true);
    try {
      // Validated by its bytes and stripped of EXIF/GPS before it leaves the phone.
      const { dataUrl, ext } = await prepareImageUpload(file);
      const { url } = await upload({ data: { dataUrl, ext } });
      submit(text, url);
    } catch (e) {
      toast.error("Couldn't send that photo", {
        description: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setUploading(false);
    }
  }

  const typingNames = Object.values(typers).map((t) => t.name);

  return (
    <div
      className={cn(
        "relative flex min-h-0 flex-col overflow-hidden rounded-3xl border border-border bg-card/85 shadow-2xl backdrop-blur-xl",
        className,
      )}
    >
      <div className="relative min-h-0 flex-1">
        <div
          ref={scroll.ref}
          onScroll={scroll.onScroll}
          className="absolute inset-0 overflow-y-auto overscroll-contain px-3 py-3"
        >
          <div className="flex min-h-full flex-col justify-end" aria-live="polite">
            {q.isLoading ? (
              <ThreadSkeleton />
            ) : q.isError ? (
              <ThreadError onRetry={() => void q.refetch()} />
            ) : rows.length === 0 ? (
              <ThreadEmpty
                title="No messages yet"
                body="Say something to the squad — plans, rides and photos all land here."
              />
            ) : null}

            {rows.map(({ item, pos, header }) => {
              const rowKey = item.kind === "msg" ? item.m.id : item.p.cid;
              return (
                <div key={rowKey}>
                  {header ? <TimeHeader label={header} /> : null}
                  {item.kind === "msg" && item.m.system_type ? (
                    KNOWN_SYSTEM.has(item.m.system_type) ? (
                      <SystemCard
                        msg={item.m}
                        onVote={(id) => navigate({ to: "/plans/$planId", params: { planId: id } })}
                      />
                    ) : (
                      <SystemNote>{item.m.content}</SystemNote>
                    )
                  ) : (
                    <SquadRow
                      item={item}
                      pos={pos}
                      me={me}
                      messages={messages}
                      isHost={Boolean(item.kind === "msg" && hostId && item.m.sender_id === hostId)}
                      animateIn={
                        item.kind === "pending" ||
                        (!initialIds.current?.has(item.m.id) && item.m.sender_id !== me)
                      }
                      readers={rowKey === lastMineKey ? (readsByMessage.get(rowKey) ?? []) : []}
                      isLastMine={rowKey === lastMineKey}
                      onReply={(m) => {
                        setReplyTo(m);
                        inputRef.current?.focus();
                      }}
                      onRetry={pend.retry}
                      onDiscard={pend.discard}
                    />
                  )}
                </div>
              );
            })}

            <AnimatePresence>
              {typingNames.length > 0 ? (
                <TypingBubble
                  label={
                    typingNames.length === 1
                      ? `${typingNames[0]} is typing`
                      : `${typingNames.length} people are typing`
                  }
                />
              ) : null}
            </AnimatePresence>
          </div>
        </div>
        <JumpToLatest
          show={scroll.away}
          unseen={scroll.unseen}
          onClick={() => scroll.scrollToBottom(true)}
        />
      </div>

      <ChatComposer
        value={text}
        onChange={setText}
        onSend={() => submit(text)}
        onTyping={broadcastTyping}
        textareaRef={inputRef}
        placeholder="Message the squad…"
        leading={
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void pickPhoto(f);
              }}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              aria-label="Add photo"
              className="tap-target grid size-11 shrink-0 place-items-center rounded-full bg-secondary/60 text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-60"
            >
              {uploading ? <Spinner /> : <Camera className="size-[1.125rem]" aria-hidden />}
            </button>
          </>
        }
        top={<ReplyBar replyTo={replyTo} onCancel={() => setReplyTo(null)} />}
      />
    </div>
  );
}

function ReplyBar({ replyTo, onCancel }: { replyTo: Msg | null; onCancel: () => void }) {
  const rise = useRise(6, 0.16);
  return (
    <AnimatePresence>
      {replyTo ? (
        <motion.div
          {...rise}
          className="mb-2 flex items-start gap-2 rounded-2xl border border-border bg-secondary/50 px-3 py-2"
        >
          <span className="mt-0.5 h-full min-h-8 w-0.5 rounded bg-primary/70" />
          <div className="min-w-0 flex-1">
            <p className="text-caption font-semibold text-primary">
              {replyTo.profiles?.display_name ?? "Member"}
            </p>
            <p className="truncate text-xs text-muted-foreground">{replyTo.content || "Photo"}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel reply"
            className="tap-target grid place-items-center rounded-lg text-muted-foreground hover:bg-secondary"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function SquadRow({
  item,
  pos,
  me,
  messages,
  isHost,
  animateIn,
  readers,
  isLastMine,
  onReply,
  onRetry,
  onDiscard,
}: {
  item: Item;
  pos: ClusterPos;
  me: string | null;
  messages: Msg[];
  isHost: boolean;
  animateIn: boolean;
  readers: Read[];
  isLastMine: boolean;
  onReply: (m: Msg) => void;
  onRetry: (cid: string) => void;
  onDiscard: (cid: string) => void;
}) {
  const [showTime, setShowTime] = useState(false);
  const rise = useRise(8, 0.18);

  const msg = item.kind === "msg" ? item.m : null;
  const pending = item.kind === "pending" ? item.p : null;
  const mine = Boolean(pending) || msg?.sender_id === me;
  const failed = pending?.status === "failed";
  const body = msg?.content ?? pending?.text ?? "";
  const mediaUrl = msg?.media_url ?? pending?.payload.mediaUrl ?? null;
  const at = msg?.created_at ?? pending?.at ?? "";
  const quoted =
    msg?.reply_to ??
    (pending?.payload.replyToId
      ? (() => {
          const o = messages.find((m) => m.id === pending.payload.replyToId);
          return o ? { id: o.id, content: o.content, profiles: o.profiles } : null;
        })()
      : null);

  const showName = !mine && (pos === "single" || pos === "first");
  const showAvatar = !mine && (pos === "single" || pos === "last");

  const actions: MenuAction[] = [];
  if (failed && pending) {
    actions.push(
      {
        key: "retry",
        label: "Retry",
        icon: <RotateCcw className="size-4" />,
        onSelect: () => onRetry(pending.cid),
      },
      {
        key: "discard",
        label: "Delete",
        icon: <Trash2 className="size-4" />,
        destructive: true,
        onSelect: () => onDiscard(pending.cid),
      },
    );
  } else {
    if (msg) {
      actions.push({
        key: "reply",
        label: "Reply",
        icon: <Reply className="size-4" />,
        onSelect: () => onReply(msg),
      });
    }
    if (body) {
      actions.push({
        key: "copy",
        label: "Copy",
        icon: <Copy className="size-4" />,
        onSelect: () => {
          navigator.clipboard
            .writeText(body)
            .then(() => toast("Copied"))
            .catch(() => toast.error("Couldn't copy that"));
        },
      });
    }
  }

  const receipt = !mine || !isLastMine || failed ? null : !msg ? "Sending…" : null;

  const row = (
    <SwipeRow
      onReply={msg && !failed ? () => onReply(msg) : undefined}
      className={pos === "single" || pos === "first" ? "mt-2" : "mt-0.5"}
    >
      <div className={cn("flex items-end gap-2", mine && "flex-row-reverse")}>
        {!mine ? (
          <div className="size-7 shrink-0">
            {showAvatar ? (
              <Avatar
                url={msg?.profiles?.avatar_url}
                emoji={msg?.profiles?.avatar_emoji}
                name={msg?.profiles?.display_name}
                size={28}
              />
            ) : null}
          </div>
        ) : null}
        <div className={cn("flex max-w-[78%] flex-col", mine ? "items-end" : "items-start")}>
          {showName ? (
            <p className="px-3 pb-0.5 text-caption text-muted-foreground">
              {msg?.profiles?.display_name ?? "Member"}
              {isHost ? (
                <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-caption font-semibold text-primary">
                  Host
                </span>
              ) : null}
            </p>
          ) : null}
          <BubbleSurface
            mine={mine}
            pos={pos}
            status={pending?.status}
            actions={actions}
            onTap={failed && pending ? () => onRetry(pending.cid) : () => setShowTime((v) => !v)}
          >
            {/* Fixed dark scrim regardless of theme: this sits on the bubble's
                own solid color (primary or secondary), not the page surface. */}
            {quoted ? (
              <span className="mb-1.5 block rounded-xl border border-white/10 bg-black/25 px-2 py-1 text-caption text-white/55">
                <span className="font-semibold text-white/75">
                  {quoted.profiles?.display_name ?? "Member"}
                </span>
                : {quoted.content || "Photo"}
              </span>
            ) : null}
            {mediaUrl ? (
              <img
                src={mediaUrl}
                alt="Shared in chat"
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                draggable={false}
                className={cn("max-h-60 w-full rounded-xl object-cover", body && "mb-1.5")}
              />
            ) : null}
            {body}
          </BubbleSurface>
        </div>
      </div>

      {failed ? (
        <button
          type="button"
          onClick={() => pending && onRetry(pending.cid)}
          className={cn(
            "mt-1 block px-1 text-caption font-medium text-destructive",
            mine ? "ml-auto" : "ml-9",
          )}
        >
          Not delivered · Tap to retry
        </button>
      ) : null}

      <RevealRow open={showTime}>
        <p
          className={cn(
            "px-1 pt-1 text-caption text-muted-foreground",
            mine ? "text-right" : "pl-10",
          )}
        >
          {clock(at)}
        </p>
      </RevealRow>

      {isLastMine && mine && !failed ? (
        <div className="mt-1 flex items-center justify-end gap-1 px-1">
          {readers.length > 0 ? (
            <>
              <div className="flex -space-x-1.5">
                {readers.slice(0, 4).map((r) => (
                  <Avatar
                    key={r.profile_id}
                    url={r.profiles?.avatar_url}
                    emoji={r.profiles?.avatar_emoji}
                    name={r.profiles?.display_name}
                    size={16}
                    className="ring-1 ring-card"
                  />
                ))}
              </div>
              <span className="text-caption text-muted-foreground">
                Seen by {readers[0]?.profiles?.display_name ?? "someone"}
                {readers.length > 1 ? ` +${readers.length - 1}` : ""}
              </span>
            </>
          ) : (
            <span className="text-caption text-muted-foreground">{receipt ?? "Sent"}</span>
          )}
        </div>
      ) : null}
    </SwipeRow>
  );

  return animateIn ? <motion.div {...rise}>{row}</motion.div> : row;
}

function SystemCard({ msg, onVote }: { msg: Msg; onVote: (planId: string) => void }) {
  const meta = (msg.meta ?? {}) as { emoji?: string; title?: string; cost?: string };
  const isPlan = msg.system_type === "plan_created";
  const isRide = msg.system_type === "ride_update";
  const TagIcon = isPlan ? Zap : isRide ? Car : Lock;
  const FallbackIcon = isPlan ? Sparkles : isRide ? Car : Lock;
  const tagText = isPlan ? "New plan proposal" : isRide ? "Ride update" : "Plan locked in";
  const title = meta.title ?? msg.content;
  return (
    // Narrower than a message bubble and always centered (never left/right
    // aligned like a person's message) so a system event reads unmistakably
    // as chrome, not a message from someone in the chat.
    <div className="mx-auto mt-3 w-full max-w-[75%] overflow-hidden rounded-2xl border border-primary/25 bg-primary/10 p-4 text-center shadow-xl backdrop-blur">
      <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-caption font-semibold text-primary">
        <TagIcon className="size-3" aria-hidden /> {tagText}
      </span>
      <p className="mt-2 flex items-center justify-center gap-2 text-base font-semibold text-foreground">
        {/* meta.emoji is a host-chosen plan-category snapshot saved with the
            message -- content, not a status glyph, so it stays as emoji when
            present; only the generic fallback becomes a lucide icon. */}
        {meta.emoji ? (
          <span>{meta.emoji}</span>
        ) : (
          <FallbackIcon className="size-4 text-primary" aria-hidden />
        )}
        <span className="truncate">{title}</span>
      </p>
      {meta.cost ? (
        <span className="mt-2 inline-block rounded-full bg-secondary px-2.5 py-0.5 text-caption text-secondary-foreground">
          {meta.cost}
        </span>
      ) : null}
      {isPlan && msg.plan_id ? (
        <Button className="mt-3 w-full text-xs" onClick={() => onVote(msg.plan_id!)}>
          <Zap className="size-3.5" aria-hidden /> Vote now
        </Button>
      ) : null}
      <p className="mt-2 text-caption text-muted-foreground">{clock(msg.created_at)}</p>
    </div>
  );
}
