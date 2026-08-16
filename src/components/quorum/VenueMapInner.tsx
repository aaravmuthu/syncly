import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

export type MapVenue = {
  id: string;
  title: string;
  lat: number;
  lon: number;
  rank?: number;
  selected?: boolean;
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

  useEffect(() => {
    if (!container.current || map.current || !token || venues.length === 0) return;
    try {
      mapboxgl.accessToken = token;
      const m = new mapboxgl.Map({
        container: container.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [venues[0]!.lon, venues[0]!.lat],
        zoom: 11,
        attributionControl: false,
        cooperativeGestures: true,
      });
      m.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
      map.current = m;
    } catch {
      map.current = null;
    }
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [token, venues]);

  useEffect(() => {
    const m = map.current;
    if (!m || venues.length === 0) return;
    const markers: mapboxgl.Marker[] = [];
    try {
      const bounds = new mapboxgl.LngLatBounds();

      venues.forEach((v) => {
        if (!Number.isFinite(v.lat) || !Number.isFinite(v.lon)) return;
        const el = document.createElement("button");
        el.type = "button";
        el.className = "q-map-pin" + (v.selected ? " q-map-pin-active" : "");
        el.textContent = String(v.rank ?? "•");
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
  }, [venues, onSelect]);


  return <div ref={container} className="h-64 w-full rounded-2xl sm:h-80" />;
}
