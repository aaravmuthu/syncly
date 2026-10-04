import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "motion/react";
import {
  BatteryFull,
  BatteryLow,
  Copy,
  MapPin,
  Mic,
  Navigation,
  RotateCcw,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/quorum/Avatar";
import { useFriends } from "@/lib/quorum/friends-context";
import { haptic } from "@/lib/quorum/haptics";
import {
  getThread,
  markThreadRead,
  sendDirect,
  toggleReaction,
  uploadVoiceNote,
} from "@/lib/quorum/dm.functions";
import { prepareVoiceUpload } from "@/lib/quorum/safe-upload";
import { cn } from "@/lib/utils";
import { UNNAMED, firstName } from "@/lib/quorum/names";
import { ChatComposer } from "@/components/quorum/chat/Composer";
import { clock, layoutRows, type ClusterPos } from "@/components/quorum/chat/layout";
import {
  BubbleSurface,
  ReactionChips,
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

type DM = {
  id: string;
  thread_id: string;
  sender_id: string | null;
  kind: string;
  content: string;
  media_url: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
};

type Reaction = { message_id: string; profile_id: string; emoji: string };
type SendPayload = {
  threadId: string;
  content?: string;
  kind?: "text" | "location" | "venue" | "voice";
  mediaUrl?: string | null;
  meta?: { lat?: number; lon?: number; label?: string };
};
/** Just the slice of the getThread result this component patches in place. */
type ThreadCache = { messages: DM[]; reactions: Reaction[] };

const REACTIONS = ["❤️", "👍", "😂", "🔥", "😮", "📍"];

const CONTEXT_PILLS = [
  "Glad you made it safely! 👍",
  "What's the ETA?",
  "Share my live location 📍",
];

type Item = { kind: "msg"; m: DM } | { kind: "pending"; p: Pending<SendPayload> };

export function DirectChat({
  threadId,
  onClose,
  className,
  circle,
}: {
  threadId: string;
  onClose?: () => void;
  className?: string;
  /** A circle you share with the peer, used to label them if they never set a name. */
  circle?: string;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { alias, openFriend } = useFriends();
  const fetchThread = useServerFn(getThread);
  const send = useServerFn(sendDirect);
  const mark = useServerFn(markThreadRead);
  const react = useServerFn(toggleReaction);
  const upVoice = useServerFn(uploadVoiceNote);

  const key = useMemo(() => ["dm-thread", threadId], [threadId]);
  const q = useQuery({ queryKey: key, queryFn: () => fetchThread({ data: { threadId } }) });

  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [peerOnline, setPeerOnline] = useState(false);
  const [recording, setRecording] = useState(false);
  const [uploadingVoice, setUploadingVoice] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const lastTyped = useRef(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  /** Ids present on first load: only messages that arrive later animate in. */
  const initialIds = useRef<Set<string> | null>(null);

  const me = q.data?.me ?? null;
  const peer = q.data?.peer ?? null;
  const messages = useMemo(() => (q.data?.messages ?? []) as unknown as DM[], [q.data?.messages]);
  const reactions = useMemo(
    () => (q.data?.reactions ?? []) as unknown as Reaction[],
    [q.data?.reactions],
  );
  const telemetry = q.data?.telemetry ?? null;
  const peerReadAt = q.data?.peerReadAt ?? null;
  if (q.data && !initialIds.current) initialIds.current = new Set(messages.map((m) => m.id));

  /* a coalesced refetch, for events we can't patch from the payload -------- */
  const refetchSoon = useCallback(() => {
    if (refetchTimer.current) return;
    refetchTimer.current = setTimeout(() => {
      refetchTimer.current = null;
      void qc.invalidateQueries({ queryKey: key });
    }, 150);
  }, [qc, key]);

  /* optimistic sends ---------------------------------------------------- */
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
              system: it.m.kind === "system",
            }
          : { id: it.p.cid, sender: me, at: it.p.at, system: false },
      ),
    [items, me],
  );

  const scroll = useChatScroll(rows.length);

  const byMessage = useMemo(() => {
    const map = new Map<string, Reaction[]>();
    for (const r of reactions) map.set(r.message_id, [...(map.get(r.message_id) ?? []), r]);
    return map;
  }, [reactions]);

  const lastMineKey = useMemo(() => {
    for (let i = rows.length - 1; i >= 0; i -= 1) {
      const it = rows[i]!.item;
      if (it.kind === "pending") return it.p.cid;
      if (it.m.kind !== "system" && it.m.sender_id === me) return it.m.id;
    }
    return null;
  }, [rows, me]);

  /* realtime: messages, reactions, typing + presence ------------------ */
  useEffect(() => {
    if (!me) return;
    const channel = supabase
      .channel(`dm:${threadId}`, { config: { broadcast: { self: false }, presence: { key: me } } })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          filter: `thread_id=eq.${threadId}`,
        },
        ({ new: row }) => {
          const msg = row as unknown as DM;
          // Patch the cache from the payload instead of refetching the thread.
          qc.setQueryData<ThreadCache>(key, (old) =>
            old && !old.messages.some((m) => m.id === msg.id)
              ? { ...old, messages: [...old.messages, msg] }
              : old,
          );
          if (msg.sender_id !== me) setPeerTyping(false);
          void qc.invalidateQueries({ queryKey: ["dm-inbox"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_reactions" },
        ({ new: row }) => {
          const r = row as unknown as Reaction;
          qc.setQueryData<ThreadCache>(key, (old) =>
            old &&
            old.messages.some((m) => m.id === r.message_id) &&
            !old.reactions.some(
              (x) =>
                x.message_id === r.message_id &&
                x.profile_id === r.profile_id &&
                x.emoji === r.emoji,
            )
              ? {
                  ...old,
                  reactions: [
                    ...old.reactions,
                    { message_id: r.message_id, profile_id: r.profile_id, emoji: r.emoji },
                  ],
                }
              : old,
          );
        },
      )
      // A removed reaction's payload carries only its id, so refetch to learn which.
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "direct_reactions" },
        refetchSoon,
      )
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if ((payload as { id?: string })?.id === me) return;
        setPeerTyping(true);
        if (typingTimer.current) clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setPeerTyping(false), 3000);
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setPeerOnline(Object.keys(state).some((k) => k !== me));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void channel.track({ at: Date.now() });
      });
    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, me]);

  /* keep the thread marked read while it's on screen ------------------- */
  useEffect(() => {
    if (!q.data) return;
    const run = () => {
      if (document.visibilityState !== "visible") return;
      void mark({ data: { threadId } }).then(() =>
        qc.invalidateQueries({ queryKey: ["dm-inbox"] }),
      );
    };
    run();
    document.addEventListener("visibilitychange", run);
    return () => document.removeEventListener("visibilitychange", run);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data?.messages.length, threadId]);

  const broadcastTyping = () => {
    const now = Date.now();
    if (now - lastTyped.current < 1200 || !me) return;
    lastTyped.current = now;
    void channelRef.current?.send({ type: "broadcast", event: "typing", payload: { id: me } });
  };

  function submit(payload: SendPayload, preview?: string) {
    scroll.stick();
    pend.enqueue(
      payload,
      preview ?? (payload.content ?? "").trim(),
      messages.map((m) => m.id),
    );
  }

  function sendText() {
    const body = text.trim();
    if (!body) return;
    setText("");
    haptic("tap");
    submit({ threadId, content: body });
  }

  async function toggleReact(messageId: string, emoji: string) {
    if (!me) return;
    haptic("tap");
    qc.setQueryData<ThreadCache>(key, (old) => {
      if (!old) return old;
      const has = old.reactions.some(
        (r) => r.message_id === messageId && r.profile_id === me && r.emoji === emoji,
      );
      return {
        ...old,
        reactions: has
          ? old.reactions.filter(
              (r) => !(r.message_id === messageId && r.profile_id === me && r.emoji === emoji),
            )
          : [...old.reactions, { message_id: messageId, profile_id: me, emoji }],
      };
    });
    try {
      await react({ data: { messageId, emoji } });
    } catch {
      toast.error("Couldn't update that reaction");
      void qc.invalidateQueries({ queryKey: key });
    }
  }

  async function shareMyLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return toast.error("Location isn't available on this device");
    }
    const pos = await new Promise<GeolocationPosition | null>((resolve) =>
      navigator.geolocation.getCurrentPosition(
        (p) => resolve(p),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000 },
      ),
    );
    if (!pos) return toast.error("Couldn't read your location");
    submit({
      threadId,
      kind: "location",
      content: "Shared a live location 📍",
      meta: { lat: pos.coords.latitude, lon: pos.coords.longitude, label: "My location" },
    });
  }

  async function toggleRecording() {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        if (blob.size < 800) return;
        setUploadingVoice(true);
        try {
          // Checked by its bytes before it leaves the phone; the server checks again.
          const dataUrl = await prepareVoiceUpload(blob);
          const { url } = await upVoice({ data: { dataUrl } });
          submit({ threadId, kind: "voice", content: "Voice note 🎙️", mediaUrl: url });
        } catch (e) {
          toast.error("Voice note failed", {
            description: e instanceof Error ? e.message : "Please try again.",
          });
        } finally {
          setUploadingVoice(false);
        }
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
      haptic("select");
    } catch {
      toast.error("Microphone access is blocked");
    }
  }

  const peerName = alias(peer?.id, peer?.display_name);
  const unnamed = peerName === UNNAMED;

  const flyTo = (lat: number, lon: number, label?: string) =>
    navigate({ to: "/radar", search: { lat, lon, label: label ?? "Shared pin" } });

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      {/* context banner ------------------------------------------------ */}
      <header className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
        <button
          type="button"
          className="relative"
          aria-label="Open profile"
          onClick={() => peer?.id && openFriend(peer.id)}
        >
          <Avatar url={peer?.avatar_url} emoji={peer?.avatar_emoji} name={peerName} size={40} />
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 size-3 rounded-full ring-2 ring-card",
              peerOnline ? "bg-success" : "bg-muted-foreground",
            )}
          />
        </button>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => peer?.id && openFriend(peer.id)}
            className="block max-w-full truncate text-left text-sm font-semibold text-foreground"
          >
            {!peer ? (
              "Direct message"
            ) : unnamed ? (
              <>
                {circle ? `${circle} member` : "Squad member"}
                <span className="font-normal italic text-muted-foreground"> · no name yet</span>
              </>
            ) : (
              peerName
            )}
          </button>
          <p className="flex items-center gap-1.5 truncate text-caption text-muted-foreground">
            {telemetry ? (
              <>
                <span>{telemetry.status ?? "Sharing location"}</span>
                {telemetry.battery != null ? (
                  <span className="inline-flex items-center gap-0.5">
                    {telemetry.battery <= 20 ? (
                      <BatteryLow className="h-3 w-3 text-warning" aria-hidden />
                    ) : (
                      <BatteryFull className="h-3 w-3" aria-hidden />
                    )}
                    {telemetry.battery}%
                  </span>
                ) : null}
                <span>· {clock(telemetry.at)}</span>
              </>
            ) : (
              <span>{peerOnline ? "Online now" : "No live location shared"}</span>
            )}
          </p>
        </div>
        {telemetry ? (
          <button
            type="button"
            onClick={() => flyTo(telemetry.lat, telemetry.lon, peerName)}
            className="tap-target inline-flex items-center gap-1 rounded-full border border-border bg-secondary/50 px-3 text-caption font-semibold text-secondary-foreground transition active:scale-[0.97]"
          >
            <Navigation className="h-3.5 w-3.5" aria-hidden /> View on Map
          </button>
        ) : null}
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chat"
            className="tap-target grid place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="size-4" aria-hidden />
          </button>
        ) : null}
      </header>

      {/* transcript ---------------------------------------------------- */}
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
                body="Say hi — this chat is just between you two."
              />
            ) : null}

            {rows.map(({ item, pos, header }) => {
              const rowKey = item.kind === "msg" ? item.m.id : item.p.cid;
              return (
                <div key={rowKey}>
                  {header ? <TimeHeader label={header} /> : null}
                  {item.kind === "msg" && item.m.kind === "system" ? (
                    <SystemChip msg={item.m} onFly={flyTo} />
                  ) : (
                    <DmRow
                      item={item}
                      pos={pos}
                      me={me}
                      animateIn={
                        item.kind === "pending" ||
                        (!initialIds.current?.has(item.m.id) && item.m.sender_id !== me)
                      }
                      reactions={item.kind === "msg" ? (byMessage.get(item.m.id) ?? []) : []}
                      isLastMine={rowKey === lastMineKey}
                      peerReadAt={peerReadAt}
                      onReact={toggleReact}
                      onFly={flyTo}
                      onRetry={pend.retry}
                      onDiscard={pend.discard}
                    />
                  )}
                </div>
              );
            })}

            <AnimatePresence>{peerTyping ? <TypingBubble label="Typing" /> : null}</AnimatePresence>
          </div>
        </div>
        <JumpToLatest
          show={scroll.away}
          unseen={scroll.unseen}
          onClick={() => scroll.scrollToBottom(true)}
        />
      </div>

      {/* composer ------------------------------------------------------ */}
      <ChatComposer
        value={text}
        onChange={setText}
        onSend={sendText}
        onTyping={broadcastTyping}
        onFocusChange={setFocused}
        textareaRef={inputRef}
        placeholder={unnamed ? "Message…" : `Message ${firstName(peerName)}…`}
        leading={
          <button
            type="button"
            onClick={() => void shareMyLocation()}
            aria-label="Send my location"
            className="tap-target grid size-11 shrink-0 place-items-center rounded-full bg-secondary/60 text-muted-foreground transition-colors hover:bg-secondary"
          >
            <MapPin className="size-[1.125rem]" aria-hidden />
          </button>
        }
        idleAction={
          <button
            type="button"
            disabled={uploadingVoice}
            onClick={() => void toggleRecording()}
            aria-label="Record a voice note"
            className="hit-slop grid size-8 place-items-center rounded-full text-muted-foreground disabled:opacity-50"
          >
            <Mic className="size-[1.125rem]" aria-hidden />
          </button>
        }
        top={
          recording ? (
            <div className="mb-2 flex items-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-sm text-destructive">
              <span className="chat-rec size-2 rounded-full bg-destructive" aria-hidden />
              <span className="flex-1">Recording…</span>
              <button
                type="button"
                onClick={() => void toggleRecording()}
                aria-label="Stop recording"
                className="tap-target grid place-items-center rounded-full"
              >
                <Square className="size-4 fill-current" aria-hidden />
              </button>
            </div>
          ) : !focused && !text ? (
            <div className="mb-2 flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
              {CONTEXT_PILLS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    haptic("tap");
                    if (p.includes("live location")) void shareMyLocation();
                    else submit({ threadId, content: p });
                  }}
                  className="tap-target shrink-0 rounded-full border border-border bg-secondary/50 px-3 text-caption font-medium text-secondary-foreground transition active:scale-[0.97] hover:border-primary/40 hover:bg-primary/10"
                >
                  {p}
                </button>
              ))}
            </div>
          ) : null
        }
      />
    </div>
  );
}

