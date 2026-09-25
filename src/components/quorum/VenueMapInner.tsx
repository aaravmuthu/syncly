import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Skeleton } from "@/components/quorum/ui";
import { cn } from "@/lib/utils";
import { pinSpan } from "@/lib/safe-dom";

export type MapVenue = {
  id: string;
  title: string;
  lat: number;
  lon: number;
  rank?: number;
  selected?: boolean;
  /** Chooses the pin icon: food spots vs entertainment/activity spots. */
  kind?: "food" | "activity" | "home" | "fair" | "person" | "zone";
  /** Short label rendered inside person pins (initials). */
  initials?: string;
};

/** Browser-only. Rendered lazily behind <ClientOnly> — never imported by SSR. */
export default function VenueMapInner({
  token,
  venues,
  onSelect,
  className,
}: {
  token: string;
  venues: MapVenue[];
  onSelect?: (id: string) => void;
  className?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<Map<string, { marker: mapboxgl.Marker; el: HTMLButtonElement }>>(
    new Map(),
  );
  const idKey = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  // Only the first venue seeds the initial centre; keeping it out of the deps
  // stops the map from being torn down on every re-render.
  const seed = venues[0];

  useEffect(() => {
    if (!container.current || !token || !seed) return;
    container.current.innerHTML = "";
    let alive = true;
    try {
      mapboxgl.accessToken = token;
      const m = new mapboxgl.Map({
        container: container.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [seed.lon, seed.lat],
        zoom: 11,
        attributionControl: false,
        cooperativeGestures: true,
      });
      m.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
      map.current = m;
      m.on("load", () => {
        if (alive) setReady(true);
      });
    } catch {
      map.current = null;
    }
    // The marker map is created once and never reassigned, so the cleanup
    // can hold the same instance the effect saw.
    const liveMarkers = markers.current;
    return () => {
      alive = false;
      setReady(false);
      liveMarkers.forEach(({ marker }) => marker.remove());
      liveMarkers.clear();
      idKey.current = null;
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Rebuilds markers only when the set of venues actually changes, so
  // selecting one spot never tears down or hides the rest of the pins.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || venues.length === 0) return;
    const key = venues.map((v) => v.id).join("|");
    if (key === idKey.current) return;
    idKey.current = key;

    markers.current.forEach(({ marker }) => marker.remove());
    markers.current.clear();

    try {
      const bounds = new mapboxgl.LngLatBounds();

      venues.forEach((v) => {
        if (!Number.isFinite(v.lat) || !Number.isFinite(v.lon)) return;
        const el = document.createElement("button");
        el.type = "button";
        el.className =
          "q-map-pin" +
          (v.selected ? " q-map-pin-active" : "") +
          (v.kind === "home"
            ? " q-map-pin-home"
            : v.kind === "person"
              ? " q-map-pin-person"
              : v.kind === "zone"
                ? " q-map-pin-zone"
                : v.kind === "fair"
                  ? " q-map-pin-fair"
                  : v.kind === "activity"
                    ? " q-map-pin-activity"
                    : " q-map-pin-food");
        const icon =
          v.kind === "home"
            ? "\u2302"
            : v.kind === "zone"
              ? "\u25CE"
              : v.kind === "fair"
                ? "\u25C9"
                : v.kind === "activity"
                  ? "\u2726"
                  : "\u25CF";
        // Text only -- initials come from user display names, so never innerHTML.
        if (v.kind === "person") {
          el.append(pinSpan("q-map-pin-pulse"), pinSpan("q-map-pin-initials", v.initials ?? "?"));
        } else {
          el.append(pinSpan("q-map-pin-icon", icon));
          if (v.kind !== "home" && v.kind !== "fair" && v.kind !== "zone") {
            el.append(pinSpan("q-map-pin-rank", String(v.rank ?? "\u2022")));
          }
        }
        el.setAttribute("aria-label", v.title);
        el.addEventListener("click", () => onSelect?.(v.id));
        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([v.lon, v.lat])
          .setPopup(new mapboxgl.Popup({ offset: 18, closeButton: false }).setText(v.title))
          .addTo(m);
        markers.current.set(v.id, { marker, el });
        bounds.extend([v.lon, v.lat]);
      });

      if (!bounds.isEmpty()) m.fitBounds(bounds, { padding: 56, maxZoom: 14, duration: 400 });
    } catch {
      /* a bad coordinate must never take the page down */
    }
  }, [venues, onSelect, ready]);

  // Highlights the selected pin and gently pans to it, without rebuilding
  // or hiding the rest of the markers.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const selectedVenue = venues.find((v) => v.selected);
    markers.current.forEach(({ el }, id) => {
      el.classList.toggle("q-map-pin-active", id === selectedVenue?.id);
    });
    if (selectedVenue) {
      m.easeTo({ center: [selectedVenue.lon, selectedVenue.lat], duration: 400 });
    }
  }, [venues, ready]);

  const shellClass = className ?? "h-64 w-full rounded-2xl sm:h-80";
  return (
    <div className={cn("relative overflow-hidden", shellClass)}>
      <div ref={container} className="h-full w-full" />
      {/* Mapbox's own style/tile load takes a beat after mount — cover the
          empty container so that gap doesn't read as broken/frozen. */}
      {!ready ? (
        <div className="absolute inset-0">
          <Skeleton className="h-full w-full rounded-none" />
        </div>
      ) : null}
    </div>
  );
}
