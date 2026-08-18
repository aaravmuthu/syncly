import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/quorum/Avatar";
import { Button, Spinner } from "@/components/quorum/ui";
import { cn } from "@/lib/utils";
import { listMessages, markRead, sendMessage, uploadChatImage } from "@/lib/quorum/chat.functions";

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
  profiles?: { display_name: string; avatar_emoji: string | null; avatar_url: string | null } | null;
};

const QUICK = ["🔥", "😂", "👍", "🙏", "😭", "🎉"];

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

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

  const key = ["squad-chat", groupId, planId ?? "all"];
  const q = useQuery({
    queryKey: key,
    queryFn: () => fetchMessages({ data: { groupId, planId } }),
  });

  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [busy, setBusy] = useState(false);
  const [typers, setTypers] = useState<Record<string, { name: string; at: number }>>({});
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTyped = useRef(0);

  const messages = (q.data?.messages ?? []) as unknown as Msg[];
  const reads = (q.data?.reads ?? []) as unknown as Read[];
  const me = q.data?.me ?? null;
  const hostId = q.data?.hostId ?? null;
  const myName =
    messages.find((m) => m.sender_id === me)?.profiles?.display_name ?? "Someone";

  const readsByMessage = useMemo(() => {
    const map = new Map<string, Read[]>();
    for (const r of reads) {
      if (r.profile_id === me) continue;
      map.set(r.message_id, [...(map.get(r.message_id) ?? []), r]);
    }
    return map;
  }, [reads, me]);

  /* only the newest of my messages that has been read shows a receipt */
  const lastSeenMineId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const m = messages[i];
      if (m && m.sender_id === me && !m.system_type && (readsByMessage.get(m.id)?.length ?? 0) > 0) {
        return m.id;
      }
    }
    return null;
  }, [messages, me, readsByMessage]);

  /* live message + receipt stream ---------------------------------- */
  useEffect(() => {
    const channel = supabase
      .channel(`squad-chat:${groupId}:${planId ?? "all"}`, {
        config: { broadcast: { self: false } },
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "group_messages", filter: `group_id=eq.${groupId}` },
        () => void qc.invalidateQueries({ queryKey: key }),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "message_reads" },
        () => void qc.invalidateQueries({ queryKey: key }),
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

  /* mark unread messages as read ------------------------------------ */
  useEffect(() => {
    if (!me || messages.length === 0) return;
    const mine = new Set(reads.filter((r) => r.profile_id === me).map((r) => r.message_id));
    const todo = messages
      .filter((m) => m.sender_id && m.sender_id !== me && !mine.has(m.id))
      .map((m) => m.id);
    if (todo.length === 0) return;
    void mark({ data: { messageIds: todo } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, me, reads.length]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

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

  async function submit(content: string, mediaUrl?: string | null, replyToId?: string | null) {
    const body = content.trim();
    if (!body && !mediaUrl) return;
    setBusy(true);
    try {
      await send({
        data: {
          groupId,
          planId,
          content: body,
          mediaUrl: mediaUrl ?? null,
          replyToId: replyToId ?? replyTo?.id ?? null,
        },
      });
      setText("");
      setReplyTo(null);
      await qc.invalidateQueries({ queryKey: key });
    } catch (e) {
      toast.error("Message not sent", {
        description: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function pickPhoto(file: File) {
    if (file.size > 5 * 1024 * 1024) return toast.error("Image must be under 5 MB");
    setBusy(true);
    try {
      const dataUrl = await new Promise<string>((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result));
        fr.onerror = () => rej(new Error("Could not read that file"));
        fr.readAsDataURL(file);
      });
      const ext = (file.name.split(".").pop() ?? "png").toLowerCase();
      const { url } = await upload({ data: { dataUrl, ext } });
      await submit(text, url);
    } catch (e) {
      toast.error("Upload failed", {
        description: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  const typingNames = Object.values(typers).map((t) => t.name);

  return (
    <div
      className={cn(
        "relative flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-neutral-950/85 shadow-2xl backdrop-blur-xl",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_60%_at_50%_-10%,rgba(16,185,129,0.16),transparent_65%)]"
      />
      <div ref={scrollRef} className="relative flex flex-1 flex-col justify-end overflow-y-auto p-4">
        <div className="mt-auto space-y-3">
        {q.isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-white/45">
            No messages yet — say something to the squad 💬
          </p>
        ) : null}

        {messages.map((m) =>
          m.system_type ? (
            <SystemCard key={m.id} msg={m} onVote={(id) => navigate({ to: "/plans/$planId", params: { planId: id } })} />
          ) : (
            <Bubble
              key={m.id}
              msg={m}
              mine={m.sender_id === me}
              isHost={Boolean(hostId && m.sender_id === hostId)}
              readers={m.id === lastSeenMineId ? readsByMessage.get(m.id) ?? [] : []}
              onReply={() => setReplyTo(m)}
              onReact={(emoji) => void submit(emoji, null, m.id)}
            />
          ),
        )}

        {typingNames.length > 0 ? (
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 backdrop-blur">
            <Dots />
            {typingNames.length === 1
              ? `${typingNames[0]} is typing...`
              : `${typingNames.length} people are typing...`}
          </div>
        ) : null}
        </div>
      </div>


      {replyTo ? (
        <div className="mx-4 mb-2 flex items-start gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 backdrop-blur">
          <span className="mt-0.5 h-full w-0.5 rounded bg-emerald-400/70" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-emerald-300">
              {replyTo.profiles?.display_name ?? "Member"}
            </p>
            <p className="truncate text-xs text-white/60">{replyTo.content || "Photo"}</p>
          </div>
          <button
            type="button"
            onClick={() => setReplyTo(null)}
            className="rounded-lg px-1.5 text-xs text-white/50 hover:bg-white/10"
          >
            ✕
          </button>
        </div>
      ) : null}

      <div className="relative border-t border-white/10 bg-white/[0.03] p-3">
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(text);
          }}
        >
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
            onClick={() => fileRef.current?.click()}
            aria-label="Add photo"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/5 text-base hover:bg-white/10"
          >
            📷
          </button>
          <textarea
            value={text}
            rows={1}
            placeholder="Message the squad…"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              broadcastTyping();
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit(text);
              }
            }}
            className="max-h-32 min-h-10 flex-1 resize-none rounded-2xl border border-white/10 bg-neutral-900/70 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-white/35 focus:border-emerald-400/50"
          />
          <Button type="submit" loading={busy} className="h-10 shrink-0 px-4">
            Send
          </Button>
        </form>
      </div>
    </div>
  );
}

function Dots() {
  return (
    <span className="flex items-end gap-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-300"
          style={{ animationDelay: `${i * 120}ms` }}
        />
      ))}
    </span>
  );
}

function Bubble({
  msg,
  mine,
  isHost,
  readers,
  onReply,
  onReact,
}: {
  msg: Msg;
  mine: boolean;
  isHost: boolean;
  readers: Read[];
  onReply: () => void;
  onReact: (emoji: string) => void;
}) {
  return (
    <div className={cn("group/msg flex items-end gap-2", mine && "flex-row-reverse")}>
      {!mine ? (
        <Avatar
          url={msg.profiles?.avatar_url}
          emoji={msg.profiles?.avatar_emoji}
          name={msg.profiles?.display_name}
          size={28}
        />
      ) : null}
      <div className={cn("max-w-[78%] space-y-1", mine && "items-end text-right")}>
        {!mine ? (
          <p className="px-1 text-[11px] text-white/45">
            {msg.profiles?.display_name ?? "Member"}
            {isHost ? (
              <span className="ml-1.5 rounded-full bg-emerald-400/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                Host
              </span>
            ) : null}
          </p>
        ) : null}
        <div className="relative">
        <div
          className={cn(
            "pointer-events-none absolute -top-8 z-10 flex gap-0.5 rounded-full border border-white/10 bg-neutral-900/95 p-1 opacity-0 shadow-2xl backdrop-blur-xl transition duration-150 group-hover/msg:pointer-events-auto group-hover/msg:opacity-100 group-focus-within/msg:pointer-events-auto group-focus-within/msg:opacity-100",
            mine ? "right-0" : "left-0",
          )}
        >
          {QUICK.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => onReact(e)}
              className="rounded-full px-1.5 py-0.5 text-base transition hover:scale-125 hover:bg-emerald-400/10"
            >
              {e}
            </button>
          ))}
        </div>
        <button
          type="button"
          onDoubleClick={onReply}
          onClick={onReply}
          className={cn(
            "block w-full rounded-2xl px-4 py-2.5 text-left text-sm shadow-lg transition",
            mine
              ? "rounded-tr-none bg-gradient-to-r from-emerald-600 to-teal-600 text-white"
              : "rounded-tl-none border border-white/10 bg-neutral-800/80 text-neutral-100 hover:bg-neutral-800",
          )}
        >
          {msg.reply_to ? (
            <span className="mb-1.5 block rounded-xl border border-white/10 bg-black/25 px-2 py-1 text-[11px] text-white/55">
              <span className="font-semibold text-white/75">
                {msg.reply_to.profiles?.display_name ?? "Member"}
              </span>
              : {msg.reply_to.content || "Photo"}
            </span>
          ) : null}
          {msg.media_url ? (
            <img
              src={msg.media_url}
              alt="Shared in chat"
              loading="lazy"
              className="mb-1.5 max-h-60 w-full rounded-xl object-cover"
            />
          ) : null}
          {msg.content ? <span className="whitespace-pre-wrap break-words">{msg.content}</span> : null}
        </button>
        <p className="px-1 text-[10px] text-white/35">
          {time(msg.created_at)}
          {mine ? <span className="ml-1">{readers.length > 0 ? "✓✓" : "✓"}</span> : null}
        </p>
        {mine && readers.length > 0 ? (
          <div className="flex items-center justify-end gap-1 px-1">
            <div className="flex -space-x-1.5">
              {readers.slice(0, 4).map((r) => (
                <Avatar
                  key={r.profile_id}
                  url={r.profiles?.avatar_url}
                  emoji={r.profiles?.avatar_emoji}
                  name={r.profiles?.display_name}
                  size={16}
                  className="ring-1 ring-neutral-950"
                />
              ))}
            </div>
            <span className="text-[10px] text-white/35">
              Seen by {readers[0]?.profiles?.display_name ?? "someone"}
              {readers.length > 1 ? ` +${readers.length - 1}` : ""}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SystemCard({ msg, onVote }: { msg: Msg; onVote: (planId: string) => void }) {
  const meta = (msg.meta ?? {}) as { emoji?: string; title?: string; cost?: string };
  const isPlan = msg.system_type === "plan_created";
  const icon = meta.emoji ?? (isPlan ? "⚡" : msg.system_type === "ride_update" ? "🚗" : "🔒");
  return (
    <div className="mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-emerald-400/25 bg-gradient-to-br from-emerald-500/[0.12] to-teal-500/[0.06] p-4 shadow-xl backdrop-blur">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-400/15 text-xl ring-1 ring-emerald-400/30">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-300/80">
            {isPlan ? "New plan launched" : msg.system_type === "ride_update" ? "Ride update" : "Plan locked in"}
          </p>
          <p className="truncate text-sm font-semibold text-emerald-50">
            {meta.title ?? msg.content}
          </p>
          {meta.cost ? (
            <span className="mt-1 inline-block rounded-full bg-black/25 px-2 py-0.5 text-[11px] text-emerald-100/80">
              {meta.cost}
            </span>
          ) : null}
        </div>
      </div>
      {isPlan && msg.plan_id ? (
        <Button className="mt-3 w-full py-2 text-xs" onClick={() => onVote(msg.plan_id!)}>
          Vote Now ⚡
        </Button>
      ) : null}
      <p className="mt-2 text-[10px] text-white/35">{time(msg.created_at)}</p>
    </div>
  );
}