function DmRow({
  item,
  pos,
  me,
  animateIn,
  reactions,
  isLastMine,
  peerReadAt,
  onReact,
  onFly,
  onRetry,
  onDiscard,
}: {
  item: Item;
  pos: ClusterPos;
  me: string | null;
  animateIn: boolean;
  reactions: Reaction[];
  isLastMine: boolean;
  peerReadAt: string | null;
  onReact: (messageId: string, emoji: string) => void | Promise<void>;
  onFly: (lat: number, lon: number, label?: string) => void;
  onRetry: (cid: string) => void;
  onDiscard: (cid: string) => void;
}) {
  const [showTime, setShowTime] = useState(false);
  const rise = useRise(8, 0.18);

  const isPending = item.kind === "pending";
  const msg = item.kind === "msg" ? item.m : null;
  const pending = item.kind === "pending" ? item.p : null;
  const mine = isPending || msg?.sender_id === me;
  const failed = pending?.status === "failed";
  const kind = msg?.kind ?? "text";
  const body = msg?.content ?? pending?.text ?? "";
  const at = msg?.created_at ?? pending?.at ?? "";
  const meta = (msg?.meta ?? {}) as { lat?: number; lon?: number; label?: string };
  const isLocation = kind === "location" && meta.lat != null && meta.lon != null;
  const isVoice = kind === "voice" && Boolean(msg?.media_url);

  const counts = useMemo(() => {
    const tally = new Map<string, number>();
    for (const r of reactions) tally.set(r.emoji, (tally.get(r.emoji) ?? 0) + 1);
    return [...tally.entries()];
  }, [reactions]);
  const myReactions = useMemo(
    () => new Set(reactions.filter((r) => r.profile_id === me).map((r) => r.emoji)),
    [reactions, me],
  );

  const actions: MenuAction[] = [];
  if (failed && pending) {
    actions.push({
      key: "retry",
      label: "Retry",
      icon: <RotateCcw className="size-4" />,
      onSelect: () => onRetry(pending.cid),
    });
    actions.push({
      key: "discard",
      label: "Delete",
      icon: <Trash2 className="size-4" />,
      destructive: true,
      onSelect: () => onDiscard(pending.cid),
    });
  } else if (body && !isVoice) {
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

  const receipt = (() => {
    if (!mine || !isLastMine || failed) return null;
    if (isPending || !msg) return "Sending…";
    return peerReadAt && new Date(peerReadAt) >= new Date(msg.created_at)
      ? `Read ${clock(peerReadAt)}`
      : "Sent";
  })();

  const row = (
    <div
      className={cn(
        "flex flex-col",
        mine ? "items-end" : "items-start",
        pos === "single" || pos === "first" ? "mt-2" : "mt-0.5",
      )}
    >
      <SwipeRow className="w-full">
        <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
          <div className={cn("max-w-[78%]", mine && "flex flex-col items-end")}>
            <BubbleSurface
              mine={mine}
              pos={pos}
              status={pending?.status}
              actions={actions}
              reactionEmojis={msg ? REACTIONS : undefined}
              myReactions={myReactions}
              onReact={msg ? (emoji) => void onReact(msg.id, emoji) : undefined}
              onTap={
                failed && pending
                  ? () => onRetry(pending.cid)
                  : isLocation
                    ? () => onFly(meta.lat!, meta.lon!, meta.label)
                    : () => setShowTime((v) => !v)
              }
            >
              {isLocation ? (
                <span className="flex items-center gap-2">
                  <MapPin className="size-4 shrink-0" aria-hidden />
                  <span>
                    {meta.label ?? "Live location"}
                    <span className="block text-caption opacity-70">
                      Tap to open on the map · {clock(at)}
                    </span>
                  </span>
                </span>
              ) : isVoice ? (
                <audio
                  controls
                  preload="metadata"
                  src={msg!.media_url!}
                  data-no-swipe
                  className="h-9 w-52 max-w-full"
                />
              ) : (
                body
              )}
            </BubbleSurface>
          </div>
        </div>
      </SwipeRow>

      <ReactionChips
        counts={counts}
        mine={mine}
        myReactions={myReactions}
        onToggle={(emoji) => msg && void onReact(msg.id, emoji)}
      />

      {failed ? (
        <button
          type="button"
          onClick={() => pending && onRetry(pending.cid)}
          className="mt-1 px-1 text-caption font-medium text-destructive"
        >
          Not delivered · Tap to retry
        </button>
      ) : null}

      {!isLocation ? (
        <RevealRow open={showTime}>
          <p className="px-1 pt-1 text-caption text-muted-foreground">{clock(at)}</p>
        </RevealRow>
      ) : null}

      {receipt ? <p className="mt-1 px-1 text-caption text-muted-foreground">{receipt}</p> : null}
    </div>
  );

  return animateIn ? <motion.div {...rise}>{row}</motion.div> : row;
}

function SystemChip({
  msg,
  onFly,
}: {
  msg: DM;
  onFly: (lat: number, lon: number, label?: string) => void;
}) {
  const meta = (msg.meta ?? {}) as { lat?: number; lon?: number; label?: string };
  const tappable = meta.lat != null && meta.lon != null;
  if (!tappable) {
    return (
      <SystemNote>
        {msg.content} · {clock(msg.created_at)}
      </SystemNote>
    );
  }
  return (
    <div className="mt-3 flex justify-center">
      <button
        type="button"
        onClick={() => onFly(meta.lat!, meta.lon!, meta.label)}
        className="tap-target rounded-full border border-border bg-secondary/40 px-3.5 text-caption text-muted-foreground transition active:scale-[0.97] hover:border-primary/40 hover:text-foreground"
      >
        {msg.content} · {clock(msg.created_at)}
      </button>
    </div>
  );
}
