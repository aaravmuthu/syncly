import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  Battery,
  BatteryLow,
  Building2,
  Car,
  Crosshair,
  MapPin,
  MessageCircle,
  Navigation,
  PersonStanding,
  Route as RouteIcon,
  Search,
  Shield,
  X,
} from "lucide-react";
import { circlePolygon, midpointOf, type MapPerson, type SquadMapData } from "./types";
import { cn } from "@/lib/utils";

type Props = SquadMapData & {
  token: string;
  className?: string;
  onMessage?: (person: MapPerson) => void;
  onPing?: (person: MapPerson) => void;
};

const RING_MILES = [3.5, 7, 10.5]; // 5 / 10 / 15 minute drive at ~42 mph
const M_PER_MILE = 1609.34;

const haloFor = (state: MapPerson["state"]) =>
  state === "arrived" ? "#34d399" : state === "enroute" ? "#fbbf24" : "#a1a1aa";

type AnyFeature = {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: { type: "Polygon" | "LineString"; coordinates: unknown };
};

function fc(features: AnyFeature[]) {
  return { type: "FeatureCollection", features } as unknown as Parameters<
    mapboxgl.GeoJSONSource["setData"]
  >[0];
}

/** Browser-only Apple-Maps-style engine. Rendered lazily behind <ClientOnly>. */
export default function SquadMapInner({
  token,
  people,
  zones = [],
  places = [],
  showMidpoint = true,
  className,
  onMessage,
  onPing,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [tilted, setTilted] = useState(false);
  const [showRoutes, setShowRoutes] = useState(true);
  const [showZones, setShowZones] = useState(true);

  const venue = useMemo(() => places.find((p) => p.active) ?? places[0] ?? null, [places]);
  const mid = useMemo(
    () => (showMidpoint && people.length > 1 ? midpointOf(people) : null),
    [people, showMidpoint],
  );

  const visiblePeople = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;
    return people.filter((p) => p.name.toLowerCase().includes(q));
  }, [people, query]);
  const visiblePlaces = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return places;
    return places.filter((p) => p.title.toLowerCase().includes(q));
  }, [places, query]);

  const seed = people[0] ?? places[0] ?? zones[0] ?? null;

  // ---- map bootstrap -------------------------------------------------------
  useEffect(() => {
    if (!container.current || !token || !seed) return;
    let alive = true;
    try {
      mapboxgl.accessToken = token;
      const m = new mapboxgl.Map({
        container: container.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [seed.lon, seed.lat],
        zoom: 12,
        pitch: 0,
        attributionControl: false,
        cooperativeGestures: true,
      });
      map.current = m;
      m.on("load", () => {
        if (!alive) return;
        try {
          m.addLayer({
            id: "q-3d-buildings",
            source: "composite",
            "source-layer": "building",
            filter: ["==", "extrude", "true"],
            type: "fill-extrusion",
            minzoom: 14,
            paint: {
              "fill-extrusion-color": "#1b1f24",
              "fill-extrusion-height": ["get", "height"],
              "fill-extrusion-base": ["get", "min_height"],
              "fill-extrusion-opacity": 0.65,
            },
          });
        } catch {
          /* style without composite source */
        }
        for (const id of ["q-iso", "q-zones", "q-routes"]) {
          m.addSource(id, { type: "geojson", data: fc([]) });
        }
        m.addLayer({
          id: "q-iso-fill",
          type: "fill",
          source: "q-iso",
          paint: { "fill-color": "#22d3ee", "fill-opacity": 0.05 },
        });
        m.addLayer({
          id: "q-iso-line",
          type: "line",
          source: "q-iso",
          paint: { "line-color": "#22d3ee", "line-opacity": 0.35, "line-width": 1, "line-dasharray": [2, 3] },
        });
        m.addLayer({
          id: "q-zones-fill",
          type: "fill",
          source: "q-zones",
          paint: { "fill-color": "#34d399", "fill-opacity": 0.08 },
        });
        m.addLayer({
          id: "q-zones-line",
          type: "line",
          source: "q-zones",
          paint: { "line-color": "#34d399", "line-opacity": 0.45, "line-width": 1.5 },
        });
        m.addLayer({
          id: "q-routes-line",
          type: "line",
          source: "q-routes",
          layout: { "line-cap": "round" },
          paint: {
            "line-color": "#34d399",
            "line-opacity": 0.5,
            "line-width": 2.5,
            "line-blur": 1.5,
          },
        });
        setReady(true);
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

  // ---- geometry layers -----------------------------------------------------
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const src = (id: string) => m.getSource(id) as mapboxgl.GeoJSONSource | undefined;

    src("q-zones")?.setData(
      fc(
        (showZones ? zones : []).map((z) => ({
          type: "Feature" as const,
          properties: { label: z.label },
          geometry: { type: "Polygon", coordinates: [circlePolygon(z.lat, z.lon, z.radiusM)] },
        })),
      ),
    );

    src("q-iso")?.setData(
      fc(
        venue
          ? RING_MILES.map((mi) => ({
              type: "Feature" as const,
              properties: { miles: mi },
              geometry: {
                type: "Polygon" as const,
                coordinates: [circlePolygon(venue.lat, venue.lon, mi * M_PER_MILE, 96)],
              },
            }))
          : [],
      ),
    );

    src("q-routes")?.setData(
      fc(
        showRoutes && venue
          ? visiblePeople.map((p) => ({
              type: "Feature" as const,
              properties: { id: p.id },
              geometry: {
                type: "LineString" as const,
                coordinates: [
                  [p.lon, p.lat],
                  [venue.lon, venue.lat],
                ],
              },
            }))
          : [],
      ),
    );
  }, [ready, zones, venue, visiblePeople, showRoutes, showZones]);

  // ---- markers -------------------------------------------------------------
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const markers: mapboxgl.Marker[] = [];
    const bounds = new mapboxgl.LngLatBounds();

    const add = (el: HTMLElement, lat: number, lon: number) => {
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
      markers.push(new mapboxgl.Marker({ element: el }).setLngLat([lon, lat]).addTo(m));
      bounds.extend([lon, lat]);
    };

    for (const p of visiblePeople) {
      const halo = haloFor(p.state);
      const el = document.createElement("button");
      el.type = "button";
      el.className = "q-avatar-pin";
      el.style.setProperty("--halo", halo);
      el.setAttribute("aria-label", p.name);
      const speed =
        p.speedMph && p.speedMph >= 2 ? `${Math.round(p.speedMph)} mph` : (p.motion ?? "Idle");
      el.innerHTML = `
        <span class="q-avatar-pulse"></span>
        <span class="q-avatar-face">${
          p.avatarUrl
            ? `<img src="${p.avatarUrl}" alt="" />`
            : `<span class="q-avatar-initials">${p.initials}</span>`
        }</span>
        ${
          p.heading != null
            ? `<span class="q-avatar-heading" style="transform:rotate(${p.heading}deg)"></span>`
            : ""
        }
        <span class="q-avatar-meta">${speed}${
          p.batteryPct != null ? ` · ${p.batteryPct}%` : ""
        }</span>`;
      el.addEventListener("click", () => {
        setSelected(p.id);
        m.easeTo({ center: [p.lon, p.lat], zoom: 15, duration: 900, essential: true });
      });
      add(el, p.lat, p.lon);
    }

    for (const pl of visiblePlaces) {
      const el = document.createElement("button");
      el.type = "button";
      el.className = cn("q-place-pin", pl.active && "q-place-pin-active");
      el.setAttribute("aria-label", pl.title);
      el.innerHTML = `<span class="q-place-dot"></span><span class="q-place-label">${pl.title}</span>`;
      el.addEventListener("click", () =>
        m.easeTo({ center: [pl.lon, pl.lat], zoom: 15, duration: 900, essential: true }),
      );
      add(el, pl.lat, pl.lon);
    }

    if (mid) {
      const el = document.createElement("div");
      el.className = "q-mid-pin";
      el.innerHTML = `<span class="q-mid-ring"></span><span class="q-mid-ring q-mid-ring-2"></span><span class="q-mid-core"></span><span class="q-mid-label">Fair midpoint</span>`;
      add(el, mid.lat, mid.lon);
    }

    if (!bounds.isEmpty()) {
      m.fitBounds(bounds, { padding: 80, maxZoom: 14, duration: 600 });
    }
    return () => markers.forEach((mk) => mk.remove());
  }, [ready, visiblePeople, visiblePlaces, mid]);

  const recenter = useCallback(() => {
    const m = map.current;
    if (!m) return;
    const b = new mapboxgl.LngLatBounds();
    [...visiblePeople, ...visiblePlaces].forEach((p) => b.extend([p.lon, p.lat]));
    if (!b.isEmpty()) m.fitBounds(b, { padding: 80, maxZoom: 14, duration: 800 });
  }, [visiblePeople, visiblePlaces]);

  const toggleTilt = useCallback(() => {
    const m = map.current;
    if (!m) return;
    const next = !tilted;
    setTilted(next);
    m.easeTo({ pitch: next ? 55 : 0, bearing: next ? -20 : 0, zoom: next ? 15 : 13, duration: 900 });
  }, [tilted]);

  const focus = people.find((p) => p.id === selected) ?? null;

  return (
    <div className={cn("relative overflow-hidden rounded-[28px]", className)}>
      <div ref={container} className="h-full w-full" />

      {/* Top floating search pill */}
      <div className="pointer-events-none absolute inset-x-3 top-3 flex justify-center">
        <label className="pointer-events-auto flex w-full max-w-sm items-center gap-2 rounded-full border border-white/10 bg-zinc-900/60 px-4 py-2 backdrop-blur-2xl">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search squad or venues"
            aria-label="Search squad or venues"
            className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground"
          />
          {query ? (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear search">
              <X className="h-4 w-4 text-muted-foreground" aria-hidden />
            </button>
          ) : null}
        </label>
      </div>

      {/* Right-side quick actions */}
      <div className="absolute right-3 top-16 flex flex-col gap-2">
        <HudButton label="Recenter camera" onClick={recenter} icon={Crosshair} />
        <HudButton label="3D view tilt" onClick={toggleTilt} icon={Building2} active={tilted} />
        <HudButton
          label="Toggle routes"
          onClick={() => setShowRoutes((v) => !v)}
          icon={RouteIcon}
          active={showRoutes}
        />
        <HudButton
          label="Toggle safe zones"
          onClick={() => setShowZones((v) => !v)}
          icon={Shield}
          active={showZones}
        />
      </div>

      {/* Tap-to-focus mini card */}
      {focus ? (
        <div className="absolute inset-x-3 bottom-3 mx-auto max-w-sm rounded-[24px] border border-white/10 bg-zinc-900/70 p-4 shadow-2xl backdrop-blur-2xl">
          <div className="flex items-start gap-3">
            <span
              className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: haloFor(focus.state) }}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold tracking-tight">{focus.name}</p>
              <p className="truncate text-xs font-medium text-muted-foreground">
                {focus.address ?? focus.motion ?? "Location shared"}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                <Chip icon={focus.speedMph && focus.speedMph >= 12 ? Car : PersonStanding}>
                  {focus.speedMph && focus.speedMph >= 2
                    ? `${Math.round(focus.speedMph)} mph`
                    : (focus.motion ?? "Stationary")}
                </Chip>
                {focus.batteryPct != null ? (
                  <Chip icon={focus.batteryPct <= 20 ? BatteryLow : Battery}>
                    {focus.batteryPct}%
                  </Chip>
                ) : null}
                {focus.etaMinutes != null ? (
                  <Chip icon={Navigation}>{focus.etaMinutes} min out</Chip>
                ) : null}
              </div>
            </div>
            <button type="button" onClick={() => setSelected(null)} aria-label="Close">
              <X className="h-4 w-4 text-muted-foreground" aria-hidden />
            </button>
          </div>
          <div className="mt-3 flex gap-2">
            <MiniAction icon={MessageCircle} onClick={() => onMessage?.(focus)}>
              Message
            </MiniAction>
            <MiniAction icon={MapPin} onClick={() => onPing?.(focus)}>
              Ping location
            </MiniAction>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function HudButton({
  label,
  icon: Icon,
  onClick,
  active,
}: {
  label: string;
  icon: typeof Crosshair;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active ?? undefined}
      className={cn(
        "grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-zinc-900/60 backdrop-blur-2xl transition-transform active:scale-95",
        active ? "text-primary" : "text-foreground/80",
      )}
    >
      <Icon className="h-4.5 w-4.5" aria-hidden />
    </button>
  );
}

function Chip({ icon: Icon, children }: { icon: typeof Car; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5">
      <Icon className="h-3 w-3" aria-hidden />
      {children}
    </span>
  );
}

function MiniAction({
  icon: Icon,
  onClick,
  children,
}: {
  icon: typeof Car;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-white/10 bg-white/5 py-2 text-xs font-semibold transition-transform active:scale-95"
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {children}
    </button>
  );
}
