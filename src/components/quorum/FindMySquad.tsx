import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BatteryFull, BatteryLow, Car, ChevronRight, MapPin, PersonStanding } from "lucide-react";
import { Avatar } from "./Avatar";
import { SquadMap, type MapPerson, type MapZone } from "./map/SquadMap";
import { Skeleton } from "./ui";
import { getGuardianHub, getMyRadar } from "@/lib/quorum/guardian.functions";
import { getMe } from "@/lib/quorum/plan.functions";
import type { TeenCard } from "@/lib/quorum/guardian.types";
import { cn } from "@/lib/utils";
import { AiActivity } from "@/components/quorum/ai/AiActivity";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase() || "?";

function statusIcon(label: string) {
  if (/driv|car/i.test(label)) return Car;
  if (/walk/i.test(label)) return PersonStanding;
  return MapPin;
}

function since(iso?: string | null) {
  if (!iso) return "no signal";
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

/**
 * Apple "Find My" style compact widget for the home feed: one dark map with
 * live pins plus a row of status chips for every linked person.
 */
export function FindMySquad() {
  // Shares the ["me"] cache AppShell/HomePage already populate — this never
  // fires its own request, it just reads flags to decide whether the two
  // queries below (each an extra round trip, polled forever) are worth
  // making at all. Most accounts are neither a guardian nor location-sharing,
  // so this keeps the home feed from perpetually fetching radar data no one
  // has.
  const myProfile = useQuery({ queryKey: ["me"], queryFn: useServerFn(getMe), retry: false });
  const hub = useQuery({
    queryKey: ["guardian-hub"],
    queryFn: useServerFn(getGuardianHub),
    refetchInterval: 60_000,
    enabled: Boolean(myProfile.data?.hasLinkedTeens),
  });
  const mine = useQuery({
    queryKey: ["my-radar"],
    queryFn: useServerFn(getMyRadar),
    refetchInterval: 90_000,
    enabled: Boolean(myProfile.data?.location_sharing_enabled),
  });

  if (myProfile.isLoading || hub.isLoading || mine.isLoading) {
    return (
      <div className="relative">
        <Skeleton className="h-[26rem] rounded-surface md:h-[32rem]" />
        <AiActivity
          state="searching"
          label="Finding your squad…"
          size={64}
          className="absolute inset-0 justify-center"
        />
      </div>
    );
  }

  const teens = (hub.data?.teens ?? []) as TeenCard[];
  const me = mine.data;
  const people: MapPerson[] = [];
  const zones: MapZone[] = [];

  for (const t of teens) {
    if (!t.location) continue;
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

  if (people.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xl font-bold tracking-tight">Find my squad</h2>
        <Link
          to="/radar"
          className="hit-slop inline-flex items-center gap-0.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          Full radar <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>

      <SquadMap compact people={people} zones={zones} className="h-[26rem] w-full md:h-[32rem]" />

      <div className="chip-row">
        {teens.map((t) => (
          <StatusChip
            key={t.id}
            name={t.name}
            emoji={t.emoji}
            avatar={t.avatar_url}
            status={t.status.label}
            battery={t.location?.battery_pct ?? null}
            at={t.location?.at ?? null}
          />
        ))}
        {me?.lastPing ? (
          <StatusChip
            name="You"
            emoji={me.me.emoji}
            avatar={me.me.avatar_url}
            status={me.lastPing.status_label ?? "Sharing"}
            battery={me.lastPing.battery_pct}
            at={me.lastPing.created_at}
          />
        ) : null}
      </div>
    </section>
  );
}

function StatusChip({
  name,
  emoji,
  avatar,
  status,
  battery,
  at,
}: {
  name: string;
  emoji: string | null;
  avatar: string | null;
  status: string;
  battery: number | null;
  at: string | null;
}) {
  const Icon = statusIcon(status);
  const Batt = battery != null && battery <= 20 ? BatteryLow : BatteryFull;
  return (
    <div className="flex shrink-0 items-center gap-2.5 rounded-[22px] border border-white/5 bg-card/40 px-3 py-2 backdrop-blur-3xl">
      <Avatar url={avatar} emoji={emoji} name={name} size={32} />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{name}</p>
        <p className="flex items-center gap-1 text-caption font-medium text-muted-foreground">
          <Icon className="h-3 w-3" aria-hidden />
          <span className="max-w-28 truncate">{status}</span>
          <span aria-hidden>·</span>
          {since(at)}
        </p>
      </div>
      {battery != null ? (
        <span
          className={cn(
            "inline-flex items-center gap-0.5 text-caption font-semibold",
            battery <= 20 ? "text-destructive" : "text-muted-foreground",
          )}
        >
          <Batt className="h-3.5 w-3.5" aria-hidden />
          {battery}%
        </span>
      ) : null}
    </div>
  );
}
