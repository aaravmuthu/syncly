import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  BatteryFull,
  BatteryLow,
  Car,
  Clock,
  MapPin,
  Navigation,
  PersonStanding,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/quorum/AppShell";
import { PullToRefresh } from "@/components/quorum/interactions";
import { Avatar } from "@/components/quorum/Avatar";
import { useFriends } from "@/lib/quorum/nicknames";
import { Button, Card, Empty, Pill, Skeleton } from "@/components/quorum/ui";
import {
  SquadMap,
  type MapPerson,
  type MapPlace,
  type MapZone,
} from "@/components/quorum/map/SquadMap";
import {
  arrivedSafely,
  getGuardianHub,
  getMyRadar,
  pushLocation,
} from "@/lib/quorum/guardian.functions";
import type { TeenCard } from "@/lib/quorum/guardian.types";
import { FindMyFriends } from "@/components/quorum/sharing/FindMyFriends";
import { getFriendPins } from "@/lib/quorum/sharing.functions";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/_authenticated/radar")({
  head: () => ({
    meta: [
      { title: "Live radar — Syncly" },
      {
        name: "description",
        content:
          "See where your squad and family are in real time: live pins, battery levels, motion status and one-tap arrived-safely check-ins.",
      },
      { property: "og:title", content: "Live radar — Syncly" },
      {
        property: "og:description",
        content: "Real-time location radar for squads and families, with safe-zone alerts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    ...(typeof s.lat === "number" ? { lat: s.lat } : {}),
    ...(typeof s.lon === "number" ? { lon: s.lon } : {}),
    ...(typeof s.label === "string" ? { label: s.label } : {}),
  }),
  component: RadarPage,
});

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase() || "?";

function elapsed(iso: string | null | undefined) {
  if (!iso) return "no signal yet";
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

function motionIcon(label: string) {
  if (/driv|car|road/i.test(label)) return Car;
  if (/walk/i.test(label)) return PersonStanding;
  return MapPin;
}

async function currentPosition(): Promise<GeolocationPosition | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return null;
  return new Promise((resolve) =>
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(p),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 20_000 },
    ),
  );
}

async function batteryPct(): Promise<number | null> {
  const nav = navigator as Navigator & { getBattery?: () => Promise<{ level: number }> };
  if (!nav.getBattery) return null;
  try {
    return Math.round((await nav.getBattery()).level * 100);
  } catch {
    return null;
  }
}

function speedLabel(pos: GeolocationPosition) {
  const mps = pos.coords.speed ?? 0;
  const mph = Math.round(mps * 2.23694);
  if (mph >= 12) return `Driving · ${mph} mph`;
  if (mph >= 2) return "Walking";
  return "Stationary";
}

