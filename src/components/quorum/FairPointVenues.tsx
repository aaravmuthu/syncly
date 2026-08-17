import { Pill } from "./ui";
import type { FairVenue } from "@/lib/quorum/planner.functions";

export function directionsUrl(v: {
  title: string;
  lat: number | null;
  lon: number | null;
  address?: string | null;
}) {
  if (v.lat != null && v.lon != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${v.lat},${v.lon}`;
  }
  const q = encodeURIComponent([v.title, v.address].filter(Boolean).join(" "));
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

/** Venue card with per-member drive times, cost badge and curfew guardian. */
export function FairVenueCard({
  venue,
  meProfileId,
  selected,
  onSelect,
}: {
  venue: FairVenue;
  meProfileId?: string | null;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const mine = venue.drives.find((d) => d.profileId === meProfileId);
  const others = venue.drives.filter((d) => d.profileId !== meProfileId).slice(0, 3);
  const driveLine = [
    mine ? `${mine.minutes} min for you` : null,
    ...others.map((d) => `${d.minutes} min for ${d.name.split(" ")[0]}`),
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-3xl border p-4 text-left transition ${
        selected ? "border-primary/60 bg-primary/6" : "border-border hover:bg-secondary/60"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-semibold">
            <span className="mr-1">{venue.kind === "food" ? "🍽️" : "🎟️"}</span>
            {venue.title}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {venue.address ?? venue.subtitle}
          </p>
        </div>
        <Pill tone="accent">
          ${venue.costMin}–{venue.costMax}/person
        </Pill>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
        {venue.cuisine ? <Pill>{venue.cuisine}</Pill> : null}
        <Pill>{venue.priceLevel}</Pill>
        {venue.fairMiles != null ? <Pill>{venue.fairMiles} mi from fair point</Pill> : null}
      </div>

      {driveLine ? <p className="mt-2 text-xs text-muted-foreground">{driveLine}</p> : null}

      {venue.curfewWarnings.length ? (
        <p className="mt-2 rounded-2xl bg-warning/15 px-3 py-2 text-xs text-warning-foreground">
          ⚠️ Heads up: wraps up at {venue.curfewWarnings[0]!.wrapsAt}, which is past{" "}
          {venue.curfewWarnings[0]!.name}'s {venue.curfewWarnings[0]!.curfew} curfew
          {venue.curfewWarnings.length > 1 ? ` (+${venue.curfewWarnings.length - 1} more)` : ""}.
        </p>
      ) : null}

      <a
        href={directionsUrl(venue)}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="mt-2 inline-block text-xs font-medium text-primary underline-offset-4 hover:underline"
      >
        Directions in Maps →
      </a>
    </button>
  );
}
