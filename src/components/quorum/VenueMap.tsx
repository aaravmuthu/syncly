import { lazy, Suspense, useEffect } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMapToken } from "@/lib/quorum/location.functions";
import { Card, Skeleton } from "@/components/quorum/ui";
import { ErrorBoundary } from "@/components/quorum/ErrorBoundary";

import type { MapVenue } from "./VenueMapInner";

const Inner = lazy(() => import("./VenueMapInner"));

export type { MapVenue };

/**
 * Dark Mapbox map of the candidate venues. Degrades to a plain list-only view
 * when no map token is configured or the map fails to load.
 */
export function VenueMap({
  venues,
  onSelect,
  mapClassName,
  nearbyPlaces = true,
}: {
  venues: MapVenue[];
  onSelect?: (id: string) => void;
  mapClassName?: string;
  /** Public approval links keep basemap POIs without requiring a signed-in lookup. */
  nearbyPlaces?: boolean;
}) {
  const fetchToken = useServerFn(getMapToken);
  const token = useQuery({
    queryKey: ["map-token"],
    queryFn: () => fetchToken(),
    staleTime: 1000 * 60 * 60,
    retry: false,
  });

  // Same chunk as SquadMap's Mapbox engine -- start it in parallel with the
  // token round-trip below instead of waiting on that first.
  useEffect(() => {
    void import("./VenueMapInner");
  }, []);

  if (venues.length === 0) return null;
  if (token.isLoading) return <Skeleton className="h-64 rounded-2xl" />;
  // Missing token, disabled maps, or a failed lookup: render nothing rather
  // than a broken map surface. The venue list above stays fully usable.
  if (token.isError || !token.data) return null;

  return (
    <Card className="overflow-hidden p-0">
      <ErrorBoundary label="venue-map" fallback={null}>
        <ClientOnly fallback={<Skeleton className="h-64 rounded-2xl" />}>
          <Suspense fallback={<Skeleton className="h-64 rounded-2xl" />}>
            <Inner
              token={token.data}
              nearbyPlaces={nearbyPlaces}
              venues={venues}
              onSelect={onSelect}
              className={mapClassName}
            />
          </Suspense>
        </ClientOnly>
      </ErrorBoundary>
    </Card>
  );
}