function RadarPage() {
  const navigate = useNavigate();
  const { alias, openFriend } = useFriends();
  const focus = Route.useSearch();
  const hub = useQuery({
    queryKey: ["guardian-hub"],
    queryFn: useServerFn(getGuardianHub),
    refetchInterval: 45_000,
  });
  const mine = useQuery({
    queryKey: ["my-radar"],
    queryFn: useServerFn(getMyRadar),
    refetchInterval: 60_000,
  });
  const friendPins = useQuery({
    queryKey: ["friend-pins"],
    queryFn: useServerFn(getFriendPins),
    refetchInterval: 45_000,
  });

  const teens = (hub.data?.teens ?? []) as TeenCard[];
  const loading = hub.isLoading || mine.isLoading || friendPins.isLoading;

  const people: MapPerson[] = [];
  const zones: MapZone[] = [];
  const places: MapPlace[] = [];

  // Guardian links imply a location share too, so a linked teen can show up
  // in both feeds — the teen card below already covers them.
  const teenIds = new Set(teens.map((t) => t.id));
  for (const p of friendPins.data ?? []) {
    if (teenIds.has(p.profileId)) continue;
    people.push({
      id: p.profileId,
      name: alias(p.profileId, p.name),
      initials: initials(alias(p.profileId, p.name)),
      avatarUrl: p.avatarUrl,
      lat: p.lat,
      lon: p.lon,
      motion: p.motion,
      batteryPct: p.batteryPct,
      address: p.address,
      etaMinutes: p.driveMinutes,
      lastSeen: p.lastSeen,
      state: p.atHome ? "arrived" : /driv|walk/i.test(p.motion ?? "") ? "enroute" : "idle",
    });
  }

  for (const t of teens) {
    if (t.location) {
      people.push({
        id: t.id,
        name: t.name,
        initials: initials(t.name),
        avatarUrl: t.avatar_url,
        lat: t.location.lat,
        lon: t.location.lon,
        batteryPct: t.location.battery_pct,
        motion: t.status.label,
        state: /arriv|home|at /i.test(t.status.label)
          ? "arrived"
          : /driv|walk|way|mov/i.test(t.status.label)
            ? "enroute"
            : "idle",
        lastSeen: t.location.at,
      });
    }
    for (const z of t.zones) {
      zones.push({ id: z.id, label: z.label, lat: z.lat, lon: z.lon, radiusM: z.radius_m });
    }
    const plan = t.plans.find((p) => p.lat != null && p.lon != null);
    if (plan?.lat != null && plan.lon != null) {
      places.push({
        id: plan.id,
        title: plan.venue ?? plan.title,
        subtitle: plan.group_name,
        lat: plan.lat,
        lon: plan.lon,
        active: true,
      });
    }
  }

  const me = mine.data;
  if (me?.lastPing) {
    people.push({
      id: "me",
      name: me.me.name,
      initials: initials(me.me.name),
      avatarUrl: me.me.avatar_url,
      lat: me.lastPing.lat,
      lon: me.lastPing.lon,
      batteryPct: me.lastPing.battery_pct,
      motion: me.lastPing.status_label ?? "Sharing",
      state: /driv|walk/i.test(me.lastPing.status_label ?? "") ? "enroute" : "idle",
      lastSeen: me.lastPing.created_at,
    });
  }
  for (const z of me?.zones ?? []) {
    zones.push({ id: z.id, label: z.label, lat: z.lat, lon: z.lon, radiusM: 200 });
  }

  // A chat card can hand us a pin to fly to (?lat&lon&label).
  if (focus.lat != null && focus.lon != null) {
    places.unshift({
      id: "chat-focus",
      title: focus.label ?? "Shared pin",
      subtitle: "Shared in chat",
      lat: focus.lat,
      lon: focus.lon,
      active: true,
    });
    people.unshift({
      id: "chat-focus-pin",
      name: focus.label ?? "Shared pin",
      initials: "📍",
      lat: focus.lat,
      lon: focus.lon,
      motion: "Shared in chat",
      state: "arrived",
    });
  }

  const hasPins = people.length > 0 || zones.length > 0;


  return (
    <AppShell title="Radar">
      <PullToRefresh
        onRefresh={async () => {
          await Promise.all([hub.refetch(), mine.refetch(), friendPins.refetch()]);
        }}
      >
      <div className="space-y-5">
        <header className="glass-card p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
            <ShieldCheck className="h-4 w-4" aria-hidden /> Live radar
          </div>
          <h1 className="font-display mt-1 text-xl font-semibold">Everyone, on one map</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live pins update while a hangout is running. Safe-zone arrivals ping linked parents
            automatically.
          </p>
        </header>

        {loading ? (
          <Skeleton className="h-72 rounded-3xl" />
        ) : (
          <>
            {hasPins ? (
              <SquadMap
                people={people}
                zones={zones}
                places={places}
                className="h-[58vh] min-h-80 w-full"
                onProfile={(p) => (p.id === "me" || p.id === "chat-focus-pin" ? null : openFriend(p.id))}
                onPing={(p) => toast(`Nudge sent to ${p.name}`)}
                onMessage={(p) =>
                  p.id === "me"
                    ? toast("That's you 🙂")
                    : navigate({ to: "/messages", search: { peer: p.id } })
                }
              />
            ) : null}
            <FindMyFriends />
            {teens.length > 0 ? <FamilyRadar teens={teens} /> : null}
            {mine.data ? <MyRadar data={mine.data} /> : null}

            {teens.length === 0 && !mine.data?.lastPing ? (
              <Empty
                title="No live pins yet"
                body="Turn on location sharing in Settings, or link a family account to see live pins here."
              />
            ) : null}
          </>
        )}
      </div>
      </PullToRefresh>
    </AppShell>
  );
}

