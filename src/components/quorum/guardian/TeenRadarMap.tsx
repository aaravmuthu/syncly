import { VenueMap, type MapVenue } from "@/components/quorum/VenueMap";
import type { TeenCard } from "@/lib/quorum/guardian.server";

/**
 * Live radar for one teen: their last known ping, their safe zones and the
 * venue for the plan they're on, all on the same dark map.
 */
export function TeenRadarMap({ teen }: { teen: TeenCard }) {
  const pins: MapVenue[] = [];

  if (teen.location) {
    pins.push({
      id: `teen-${teen.id}`,
      title: `${teen.name} — ${teen.status.label}`,
      lat: teen.location.lat,
      lon: teen.location.lon,
      selected: true,
      kind: "fair",
    });
  }
  for (const z of teen.zones) {
    pins.push({ id: `zone-${z.id}`, title: z.label, lat: z.lat, lon: z.lon, kind: "home" });
  }
  const nextPlan = teen.plans.find((p) => p.lat != null && p.lon != null);
  if (nextPlan?.lat != null && nextPlan.lon != null) {
    pins.push({
      id: `plan-${nextPlan.id}`,
      title: nextPlan.venue ?? nextPlan.title,
      lat: nextPlan.lat,
      lon: nextPlan.lon,
      kind: "activity",
    });
  }

  if (pins.length === 0) return null;
  return <VenueMap venues={pins} />;
}
