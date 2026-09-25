import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { motion } from "motion/react";
import {
  BatteryLow,
  Check,
  Clock,
  Ghost,
  Infinity as InfinityIcon,
  MapPin,
  MessageCircle,
  Moon,
  Navigation,
  Pencil,
  Radio,
  Sparkle,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Avatar } from "@/components/quorum/Avatar";
import { Button, Pill, Skeleton, inputClass } from "@/components/quorum/ui";
import { haptic } from "@/lib/quorum/haptics";
import { useFriends } from "@/lib/quorum/nicknames";
import {
  getFriendProfile,
  requestLocation,
  setContactGhost,
  setNickname,
} from "@/lib/quorum/friend.functions";
import { nudgeFriendPin, shareLocationWith, stopSharingWith } from "@/lib/quorum/sharing.functions";
import { SHARE_OPTIONS, directionsUrl, shareCountdown, type ShareMode } from "@/lib/quorum/sharing";
import { cn } from "@/lib/utils";

const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString([], {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "Time TBD";

const ago = (iso: string) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
};

/**
 * Apple-style friend profile drawer: nickname editing, mutual location
 * controls, live telemetry and the history the two of you share.
 */
export function FriendProfileSheet() {
  const { friendId, closeFriend } = useFriends();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [durations, setDurations] = useState(false);

  const q = useQuery({
    queryKey: ["friend-profile", friendId],
    queryFn: () => getFriendProfile({ data: { profileId: friendId! } }),
    enabled: Boolean(friendId),
    refetchInterval: friendId ? 45_000 : false,
  });
  const friend = q.data;

  useEffect(() => {
    setEditing(false);
    setDurations(false);
    setDraft("");
  }, [friendId]);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["friend-profile", friendId] });
    void qc.invalidateQueries({ queryKey: ["nicknames"] });
    void qc.invalidateQueries({ queryKey: ["friend-pins"] });
    void qc.invalidateQueries({ queryKey: ["share-peers"] });
  };

  const rename = useMutation({
    mutationFn: useServerFn(setNickname),
    onSuccess: () => {
      haptic("success");
      toast.success("Nickname saved");
      setEditing(false);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const share = useMutation({
    mutationFn: useServerFn(shareLocationWith),
    onSuccess: () => {
      toast.success("Location sharing started 📍");
      setDurations(false);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const stop = useMutation({
    mutationFn: useServerFn(stopSharingWith),
    onSuccess: () => {
      toast.success("Stopped sharing");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const ghost = useMutation({
    mutationFn: useServerFn(setContactGhost),
    onSuccess: (r: { hidden: boolean }) => {
      haptic("warn");
      toast.success(r.hidden ? "Hidden from this contact 👻" : "Visible again");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const ask = useMutation({
    mutationFn: useServerFn(requestLocation),
    onSuccess: () => toast.success("Location request sent 📡"),
    onError: (e: Error) => toast.error(e.message),
  });
  const nudge = useMutation({
    mutationFn: useServerFn(nudgeFriendPin),
    onSuccess: () => toast.success("Nudge sent 📍"),
    onError: (e: Error) => toast.error(e.message),
  });

  const shown = friend ? (friend.nickname ?? friend.name) : "";
  const tele = friend?.telemetry ?? null;

  return (
    <Drawer open={Boolean(friendId)} onOpenChange={(o) => (o ? null : closeFriend())}>
      <DrawerContent className="max-h-[92dvh] border-t border-white/10 bg-zinc-950/90 text-white backdrop-blur-2xl">
        <div className="overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-2">
          {q.isLoading || !friend ? (
            <div className="space-y-3 py-6">
              <Skeleton className="h-20 rounded-3xl" />
              <Skeleton className="h-28 rounded-3xl" />
              <Skeleton className="h-28 rounded-3xl" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center gap-4 pt-2">
                <span className="relative inline-grid place-items-center">
                  {tele ? (
                    <motion.span
                      aria-hidden
                      className="absolute inset-0 rounded-full ring-2 ring-emerald-400/70"
                      animate={{ scale: [1, 1.35, 1], opacity: [0.8, 0, 0.8] }}
                      transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut" }}
                    />
                  ) : null}
                  <Avatar
                    url={friend.avatarUrl}
                    emoji={friend.emoji}
                    name={shown}
                    size={68}
                    className="ring-2 ring-white/15"
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display truncate text-xl font-semibold">{shown}</h2>
                    {friend.nickname ? (
                      <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-caption font-semibold text-emerald-300">
                        {friend.name}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-white/50">{friend.handle}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {friend.circles.slice(0, 4).map((c) => (
                      <span
                        key={c.id}
                        className="rounded-full bg-white/8 px-2 py-0.5 text-caption text-white/70"
                      >
                        {c.emoji} {c.name}
                      </span>
                    ))}
                    {friend.circles.length === 0 ? (
                      <span className="text-caption text-white/40">No shared circles yet</span>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeFriend}
                  aria-label="Close"
                  className="tap-target grid shrink-0 place-items-center rounded-full bg-white/8 p-2 text-white/70 transition active:scale-[0.97]"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>

              {/* Nickname editor */}
              {editing ? (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-3">
                  <input
                    autoFocus
                    value={draft}
                    maxLength={40}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={`Nickname for ${friend.name}`}
                    className={cn(
                      inputClass,
                      "border-white/15 bg-white/5 text-white placeholder:text-white/35",
                    )}
                  />
                  <p className="mt-2 text-caption text-white/40">
                    Only you see this. It replaces their name on your map, chats, plans and feed.
                  </p>
                  <div className="mt-3 flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      className="text-white/70"
                      onClick={() => setEditing(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      loading={rename.isPending}
                      onClick={() =>
                        rename.mutate({ data: { profileId: friend.profileId, nickname: draft } })
                      }
                    >
                      <Check className="h-4 w-4" aria-hidden /> Save
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    haptic("tap");
                    setDraft(friend.nickname ?? "");
                    setEditing(true);
                  }}
                  className="flex w-full items-center justify-between rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-left transition active:scale-[0.99]"
                >
                  <span className="text-sm font-semibold">Edit Nickname ✏️</span>
                  <span className="text-xs text-white/50">
                    {friend.nickname ? `Saved as "${friend.nickname}"` : "Add a custom alias"}
                  </span>
                </button>
              )}

              {/* Action hub */}
              <div className="grid grid-cols-3 gap-2">
                <ActionTile
                  icon={<MessageCircle className="h-5 w-5" aria-hidden />}
                  label="Message"
                  onClick={() => {
                    closeFriend();
                    void navigate({ to: "/messages", search: { peer: friend.profileId } });
                  }}
                />
                <ActionTile
                  icon={<Radio className="h-5 w-5" aria-hidden />}
                  label="Ping"
                  onClick={() => nudge.mutate({ data: { profileId: friend.profileId } })}
                />
                <ActionTile
                  icon={<Navigation className="h-5 w-5" aria-hidden />}
                  label="Directions"
                  disabled={!tele}
                  onClick={() =>
                    tele &&
                    window.open(directionsUrl(tele.lat, tele.lon, shown), "_blank", "noopener")
                  }
                />
              </div>

              {/* Sharing status */}
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
                      Location
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      {friend.sharingWithMe && !friend.sharingWithMe.hidden
                        ? `Sharing with you • ${shareCountdown(friend.sharingWithMe.expiresAt)}`
                        : "Location hidden"}
                    </p>
                    <p className="mt-0.5 text-xs text-white/50">
                      {friend.sharingWithThem
                        ? friend.sharingWithThem.hidden
                          ? "You're ghosting them 👻 — everyone else still sees you"
                          : `You share back • ${shareCountdown(friend.sharingWithThem.expiresAt)}`
                        : "You're not sharing your location with them"}
                    </p>
                  </div>
                  {friend.guardianLinked ? <Pill tone="accent">Family link</Pill> : null}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {friend.sharingWithThem ? (
                    <>
                      <Button
                        variant="outline"
                        className="border-white/15 text-white"
                        loading={ghost.isPending}
                        onClick={() =>
                          ghost.mutate({
                            data: {
                              profileId: friend.profileId,
                              hidden: !friend.sharingWithThem!.hidden,
                            },
                          })
                        }
                      >
                        <Ghost className="h-4 w-4" aria-hidden />
                        {friend.sharingWithThem.hidden
                          ? "Unghost contact"
                          : "Ghost this contact 👻"}
                      </Button>
                      <Button
                        variant="ghost"
                        className="text-white/70"
                        loading={stop.isPending}
                        onClick={() => stop.mutate({ data: { viewerProfileId: friend.profileId } })}
                      >
                        <X className="h-4 w-4" aria-hidden /> Stop sharing
                      </Button>
                    </>
                  ) : (
                    <Button onClick={() => setDurations(true)}>
                      <MapPin className="h-4 w-4" aria-hidden /> Share My Location 📍
                    </Button>
                  )}
                  {friend.sharingWithMe ? null : (
                    <Button
                      variant="outline"
                      className="border-white/15 text-white"
                      loading={ask.isPending}
                      onClick={() => ask.mutate({ data: { profileId: friend.profileId } })}
                    >
                      <Radio className="h-4 w-4" aria-hidden /> Request Location 📡
                    </Button>
                  )}
                </div>

                {durations ? (
                  <div className="mt-3 space-y-2">
                    {SHARE_OPTIONS.map((opt) => (
                      <button
                        key={opt.mode}
                        type="button"
                        disabled={share.isPending}
                        onClick={() =>
                          share.mutate({
                            data: {
                              viewerProfileId: friend.profileId,
                              mode: opt.mode as ShareMode,
                            },
                          })
                        }
                        className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-left transition active:scale-[0.98] disabled:opacity-60"
                      >
                        <span className="text-lg" aria-hidden>
                          {opt.emoji}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold">{opt.label}</span>
                          <span className="block text-xs text-white/45">{opt.detail}</span>
                        </span>
                        {opt.mode === "hour" ? (
                          <Clock className="h-4 w-4 opacity-60" aria-hidden />
                        ) : null}
                        {opt.mode === "end_of_day" ? (
                          <Moon className="h-4 w-4 opacity-60" aria-hidden />
                        ) : null}
                        {opt.mode === "indefinite" ? (
                          <InfinityIcon className="h-4 w-4 opacity-60" aria-hidden />
                        ) : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* Telemetry */}
              {tele ? (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-white/50">
                    Live telemetry
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold">
                    {tele.statusEmoji} {tele.address ?? tele.motion}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Pill tone="accent">{tele.atHome ? "At Home" : tele.motion}</Pill>
                    {tele.batteryPct != null ? (
                      <Pill tone={tele.batteryPct <= 20 ? "bad" : "neutral"}>
                        {tele.batteryPct <= 20 ? (
                          <BatteryLow className="h-3 w-3" aria-hidden />
                        ) : null}
                        ⚡ {tele.batteryPct}%
                      </Pill>
                    ) : null}
                    {tele.distanceMiles != null ? <Pill>{tele.distanceMiles} mi away</Pill> : null}
                    {tele.driveMinutes != null ? <Pill>~{tele.driveMinutes} min drive</Pill> : null}
                    <Pill>Updated {ago(tele.lastSeen)}</Pill>
                  </div>
                  <Button
                    variant="ghost"
                    className="mt-3 text-emerald-300"
                    onClick={() => {
                      closeFriend();
                      void navigate({
                        to: "/radar",
                        search: { lat: tele.lat, lon: tele.lon, label: shown },
                      });
                    }}
                  >
                    <MapPin className="h-4 w-4" aria-hidden /> View on Map
                  </Button>
                </div>
              ) : null}

              {/* Shared history */}
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-white/50">
                  You two
                </p>
                {friend.upcoming.length ? (
                  <ul className="mt-2 space-y-2">
                    {friend.upcoming.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => {
                            closeFriend();
                            void navigate({ to: "/plans/$planId", params: { planId: p.id } });
                          }}
                          className="flex w-full items-center gap-3 rounded-2xl bg-white/5 p-3 text-left transition active:scale-[0.99]"
                        >
                          <Sparkle className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">{p.title}</span>
                            <span className="block truncate text-xs text-white/45">
                              {when(p.when)}
                              {p.where ? ` · ${p.where}` : ""}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-white/45">No upcoming plans together yet.</p>
                )}

                {friend.memories.length ? (
                  <>
                    <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-white/50">
                      Past hangouts
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {friend.memories.map((m) => (
                        <li key={m.id} className="flex items-center justify-between gap-3 text-sm">
                          <span className="truncate text-white/75">{m.title}</span>
                          <span className="shrink-0 text-xs text-white/40">{when(m.when)}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function ActionTile({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <motion.button
      type="button"
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.94 }}
      onPointerDown={() => !disabled && haptic("tap")}
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 rounded-3xl border border-white/10 bg-white/5 py-3.5 text-xs font-semibold text-white transition disabled:opacity-40"
    >
      <span className="text-emerald-300">{icon}</span>
      {label}
    </motion.button>
  );
}
