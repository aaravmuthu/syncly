import { useMemo } from "react";
import {
  SquadMap,
  type MapPerson,
  type MapPlace,
  type MapZone,
} from "@/components/quorum/map/SquadMap";
import type { TeenCard } from "@/lib/quorum/guardian.types";

/**
 * Parent-side mirror of the squad radar: the teen's live avatar pin with
 * telemetry, their geofenced safe zones and the venue for the active plan.
 */
export function TeenRadarMap({ teen }: { teen: TeenCard }) {
  // Memoized on `teen` so the map's marker effect (which tears down and
  // recreates every marker plus re-fits the camera whenever these arrays get
  // a new reference) only re-runs when this teen's own data actually
  // changes, not on every unrelated re-render of the guardian dashboard.
  const { people, zones, places } = useMemo(() => {
    const people: MapPerson[] = [];
    const zones: MapZone[] = [];
    const places: MapPlace[] = [];

    if (teen.location) {
      people.push({
        id: teen.id,
        name: teen.name,
        initials:
          teen.name
            .split(/\s+/)
            .slice(0, 2)
            .map((w) => w[0] ?? "")
            .join("")
            .toUpperCase() || "?",
        avatarUrl: teen.avatar_url,
        lat: teen.location.lat,
        lon: teen.location.lon,
        batteryPct: teen.location.battery_pct,
        motion: teen.status.label,
        state: /arriv|home|at /i.test(teen.status.label)
          ? "arrived"
          : /driv|walk|way|mov/i.test(teen.status.label)
            ? "enroute"
            : "idle",
        lastSeen: teen.location.at,
      });
    }

    for (const z of teen.zones) {
      zones.push({ id: z.id, label: z.label, lat: z.lat, lon: z.lon, radiusM: z.radius_m });
    }

    const plan = teen.plans.find((p) => p.lat != null && p.lon != null);
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

    return { people, zones, places };
  }, [teen]);

  return (
    <SquadMap
      people={people}
      zones={zones}
      places={places}
      showMidpoint={false}
      compact
      className="h-72 w-full sm:h-80"
    />
  );
}
