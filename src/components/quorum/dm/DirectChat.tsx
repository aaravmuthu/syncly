import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "motion/react";
import { BatteryLow, BatteryFull, MapPin, Mic, Navigation, Square } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/quorum/Avatar";
import { Button, Spinner } from "@/components/quorum/ui";
import { haptic } from "@/lib/quorum/haptics";
import {
  getThread,
  markThreadRead,
  sendDirect,
  toggleReaction,
  uploadVoiceNote,
} from "@/lib/quorum/dm.functions";
import { cn } from "@/lib/utils";

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

const REACTIONS = ["❤️", "🔥", "👍", "📍"];

const CONTEXT_PILLS = [
  "Glad you made it safely! 👍",
  "What's the ETA?",
  "Share my live location 📍",
];

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export function DirectChat({
  threadId,
  onClose,
  className,
}: {
  threadId: string;
  onClose?: () => void;
  className?: string;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fetchThread = useServerFn(getThread);
  const send = useServerFn(sendDirect);
  const mark = useServerFn(markThreadRead);
  const react = useServerFn(toggleReaction);
  const upVoice = useServerFn(uploadVoiceNote);

  const key = useMemo(() => ["dm-thread", threadId], [threadId]);
  const q = useQuery({ queryKey: key, queryFn: () => fetchThread({ data: { threadId } }) });

  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [peerOnline, setPeerOnline] = useState(false);
  const [recording, setRecording] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const lastTyped = useRef(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const me = q.data?.me ?? null;
  const peer = q.data?.peer ?? null;
  const messages = (q.data?.messages ?? []) as unknown as DM[];
  const reactions = (q.data?.reactions ?? []) as unknown as Reaction[];
  const telemetry = q.data?.telemetry ?? null;
  const peerReadAt = q.data?.peerReadAt ?? null;

  const reactionsFor = useCallback(
    (id: string) => reactions.filter((r) => r.message_id === id),
    [reactions],
  );

  /* realtime: messages, reactions, typing + presence ------------------ */
  useEffect(() => {
    if (!me) return;
    const channel = supabase
      .channel(`dm:${threadId}`, { config: { broadcast: { self: false }, presence: { key: me } } })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages", filter: `thread_id=eq.${threadId}` },
        () => void qc.invalidateQueries({ queryKey: key }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "direct_reactions" }, () =>
        qc.invalidateQueries({ queryKey: key }),
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

  /* keep the thread marked read + pinned to the newest message --------- */
  useEffect(() => {
    if (!q.data) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    void mark({ data: { threadId } }).then(() => qc.invalidateQueries({ queryKey: ["dm-inbox"] }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data?.messages.length, threadId]);

  const broadcastTyping = () => {
    const now = Date.now();
    if (now - lastTyped.current < 1200 || !me) return;
    lastTyped.current = now;
    void channelRef.current?.send({ type: "broadcast", event: "typing", payload: { id: me } });
  };

  async function submit(payload: Parameters<typeof send>[0]["data"]) {
    setBusy(true);
    try {
      await send({ data: payload });
      setText("");
      await qc.invalidateQueries({ queryKey: key });
      void qc.invalidateQueries({ queryKey: ["dm-inbox"] });
      haptic("light");
    } catch (e) {
      toast.error("Message not sent", {
        description: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setBusy(false);
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
    await submit({
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
        setBusy(true);
        try {
          const dataUrl = await new Promise<string>((res, rej) => {
            const fr = new FileReader();
            fr.onload = () => res(String(fr.result));
            fr.onerror = () => rej(new Error("Could not read the recording"));
            fr.readAsDataURL(blob);
          });
          const { url } = await upVoice({ data: { dataUrl } });
          await submit({ threadId, kind: "voice", content: "Voice note 🎙️", mediaUrl: url });
        } catch (e) {
          toast.error("Voice note failed", {
            description: e instanceof Error ? e.message : "Please try again.",
          });
        } finally {
          setBusy(false);
        }
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
      haptic("medium");
    } catch {
      toast.error("Microphone access is blocked");
    }
  }

  const flyTo = (lat: number, lon: number, label?: string) =>
    navigate({ to: "/radar", search: { lat, lon, label: label ?? "Shared pin" } });

  return (
    <div className={cn("flex min-h-0 flex-col bg-zinc-950/90 backdrop-blur-2xl", className)}>
      {/* context banner ------------------------------------------------ */}
      <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <span className="relative">
          <Avatar url={peer?.avatar_url} emoji={peer?.avatar_emoji} name={peer?.display_name} size={40} />
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 size-3 rounded-full ring-2 ring-zinc-950",
              peerOnline ? "bg-emerald-400" : "bg-zinc-500",
            )}
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">
            {peer?.display_name ?? "Direct message"}
          </p>
          <p className="flex items-center gap-1.5 truncate text-[11px] text-white/55">
            {telemetry ? (
              <>
                <span>{telemetry.status ?? "Sharing location"}</span>
                {telemetry.battery != null ? (
                  <span className="inline-flex items-center gap-0.5">
                    {telemetry.battery <= 20 ? (
                      <BatteryLow className="h-3 w-3 text-amber-400" aria-hidden />
                    ) : (
                      <BatteryFull className="h-3 w-3" aria-hidden />
                    )}
                    {telemetry.battery}%
                  </span>
                ) : null}
                <span>· {time(telemetry.at)}</span>
              </>
            ) : (
              <span>{peerOnline ? "Online now" : "No live location shared"}</span>
            )}
          </p>
        </div>
        {telemetry ? (
          <button
            type="button"
            onClick={() => flyTo(telemetry.lat, telemetry.lon, peer?.display_name ?? "Pin")}
            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-white/80 transition active:scale-95"
          >
            <Navigation className="h-3.5 w-3.5" aria-hidden /> View on Map
          </button>
        ) : null}
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chat"
            className="rounded-full px-2 py-1 text-white/50 hover:bg-white/10"
          >
            ✕
          </button>
        ) : null}
      </header>

      {/* transcript ---------------------------------------------------- */}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {q.isLoading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-white/45">
            Say hi — this chat is just between you two.
          </p>
        ) : null}

        {messages.map((m) =>
          m.kind === "system" ? (
            <SystemChip key={m.id} msg={m} onFly={flyTo} />
          ) : (
            <DmBubble
              key={m.id}
              msg={m}
              mine={m.sender_id === me}
              reactions={reactionsFor(m.id)}
              myId={me}
              onReact={async (emoji) => {
                haptic("light");
                await react({ data: { messageId: m.id, emoji } });
                void qc.invalidateQueries({ queryKey: key });
              }}
              onFly={flyTo}
            />
          ),
        )}

        {peerTyping ? (
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
            <Dots /> {peer?.display_name ?? "They"} is typing…
          </div>
        ) : null}

        {peerReadAt && messages.some((m) => m.sender_id === me) ? (
          <p className="pr-1 text-right text-[10px] text-white/35">Read {time(peerReadAt)}</p>
        ) : null}
      </div>

      {/* quick pills + composer ---------------------------------------- */}
      <div className="border-t border-white/10 bg-white/[0.03] p-3">
        <div className="mb-2 flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
          {CONTEXT_PILLS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                haptic("light");
                if (p.includes("live location")) void shareMyLocation();
                else void submit({ threadId, content: p });
              }}
              className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-white/75 transition active:scale-95 hover:border-emerald-400/40 hover:bg-emerald-400/10"
            >
              {p}
            </button>
          ))}
        </div>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) void submit({ threadId, content: text });
          }}
        >
          <button
            type="button"
            onClick={() => void shareMyLocation()}
            aria-label="Send my location"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/5 text-white/70 transition active:scale-95 hover:bg-white/10"
          >
            <MapPin className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => void toggleRecording()}
            aria-label={recording ? "Stop recording" : "Record a voice note"}
            className={cn(
              "grid h-10 w-10 shrink-0 place-items-center rounded-2xl border text-white/70 transition active:scale-95",
              recording
                ? "animate-pulse border-rose-400/50 bg-rose-500/20 text-rose-200"
                : "border-white/10 bg-white/5 hover:bg-white/10",
            )}
          >
            {recording ? <Square className="h-4 w-4" aria-hidden /> : <Mic className="h-4 w-4" aria-hidden />}
          </button>
          <textarea
            value={text}
            rows={1}
            placeholder={`Message ${peer?.display_name?.split(" ")[0] ?? ""}…`}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              broadcastTyping();
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (text.trim()) void submit({ threadId, content: text });
              }
            }}
            className="max-h-32 min-h-10 flex-1 resize-none rounded-2xl border border-white/10 bg-zinc-900/70 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-white/35 focus:border-emerald-400/50"
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

