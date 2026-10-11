import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Modal } from "@/components/quorum/Modal";
import { getVenueInsight } from "@/lib/quorum/reviews.functions";
import { googleReviewsUrl, venuePhoto, venuePhotoSrcSet } from "@/lib/quorum/venuePhotos";
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
  const data = insight.data;

  return (
    <Modal open onClose={onClose} title={venue.title}>
      <div className="space-y-4">
        <div className="relative overflow-hidden rounded-2xl">
          <img
            src={venuePhoto(venue)}
            srcSet={venuePhotoSrcSet(venue)}
            sizes="(max-width: 511px) calc(100vw - 2.5rem), 470px"
            decoding="async"
            alt={`Illustrative photo for ${venue.cuisine ?? venue.subtitle ?? "this category"}`}
            loading="lazy"
            className="h-40 w-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/70 to-transparent p-3">
            <span className="rounded-full bg-white/15 px-2 py-1 text-caption font-semibold text-white backdrop-blur">
              {venue.priceLevel ?? "$$"}
            </span>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">{venue.address ?? venue.subtitle}</p>

        <p className="text-caption text-muted-foreground">
          Illustrative photo. Prices and venue details should be confirmed before you go.
        </p>
        {data ? (
          <div>
            <h3 className="text-sm font-semibold">Before you go</h3>
            <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
              {data.checks.map((check) => (
                <li key={check}>{check}</li>
              ))}
            </ul>
          </div>
        ) : insight.isError ? (
          <p role="alert" className="text-sm">
            Venue details are unavailable. Check the venue directly.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {footer}
          <a
            href={googleReviewsUrl(venue.title, venue.address)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-xl border border-border px-3 py-2 text-xs font-medium hover:bg-secondary"
          >
            Check reviews on Google Maps →
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
