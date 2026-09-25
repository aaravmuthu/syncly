import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Modal } from "@/components/quorum/Modal";
import { Pill, Skeleton } from "@/components/quorum/ui";
import { getVenueInsight } from "@/lib/quorum/reviews.functions";
import { googleReviewsUrl, venuePhoto, venueStats } from "@/lib/quorum/venuePhotos";
import { directionsUrl } from "@/lib/quorum/vibes";

export type VenueDetail = {
  key: string;
  title: string;
  address?: string | null;
  subtitle?: string | null;
  cuisine?: string | null;
  category?: string | null;
  kind?: string | null;
  priceLevel?: string | null;
  lat?: number | null;
  lon?: number | null;
};

export function VenueDetailModal({
  venue,
  onClose,
  footer,
}: {
  venue: VenueDetail | null;
  onClose: () => void;
  footer?: React.ReactNode;
}) {
  const run = useServerFn(getVenueInsight);
  const insight = useQuery({
    enabled: !!venue,
    queryKey: ["venue-insight", venue?.key ?? "", venue?.title ?? ""],
    staleTime: 1000 * 60 * 60,
    queryFn: () =>
      run({
        data: {
          name: venue!.title,
          address: venue!.address ?? null,
          cuisine: venue!.cuisine ?? null,
          kind: venue!.kind ?? "food",
          priceLevel: venue!.priceLevel ?? null,
        },
      }),
  });

  if (!venue) return null;
  const stats = venueStats(venue.key || venue.title);
  const data = insight.data;

  return (
    <Modal open onClose={onClose} title={venue.title}>
      <div className="space-y-4">
        <div className="relative overflow-hidden rounded-2xl">
          <img
            src={venuePhoto(venue)}
            alt={`${venue.title} — ${venue.cuisine ?? venue.subtitle ?? "venue"}`}
            loading="lazy"
            className="h-40 w-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/70 to-transparent p-3">
            <span className="rounded-full bg-white/15 px-2 py-1 text-caption font-semibold text-white backdrop-blur">
              {stats.ratingLabel}
            </span>
            <span className="rounded-full bg-white/15 px-2 py-1 text-caption font-semibold text-white backdrop-blur">
              {venue.priceLevel ?? "$$"}
            </span>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">{venue.address ?? venue.subtitle}</p>

        {insight.isLoading ? (
          <Skeleton className="h-32 rounded-2xl" />
        ) : data ? (
          <div className="space-y-3">
            {data.popularDishes.length ? (
              <div>
                <p className="text-caption font-semibold uppercase tracking-wide text-muted-foreground">
                  Popular picks
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {data.popularDishes.map((d) => (
                    <Pill key={d} tone="accent">
                      {d}
                    </Pill>
                  ))}
                </div>
              </div>
            ) : null}

            {data.vibes.length ? (
              <div className="flex flex-wrap gap-1.5">
                {data.vibes.map((v) => (
                  <Pill key={v}>{v}</Pill>
                ))}
              </div>
            ) : null}

            <div className="space-y-2">
              {data.reviews.map((r) => (
                <div key={r.author + r.text} className="rounded-2xl border border-border p-3">
                  <p className="text-xs font-semibold">
                    {r.author} · ★ {r.rating.toFixed(1)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{r.text}</p>
                </div>
              ))}
            </div>
            <p className="text-caption text-muted-foreground">
              {data.aiGenerated
                ? "AI summary of what people say about spots like this — check Google for verified reviews."
                : "Sample highlights — check Google for verified reviews."}
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {footer}
          <a
            href={googleReviewsUrl(venue.title, venue.address)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-xl border border-border px-3 py-2 text-xs font-medium hover:bg-secondary"
          >
            Read 100+ reviews on Google Maps →
          </a>
          <a
            href={directionsUrl({
              title: venue.title,
              address: venue.address,
              lat: venue.lat ?? null,
              lon: venue.lon ?? null,
            })}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-xl border border-border px-3 py-2 text-xs font-medium hover:bg-secondary"
          >
            🧭 Directions
          </a>
        </div>
      </div>
    </Modal>
  );
}