function FamilyRadar({ teens }: { teens: TeenCard[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Family radar
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {teens.map((t) => (
          <TeenWidget key={t.id} teen={t} />
        ))}
      </div>
    </section>
  );
}


function TeenWidget({ teen }: { teen: TeenCard }) {
  const Icon = motionIcon(teen.status.label);
  const battery = teen.location?.battery_pct ?? null;
  const Batt = battery != null && battery <= 20 ? BatteryLow : BatteryFull;

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="glass-card p-4"
    >
      <div className="flex items-center gap-3">
        <Avatar url={teen.avatar_url} emoji={teen.emoji} name={teen.name} size={40} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{teen.name}</div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Icon className="h-3.5 w-3.5" aria-hidden />
            <span className="truncate">{teen.status.label}</span>
          </div>
        </div>
        <Pill tone={teen.sharing ? "good" : "neutral"}>{teen.sharing ? "Live" : "Off"}</Pill>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {battery != null ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-1",
              battery <= 20 && "text-destructive",
            )}
          >
            <Batt className="h-3.5 w-3.5" aria-hidden /> {battery}%
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-1">
          <Clock className="h-3.5 w-3.5" aria-hidden /> {elapsed(teen.location?.at ?? null)}
        </span>
        {teen.curfew ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-1">
            <Navigation className="h-3.5 w-3.5" aria-hidden /> Curfew {teen.curfew.slice(0, 5)}
          </span>
        ) : null}
      </div>
    </motion.div>
  );
}

type MyRadarData = {
  me: { name: string; emoji: string | null; avatar_url: string | null; sharing: boolean };
  zones: { id: string; label: string; lat: number; lon: number }[];
  lastPing: {
    lat: number;
    lon: number;
    battery_pct: number | null;
    status_label: string | null;
    created_at: string;
  } | null;
  guardians: number;
};

function MyRadar({ data }: { data: MyRadarData }) {
  const qc = useQueryClient();
  const ping = useServerFn(pushLocation);
  const [status, setStatus] = useState<string>(data.lastPing?.status_label ?? "Stationary");
  const zoneRef = useRef<string | null>(null);

  const beacon = useMutation({
    mutationFn: useServerFn(arrivedSafely),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["my-radar"] });
      toast.success("Arrived safely sent", {
        description: data.guardians
          ? "Your parents got a high-priority check-in."
          : "Saved. Link a parent to notify them too.",
      });
    },
  });

  const send = useCallback(async () => {
    const pos = await currentPosition();
    if (!pos) return;
    const label = speedLabel(pos);
    setStatus(label);
    const nearest = data.zones.find(
      (z) =>
        Math.hypot(z.lat - pos.coords.latitude, z.lon - pos.coords.longitude) * 111_000 <= 200,
    );
    if (nearest && zoneRef.current !== nearest.id) {
      zoneRef.current = nearest.id;
      toast.success(`Arrived at ${nearest.label}`, { description: "Your parents were notified." });
    } else if (!nearest && zoneRef.current) {
      const left = data.zones.find((z) => z.id === zoneRef.current);
      zoneRef.current = null;
      if (left) toast(`Left ${left.label}`);
    }
    await ping({
      data: {
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        accuracyM: Math.round(pos.coords.accuracy),
        batteryPct: await batteryPct(),
        statusLabel: label,
      },
    }).catch(() => null);
    void qc.invalidateQueries({ queryKey: ["my-radar"] });
  }, [data.zones, ping, qc]);

  useEffect(() => {
    if (!data.me.sharing) return;
    void send();
    const t = setInterval(() => void send(), 2 * 60_000);
    return () => clearInterval(t);
  }, [data.me.sharing, send]);

  const Icon = motionIcon(status);

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Your live status
      </h2>

      <Card className="flex items-center gap-3">
        <Avatar
          url={data.me.avatar_url}
          emoji={data.me.emoji}
          name={data.me.name}
          size={40}
        />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{data.me.name}</div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Icon className="h-3.5 w-3.5" aria-hidden />
            <span>{status}</span>
            <span aria-hidden>·</span>
            <span>{elapsed(data.lastPing?.created_at ?? null)}</span>
          </div>
        </div>
        <Pill tone={data.me.sharing ? "good" : "neutral"}>
          {data.me.sharing ? "Sharing" : "Private"}
        </Pill>
      </Card>

      <motion.div whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.02 }}>
        <Button
          className="w-full py-4 text-base"
          loading={beacon.isPending}
          onClick={async () => {
            const pos = await currentPosition();
            beacon.mutate({
              data: {
                lat: pos?.coords.latitude ?? null,
                lon: pos?.coords.longitude ?? null,
                batteryPct: await batteryPct(),
                placeLabel: null,
              },
            });
          }}
        >
          <ShieldCheck className="h-5 w-5" aria-hidden />
          I arrived safely
        </Button>
      </motion.div>
    </section>
  );
}
