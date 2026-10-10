import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { nearbyMapPlaces } from "@/lib/quorum/location.functions";
import {
  mergeMapPois,
  samePlace,
  type MapPoi,
  type PoiBounds,
  type PoiCategory,
} from "@/lib/quorum/map-poi";

const EMPTY: MapPoi[] = [];
/** GPU-rendered, collision-aware POIs. Only squad / curated pins remain DOM markers. */
export function useMapPois(
  map: React.RefObject<mapboxgl.Map | null>,
  ready: boolean,
  category?: PoiCategory,
  excluded: MapPoi[] = EMPTY,
  extra: MapPoi[] = EMPTY,
  enabled = true,
) {
  const request = useServerFn(nearbyMapPlaces);
  const [view, setView] = useState<{ bounds: PoiBounds; zoom: number } | null>(null);
  const [selected, setSelected] = useState<MapPoi | null>(null);
  const [active, setActive] = useState(true);
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const b = m.getBounds();
        if (!b) return;
        // Round outward: overlapping pans reuse a bounded five-minute cache.
        const bounds = {
          west: Math.max(-180, Math.floor(b.getWest() * 100) / 100),
          south: Math.max(-90, Math.floor(b.getSouth() * 100) / 100),
          east: Math.min(180, Math.ceil(b.getEast() * 100) / 100),
          north: Math.min(90, Math.ceil(b.getNorth() * 100) / 100),
        };
        const zoom = Math.floor(m.getZoom());
        setView((prev) =>
          JSON.stringify(prev) === JSON.stringify({ bounds, zoom }) ? prev : { bounds, zoom },
        );
      }, 350);
    };
    const visibility = () =>
      setActive(
        document.visibilityState !== "hidden" && m.getContainer().getClientRects().length > 0,
      );
    m.on("moveend", update);
    m.on("resize", update);
    document.addEventListener("visibilitychange", visibility);
    const onTab = () => requestAnimationFrame(visibility);
    window.addEventListener("syncly:tab-visible", onTab);
    update();
    visibility();
    return () => {
      clearTimeout(timer);
      m.off("moveend", update);
      m.off("resize", update);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("syncly:tab-visible", onTab);
    };
  }, [map, ready]);
  const query = useQuery({
    queryKey: ["map-pois", view, category],
    queryFn: ({ signal }) =>
      request({ data: { ...view!, ...(category ? { category } : {}) }, signal }),
    enabled: enabled && ready && active && !!view && view.zoom >= 10,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchInterval: enabled && active ? 5 * 60 * 1000 : false,
    retry: 1,
    placeholderData: keepPreviousData,
  });
  const pois = useMemo(
    () =>
      mergeMapPois([
        ...extra,
        ...(enabled && view && view.zoom >= 10 ? (query.data ?? EMPTY) : EMPTY),
      ])
        .filter((p) => !excluded.some((other) => samePlace(p, other)))
        .filter(
          (p) =>
            extra.some((e) => e.id === p.id) ||
            !view ||
            (p.lon >= view.bounds.west &&
              p.lon <= view.bounds.east &&
              p.lat >= view.bounds.south &&
              p.lat <= view.bounds.north),
        ),
    [extra, query.data, excluded, view, enabled],
  );
  const latest = useRef(pois);
  latest.current = pois;
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    m.addSource("syncly-pois", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
      cluster: true,
      clusterRadius: 38,
      clusterMaxZoom: 14,
    });
    m.addLayer({
      id: "syncly-poi-clusters",
      type: "circle",
      source: "syncly-pois",
      filter: ["has", "point_count"],
      paint: {
        "circle-color": "#243b38",
        "circle-radius": ["step", ["get", "point_count"], 15, 20, 19],
        "circle-stroke-color": "#a7c9bd",
        "circle-stroke-width": 1.5,
      },
    });
    m.addLayer({
      id: "syncly-poi-count",
      type: "symbol",
      source: "syncly-pois",
      filter: ["has", "point_count"],
      layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 12 },
      paint: { "text-color": "#ffffff" },
    });
    m.addLayer({
      id: "syncly-poi-points",
      type: "circle",
      source: "syncly-pois",
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 3, 16, 5],
        "circle-color": "#c3d8ce",
        "circle-stroke-color": "#162622",
        "circle-stroke-width": 2,
      },
    });
    m.addLayer({
      id: "syncly-poi-labels",
      type: "symbol",
      source: "syncly-pois",
      filter: ["!", ["has", "point_count"]],
      minzoom: 13,
      layout: {
        "text-field": ["get", "name"],
        "text-size": 11,
        "text-anchor": "top",
        "text-offset": [0, 0.9],
        "text-max-width": 11,
        "symbol-sort-key": ["-", 0, ["get", "importance"]],
      },
      paint: { "text-color": "#d5e3dc", "text-halo-color": "#121c19", "text-halo-width": 1.5 },
    });
    m.addLayer({
      id: "syncly-poi-hit",
      type: "circle",
      source: "syncly-pois",
      paint: { "circle-radius": 18, "circle-opacity": 0 },
    });
    m.addSource("syncly-poi-selected", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    m.addLayer({
      id: "syncly-poi-selected",
      type: "circle",
      source: "syncly-poi-selected",
      paint: {
        "circle-radius": 9,
        "circle-color": "#55deb0",
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 3,
      },
    });
    const pick = (e: mapboxgl.MapMouseEvent) => {
      const f = m.queryRenderedFeatures(e.point, {
        layers: ["syncly-poi-hit"],
      })[0] as unknown as
        | {
            geometry: { type: string; coordinates: [number, number] };
            properties: Record<string, unknown>;
          }
        | undefined;
      if (!f || f.geometry.type !== "Point") return;
      if (f.properties?.["cluster"]) {
        const source = m.getSource("syncly-pois") as mapboxgl.GeoJSONSource;
        source.getClusterExpansionZoom(Number(f.properties["cluster_id"]), (err, zoom) => {
          if (!err && zoom != null && map.current === m)
            m.easeTo({
              center:
                f.geometry.type === "Point"
                  ? (f.geometry.coordinates as [number, number])
                  : m.getCenter(),
              zoom,
              duration: 350,
            });
        });
      } else {
        const p = latest.current.find((p) => p.id === f.properties?.["id"]);
        if (p) setSelected(p);
      }
    };
    const enter = () => {
      m.getCanvas().style.cursor = "pointer";
    };
    const leave = () => {
      m.getCanvas().style.cursor = "";
    };
    m.on("click", "syncly-poi-hit", pick);
    for (const id of ["syncly-poi-hit"]) {
      m.on("mouseenter", id, enter);
      m.on("mouseleave", id, leave);
    }
    return () => {
      for (const id of ["syncly-poi-hit"]) {
        m.off("click", id, pick);
        m.off("mouseenter", id, enter);
        m.off("mouseleave", id, leave);
      }
      if (m.getStyle()) {
        for (const id of [
          "syncly-poi-selected",
          "syncly-poi-hit",
          "syncly-poi-labels",
          "syncly-poi-points",
          "syncly-poi-count",
          "syncly-poi-clusters",
        ])
          if (m.getLayer(id)) m.removeLayer(id);
        for (const id of ["syncly-poi-selected", "syncly-pois"])
          if (m.getSource(id)) m.removeSource(id);
      }
    };
  }, [map, ready]);
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    // Prevent the basemap's own POI labels duplicating provider places; retain them on failures.
    if (m.getLayer("poi-label"))
      m.setLayoutProperty("poi-label", "visibility", pois.length ? "none" : "visible");
    (m.getSource("syncly-pois") as mapboxgl.GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: pois.map((p) => ({
        type: "Feature",
        properties: { id: p.id, name: p.name, importance: p.importance ?? 0 },
        geometry: { type: "Point", coordinates: [p.lon, p.lat] },
      })),
    });
  }, [map, ready, pois]);
  useEffect(() => {
    (map.current?.getSource("syncly-poi-selected") as mapboxgl.GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: selected
        ? [
            {
              type: "Feature",
              properties: {},
              geometry: { type: "Point", coordinates: [selected.lon, selected.lat] },
            },
          ]
        : [],
    });
  }, [map, ready, selected]);
  return {
    pois,
    selected,
    setSelected,
    loading: query.isFetching,
    error: query.isError,
    retry: () => void query.refetch(),
  };
}
