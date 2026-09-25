import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "motion/react";
import {
  BatteryLow,
  Bell,
  Check,
  Clock,
  EyeOff,
  Ghost,
  Infinity as InfinityIcon,
  MapPin,
  Moon,
  Navigation,
  Radio,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/quorum/Avatar";
import { Modal } from "@/components/quorum/Modal";
import { Button, Card, Empty, Pill, Skeleton } from "@/components/quorum/ui";
import {
  getFriendPins,
  getSharePeers,
  getSharingState,
  nudgeFriendPin,
  setGhostMode,
  shareLocationWith,
  stopSharingWith,
  stopWatchingFriend,
} from "@/lib/quorum/sharing.functions";
import {
  GHOST_OPTIONS,
  SHARE_OPTIONS,
  directionsUrl,
  shareCountdown,
  type FriendPin,
  type GhostChoice,
  type ShareMode,
  type SharePeer,
} from "@/lib/quorum/sharing";
import { useFriends } from "@/lib/quorum/friends-context";
import { cn } from "@/lib/utils";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase() || "?";

const ago = (iso: string) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
};

/**
 * iOS "Find My Friends" surface: duration-based sharing, Ghost Mode, a live
 * pin map and a tap-to-open friend detail sheet with directions and nudges.
 */
export function FindMyFriends() {
  const qc = useQueryClient();
  const { alias, openFriend } = useFriends();
  const pins = useQuery({
    queryKey: ["friend-pins"],
    queryFn: useServerFn(getFriendPins),
    refetchInterval: 45_000,
  });
  const peers = useQuery({ queryKey: ["share-peers"], queryFn: useServerFn(getSharePeers) });
  const state = useQuery({
    queryKey: ["sharing-state"],
    queryFn: useServerFn(getSharingState),
    refetchInterval: 60_000,
  });

  const [sheet, setSheet] = useState<null | "ghost" | "manage">(null);
  const [durationFor, setDurationFor] = useState<SharePeer | null>(null);
  const [focus, setFocus] = useState<FriendPin | null>(null);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["friend-pins"] });
    void qc.invalidateQueries({ queryKey: ["share-peers"] });
    void qc.invalidateQueries({ queryKey: ["sharing-state"] });
  };

  const share = useMutation({
    mutationFn: useServerFn(shareLocationWith),
    onSuccess: () => {
      toast.success("Location sharing started");
      setDurationFor(null);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const stop = useMutation({
    mutationFn: useServerFn(stopSharingWith),
    onSuccess: () => {
      toast.success("Sharing stopped");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const unwatch = useMutation({
    mutationFn: useServerFn(stopWatchingFriend),
    onSuccess: () => {
      toast.success("Removed from your map");
      setFocus(null);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const ghost = useMutation({
    mutationFn: useServerFn(setGhostMode),
    onSuccess: () => {
      setSheet(null);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const nudge = useMutation({
    mutationFn: useServerFn(nudgeFriendPin),
    onSuccess: () => toast.success("Nudge sent 📍"),
    onError: (e: Error) => toast.error(e.message),
  });

  const list = pins.data ?? [];

  const gh = state.data?.ghost;

  return (
    <section className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
            <Radio className="h-4 w-4" aria-hidden /> Find my friends
          </div>
          <h2 className="font-display mt-1 text-lg font-semibold">
            {gh?.active ? "You're hidden" : `Sharing with ${state.data?.sharingWith ?? 0}`}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {gh?.active
              ? gh.indefinite
                ? "Ghost Mode is on until you re-enable it. Guardians still see you."
                : `Ghost Mode until ${new Date(gh.until!).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}. Guardians still see you.`
              : "Pick who sees you, and for how long. Nothing is shared by default."}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" onClick={() => setSheet("manage")}>
            <Users className="h-4 w-4" aria-hidden /> Manage
          </Button>
          <Button
            variant={gh?.active ? "primary" : "ghost"}
            onClick={() =>
              gh?.active ? ghost.mutate({ data: { choice: "resume" } }) : setSheet("ghost")
            }
            loading={ghost.isPending}
          >
            <Ghost className="h-4 w-4" aria-hidden /> {gh?.active ? "Go live" : "Ghost"}
          </Button>
        </div>
      </Card>

      {pins.isLoading ? (
        <Skeleton className="h-64 rounded-3xl" />
      ) : list.length ? (
        <>
          <div className="space-y-2">
            {list.map((p) => (
              <motion.button
                key={p.profileId}
                type="button"
                whileTap={{ scale: 0.985 }}
                onClick={() => openFriend(p.profileId)}
                className="glass-card flex w-full items-center gap-3 p-3.5 text-left"
              >
                <Avatar
                  url={p.avatarUrl}
                  emoji={p.emoji}
                  name={alias(p.profileId, p.name)}
                  size={44}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold">
                      {alias(p.profileId, p.name)}
                    </span>
                    <span aria-hidden>{p.statusEmoji}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {p.address ?? p.motion} · {ago(p.lastSeen)}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  {p.distanceMiles != null ? (
                    <span className="block text-sm font-semibold">{p.distanceMiles} mi</span>
                  ) : null}
                  {p.batteryPct != null ? (
                    <span
                      className={cn(
                        "mt-0.5 flex items-center justify-end gap-1 text-xs",
                        p.batteryPct <= 20 ? "text-destructive" : "text-muted-foreground",
                      )}
                    >
                      {p.batteryPct <= 20 ? (
                        <BatteryLow className="h-3.5 w-3.5" aria-hidden />
                      ) : null}
                      {p.batteryPct}%
                    </span>
                  ) : null}
                </span>
              </motion.button>
            ))}
          </div>
        </>
      ) : (
        <Empty
          title="No one is sharing with you yet"
          body="Share your location with a squad mate and they'll usually share back — mutual sharing puts you both on the map."
        />
      )}

      {/* Manage: who I share with */}
      <Modal
        open={sheet === "manage"}
        onClose={() => setSheet(null)}
        title="Who can see me"
        description="Sharing is one-way unless they share back."
      >
        <div className="space-y-2">
          {(peers.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Join a squad to start sharing with friends.
            </p>
          ) : null}
          {(peers.data ?? []).map((peer) => (
            <div key={peer.profileId} className="surface flex items-center gap-3 rounded-2xl p-3">
              <Avatar
                url={peer.avatarUrl}
                emoji={peer.emoji}
                name={alias(peer.profileId, peer.name)}
                size={40}
              />
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => openFriend(peer.profileId)}
                  className="block max-w-full truncate text-left text-sm font-semibold"
                >
                  {alias(peer.profileId, peer.name)}
                </button>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {peer.sharingWithThem ? (
                    <Pill tone="good">
                      <Check className="h-3 w-3" aria-hidden />{" "}
                      {shareCountdown(peer.sharingWithThem.expiresAt)}
                    </Pill>
                  ) : (
                    <Pill>Not sharing</Pill>
                  )}
                  {peer.sharingWithMe ? <Pill tone="accent">Shares with you</Pill> : null}
                </div>
              </div>
              {peer.sharingWithThem ? (
                <Button
                  variant="ghost"
                  onClick={() => stop.mutate({ data: { viewerProfileId: peer.profileId } })}
                >
                  <X className="h-4 w-4" aria-hidden /> Stop
                </Button>
              ) : (
                <Button variant="outline" onClick={() => setDurationFor(peer)}>
                  Share
                </Button>
              )}
            </div>
          ))}
        </div>
      </Modal>

      {/* Duration picker */}
      <Modal
        open={Boolean(durationFor)}
        onClose={() => setDurationFor(null)}
        title={
          durationFor
            ? `Share with ${alias(durationFor.profileId, durationFor.name)}`
            : "Share location"
        }
        description="You can stop at any time."
      >
        <div className="space-y-2">
          {SHARE_OPTIONS.map((opt) => (
            <button
              key={opt.mode}
              type="button"
              disabled={share.isPending}
              onClick={() =>
                durationFor &&
                share.mutate({
                  data: { viewerProfileId: durationFor.profileId, mode: opt.mode as ShareMode },
                })
              }
              className="surface flex w-full items-center gap-3 rounded-2xl p-4 text-left transition active:scale-[0.98] disabled:opacity-60"
            >
              <span className="text-xl" aria-hidden>
                {opt.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{opt.label}</span>
                <span className="block text-xs text-muted-foreground">{opt.detail}</span>
              </span>
              {opt.mode === "hour" ? <Clock className="h-4 w-4 opacity-60" aria-hidden /> : null}
              {opt.mode === "end_of_day" ? (
                <Moon className="h-4 w-4 opacity-60" aria-hidden />
              ) : null}
              {opt.mode === "indefinite" ? (
                <InfinityIcon className="h-4 w-4 opacity-60" aria-hidden />
              ) : null}
            </button>
          ))}
        </div>
      </Modal>

      {/* Ghost mode */}
      <Modal
        open={sheet === "ghost"}
        onClose={() => setSheet(null)}
        title="Ghost Mode"
        description="Hides your pin from friends. Linked parents keep safety visibility."
      >
        <div className="space-y-2">
          {GHOST_OPTIONS.map((opt) => (
            <button
              key={opt.choice}
              type="button"
              disabled={ghost.isPending}
              onClick={() => ghost.mutate({ data: { choice: opt.choice as GhostChoice } })}
              className="surface flex w-full items-center gap-3 rounded-2xl p-4 text-left transition active:scale-[0.98] disabled:opacity-60"
            >
              <EyeOff className="h-4 w-4 opacity-70" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{opt.label}</span>
                <span className="block text-xs text-muted-foreground">{opt.detail}</span>
              </span>
            </button>
          ))}
        </div>
      </Modal>

      {/* Friend detail */}
      <Modal
        open={Boolean(focus)}
        onClose={() => setFocus(null)}
        title={focus ? `${focus.name} ${focus.statusEmoji}` : "Friend"}
        description={focus?.address ?? focus?.motion ?? undefined}
      >
        {focus ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Pill tone="accent">
                <MapPin className="h-3 w-3" aria-hidden />{" "}
                {focus.distanceMiles != null
                  ? `${focus.distanceMiles} mi away`
                  : "Distance unknown"}
              </Pill>
              {focus.driveMinutes != null ? (
                <Pill>
                  <Navigation className="h-3 w-3" aria-hidden /> ~{focus.driveMinutes} min drive
                </Pill>
              ) : null}
              {focus.batteryPct != null ? (
                <Pill tone={focus.batteryPct <= 20 ? "bad" : "neutral"}>
                  {focus.batteryPct}% battery
                </Pill>
              ) : null}
              <Pill>Updated {ago(focus.lastSeen)}</Pill>
              {focus.sharingWithThem ? (
                <Pill tone="good">2-way · {shareCountdown(focus.sharingWithThem.expiresAt)}</Pill>
              ) : (
                <Pill tone="warn">They share with you</Pill>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <a
                href={directionsUrl(focus.lat, focus.lon, focus.name)}
                target="_blank"
                rel="noreferrer"
                className="surface flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold"
              >
                <Navigation className="h-4 w-4" aria-hidden /> Directions
              </a>
              <Button
                variant="outline"
                loading={nudge.isPending}
                onClick={() => nudge.mutate({ data: { profileId: focus.profileId } })}
              >
                <Bell className="h-4 w-4" aria-hidden /> Nudge
              </Button>
            </div>

            {focus.sharingWithThem ? (
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => stop.mutate({ data: { viewerProfileId: focus.profileId } })}
              >
                Stop sharing my location with {focus.name}
              </Button>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setFocus(null);
                  setDurationFor({
                    profileId: focus.profileId,
                    name: focus.name,
                    emoji: focus.emoji,
                    avatarUrl: focus.avatarUrl,
                    sharingWithThem: null,
                    sharingWithMe: focus.sharingWithMe,
                  });
                }}
              >
                Share back with {focus.name}
              </Button>
            )}
            <Button
              variant="danger"
              className="w-full"
              loading={unwatch.isPending}
              onClick={() => unwatch.mutate({ data: { ownerProfileId: focus.profileId } })}
            >
              Remove from my map
            </Button>
          </div>
        ) : null}
      </Modal>
    </section>
  );
}
