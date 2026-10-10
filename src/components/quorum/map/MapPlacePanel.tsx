import { useState } from "react";
import { MapPin, X, Loader2 } from "lucide-react";
import type { MapPoi } from "@/lib/quorum/map-poi";
import { cn } from "@/lib/utils";

type Props = {
  places: MapPoi[];
  selected: MapPoi | null;
  onSelect: (p: MapPoi | null) => void;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  compact?: boolean;
};
export function MapPlacePanel({
  places,
  selected,
  onSelect,
  loading,
  error,
  onRetry,
  compact,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={cn("dark map-place-panel", compact && "map-place-panel-compact")}>
      {selected ? (
        <section aria-label="Selected place" className="map-place-detail">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{selected.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{selected.category || "Place"}</p>
            {selected.detail ? (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{selected.detail}</p>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="Close place"
            className="tap-target grid shrink-0 place-items-center"
            onClick={() => onSelect(null)}
          >
            <X className="h-4 w-4" />
          </button>
        </section>
      ) : (
        <button
          type="button"
          className="map-places-toggle tap-target"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <MapPin className="h-3.5 w-3.5" />
          )}{" "}
          Nearby places{" "}
          {places.length ? <span className="text-muted-foreground">{places.length}</span> : null}
        </button>
      )}
      {expanded && !selected ? (
        <div className="map-places-list" aria-label="Nearby places">
          {error ? (
            <button
              type="button"
              onClick={onRetry}
              className="tap-target w-full px-3 text-left text-xs"
            >
              Places unavailable · Retry
            </button>
          ) : !places.length ? (
            <p className="px-3 py-3 text-xs text-muted-foreground">
              {loading ? "Finding places…" : "Zoom in to explore nearby places."}
            </p>
          ) : null}
          {places.map((p) => (
            <button
              key={p.id}
              type="button"
              className="tap-target flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/5"
              onClick={() => {
                onSelect(p);
                setExpanded(false);
              }}
            >
              <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold">{p.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{p.category}</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