function DmBubble({
  msg,
  mine,
  reactions,
  myId,
  onReact,
  onFly,
}: {
  msg: DM;
  mine: boolean;
  reactions: Reaction[];
  myId: string | null;
  onReact: (emoji: string) => void | Promise<void>;
  onFly: (lat: number, lon: number, label?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const meta = (msg.meta ?? {}) as { lat?: number; lon?: number; label?: string };
  const grouped = reactions.reduce<Record<string, number>>((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
    return acc;
  }, {});
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  return (
    <div className={cn("group/dm flex items-end gap-2", mine && "flex-row-reverse")}>
      <div className={cn("relative max-w-[80%]", mine && "text-right")}>
        <AnimatePresence>
          {open ? (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 480, damping: 26 }}
              className={cn(
                "absolute -top-11 z-20 flex gap-0.5 rounded-full border border-white/10 bg-zinc-900/95 p-1 shadow-2xl backdrop-blur-2xl",
                mine ? "right-0" : "left-0",
              )}
            >
              {REACTIONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => {
                    void onReact(e);
                    setOpen(false);
                  }}
                  className="rounded-full px-2 py-0.5 text-base transition hover:scale-125 hover:bg-emerald-400/10"
                >
                  {e}
                </button>
              ))}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onContextMenu={(e) => {
            e.preventDefault();
            haptic("medium");
            setOpen((v) => !v);
          }}
          onPointerDown={() => {
            pressTimer.current = setTimeout(() => {
              haptic("medium");
              setOpen(true);
            }, 380);
          }}
          onPointerUp={() => pressTimer.current && clearTimeout(pressTimer.current)}
          onPointerLeave={() => pressTimer.current && clearTimeout(pressTimer.current)}
          onClick={() => {
            if (msg.kind === "location" && meta.lat != null && meta.lon != null) {
              onFly(meta.lat, meta.lon, meta.label);
            }
          }}
          className={cn(
            "block w-full rounded-2xl px-4 py-2.5 text-left text-sm shadow-lg transition",
            mine
              ? "rounded-br-md bg-gradient-to-r from-emerald-600 to-teal-600 text-white"
              : "rounded-bl-md border border-white/10 bg-zinc-800/80 text-zinc-100",
          )}
        >
          {msg.kind === "location" ? (
            <span className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0" aria-hidden />
              <span>
                {meta.label ?? "Live location"}
                <span className="block text-[11px] opacity-70">Tap to open on the map</span>
              </span>
            </span>
          ) : msg.kind === "voice" && msg.media_url ? (
            <audio controls src={msg.media_url} className="h-9 w-52 max-w-full" />
          ) : (
            <span className="whitespace-pre-wrap break-words">{msg.content}</span>
          )}
        </motion.button>

        <div className={cn("mt-1 flex items-center gap-1.5 px-1", mine && "justify-end")}>
          {Object.entries(grouped).map(([emoji, count]) => (
            <button
              key={emoji}
              type="button"
              onClick={() => void onReact(emoji)}
              className={cn(
                "rounded-full border px-1.5 py-0.5 text-[11px] transition active:scale-90",
                reactions.some((r) => r.emoji === emoji && r.profile_id === myId)
                  ? "border-emerald-400/50 bg-emerald-400/15 text-emerald-200"
                  : "border-white/10 bg-white/5 text-white/60",
              )}
            >
              {emoji} {count}
            </button>
          ))}
          <span className="text-[10px] text-white/30">{time(msg.created_at)}</span>
        </div>
      </div>
    </div>
  );
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
  return (
    <div className="flex justify-center">
      <button
        type="button"
        disabled={!tappable}
        onClick={() => tappable && onFly(meta.lat!, meta.lon!, meta.label)}
        className={cn(
          "rounded-full border border-white/10 bg-white/[0.06] px-3.5 py-1.5 text-[11px] text-white/70 backdrop-blur",
          tappable && "transition active:scale-95 hover:border-emerald-400/40 hover:text-white",
        )}
      >
        {msg.content} · {time(msg.created_at)}
      </button>
    </div>
  );
}
