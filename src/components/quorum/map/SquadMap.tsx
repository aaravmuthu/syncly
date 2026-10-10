import { lazy, Suspense, useEffect } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMapToken } from "@/lib/quorum/location.functions";
import { Skeleton } from "@/components/quorum/ui";
import { ErrorBoundary } from "@/components/quorum/ErrorBoundary";
import type { MapPerson, SquadMapData } from "./types";

const Inner = lazy(() => import("./SquadMapInner"));

/**
 * Apple-Maps-style squad map. Fetches the public Mapbox token, then renders the
 * browser-only engine behind <ClientOnly>. Renders nothing when maps are off.
 */
export function SquadMap({
  className,
  compact,
  onMessage,
  onPing,
  onProfile,
  ...data
}: SquadMapData & {
  className?: string;
  /** Embedded in a scrolling page: controls stay inside the card, two-finger pan. */
  compact?: boolean;
  onMessage?: (p: MapPerson) => void;
  onPing?: (p: MapPerson) => void;
  onProfile?: (p: MapPerson) => void;
}) {
  const fetchToken = useServerFn(getMapToken);
  const token = useQuery({
    queryKey: ["map-token"],
    queryFn: () => fetchToken(),
    staleTime: 1000 * 60 * 60,
    retry: false,
  });

  // Mapbox-gl is a heavy chunk -- start downloading it as soon as this
  // component mounts instead of waiting on the token round-trip below, so
  // the two loads happen in parallel rather than as a waterfall.
  useEffect(() => {
    void import("./SquadMapInner");
  }, []);

  const hasPins =
    data.people.length > 0 || (data.places?.length ?? 0) > 0 || (data.zones?.length ?? 0) > 0;
  if (!hasPins && compact) return null;
  if (token.isLoading) return <Skeleton className={className ?? "h-80 rounded-surface"} />;
  if (token.isError || !token.data) return null;

  const fallback = <Skeleton className={className ?? "h-80 rounded-surface"} />;

  return (
    <ErrorBoundary label="squad-map" fallback={null}>
      <ClientOnly fallback={fallback}>
        <Suspense fallback={fallback}>
          <Inner
            token={token.data}
            className={className ?? "h-80 w-full"}
            {...data}
            {...(compact ? { compact } : {})}
            {...(onMessage ? { onMessage } : {})}
            {...(onPing ? { onPing } : {})}
            {...(onProfile ? { onProfile } : {})}
          />
        </Suspense>
      </ClientOnly>
    </ErrorBoundary>
  );
}

export type { MapPerson, MapPlace, MapZone } from "./types";
