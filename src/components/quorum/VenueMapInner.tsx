import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

export type MapVenue = {
  id: string;
  title: string;
  lat: number;
  lon: number;
  rank?: number;
  selected?: boolean;
  /** Chooses the pin icon: food spots vs entertainment/activity spots. */
  kind?: "food" | "activity" | "home" | "fair";
};

/** Browser-only. Rendered lazily behind <ClientOnly> — never imported by SSR. */
export default function VenueMapInner({
  token,
  venues,
  onSelect,
}: {
  token: string;
  venues: MapVenue[];
  onSelect?: (id: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
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
    return () => {
      alive = false;
      setReady(false);
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    const m = map.current;
    if (!m || !ready || venues.length === 0) return;

    const markers: mapboxgl.Marker[] = [];
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
            : v.kind === "fair"
              ? " q-map-pin-fair"
              : v.kind === "activity"
                ? " q-map-pin-activity"
                : " q-map-pin-food");
        const icon =
          v.kind === "home" ? "🏠" : v.kind === "fair" ? "🎯" : v.kind === "activity" ? "🎟️" : "🍽️";
        el.innerHTML =
          `<span class="q-map-pin-icon">${icon}</span>` +
          (v.kind === "home" || v.kind === "fair"
            ? ""
            : `<span class="q-map-pin-rank">${v.rank ?? "•"}</span>`);
        el.setAttribute("aria-label", v.title);
        el.addEventListener("click", () => onSelect?.(v.id));
        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([v.lon, v.lat])
          .setPopup(new mapboxgl.Popup({ offset: 18, closeButton: false }).setText(v.title))
          .addTo(m);
        markers.push(marker);
        bounds.extend([v.lon, v.lat]);
      });

      if (!bounds.isEmpty()) m.fitBounds(bounds, { padding: 56, maxZoom: 14, duration: 400 });
    } catch {
      /* a bad coordinate must never take the page down */
    }
    return () => markers.forEach((mk) => mk.remove());
  }, [venues, onSelect, ready]);


  return <div ref={container} className="h-64 w-full rounded-2xl sm:h-80" />;
}
