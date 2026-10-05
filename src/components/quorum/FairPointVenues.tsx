import { Pill } from "./ui";
import type { FairVenue } from "@/lib/quorum/planner.functions";
import { directionsUrl } from "./directions";
import { firstName } from "@/lib/quorum/names";

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
    ...others.map((d) => `${d.minutes} min for ${firstName(d.name)}`),
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <div
      className={`w-full rounded-3xl border p-4 text-left transition ${
        selected ? "border-primary/60 bg-primary/6" : "border-border hover:bg-secondary/60"
      }`}
    >
      <button
        type="button"
        aria-pressed={Boolean(selected)}
        onClick={onSelect}
        className="block w-full text-left"
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

        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-caption">
          {venue.cuisine ? <Pill>{venue.cuisine}</Pill> : null}
          <Pill>{venue.priceLevel}</Pill>
          {venue.fairMiles != null ? <Pill>{venue.fairMiles} mi from fair point</Pill> : null}
        </div>

        {driveLine ? <p className="mt-2 text-xs text-muted-foreground">{driveLine}</p> : null}

        {!venue.scheduleFits ? (
          <p className="mt-2 rounded-2xl bg-warning/15 px-3 py-2 text-xs text-warning">
            This option does not meet every member's timing requirements.
          </p>
        ) : null}
      </button>

      <a
        href={directionsUrl(venue)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="mt-2 inline-block text-xs font-medium text-primary underline-offset-4 hover:underline"
      >
        Directions in Maps →
      </a>
    </div>
  );
}
