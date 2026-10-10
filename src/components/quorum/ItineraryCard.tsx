import { Card } from "@/components/quorum/ui";
import { ItineraryTimeline } from "@/components/quorum/ai/ItineraryTimeline";
import { AiGlyph } from "@/components/quorum/ai/AiGlyph";
import { costRange, readItinerary, timeline, to12h } from "@/lib/quorum/itinerary";

/**
 * The night Sync built for this plan, as the host launched it. Read-only:
 * the stop marked "Group votes here" is the one the normal private-answer
 * and voting flow below decides; the others show the host's pick first.
 * Renders nothing for plans made the old way.
 */
export function ItineraryCard({ raw }: { raw: unknown }) {
  const it = readItinerary(raw);
  if (!it) return null;
  const { end } = timeline(it);
  const cost = costRange(it);
  return (
    <Card className="mt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold">
          <AiGlyph className="size-4 text-primary" /> The night
        </h2>
        <p className="text-xs tabular-nums text-muted-foreground">
          {to12h(it.start)} – {to12h(end)}
          {cost.max ? ` · $${cost.min}–${cost.max} each` : ""}
          {it.weather ? ` · ${it.weather.emoji} ${it.weather.line.split(" · ")[0]}` : ""}
        </p>
      </div>
      {it.vibe ? <p className="mt-1 text-sm text-muted-foreground">{it.vibe}</p> : null}
      <div className="mt-4">
        <ItineraryTimeline start={it.start} stops={it.stops} anchor={it.anchor} />
      </div>
    </Card>
  );
}
