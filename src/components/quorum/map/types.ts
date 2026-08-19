/** Browser-safe shapes shared by the map engine and its SSR-rendered callers. */

export type MapPerson = {
  id: string;
  name: string;
  initials: string;
  avatarUrl?: string | null;
  lat: number;
  lon: number;
  /** Degrees clockwise from north; renders the movement vector arrow. */
  heading?: number | null;
  speedMph?: number | null;
  motion?: string | null;
  batteryPct?: number | null;
  /** Drives the halo colour: emerald / amber / zinc. */
  state?: "arrived" | "enroute" | "idle";
  address?: string | null;
  etaMinutes?: number | null;
  phone?: string | null;
  lastSeen?: string | null;
};

export type MapZone = {
  id: string;
  label: string;
  lat: number;
  lon: number;
  radiusM: number;
};

export type MapPlace = {
  id: string;
  title: string;
  subtitle?: string | null;
  lat: number;
  lon: number;
  /** The active plan venue: gets isochrone rings and route vectors. */
  active?: boolean;
};

export type SquadMapData = {
  people: MapPerson[];
  zones?: MapZone[];
  places?: MapPlace[];
  /** Renders the pulsing fair-midpoint marker when true (default). */
  showMidpoint?: boolean;
};

/** Geographic midpoint on the unit sphere — correct across longitudes. */
export function midpointOf(points: { lat: number; lon: number }[]) {
  if (points.length === 0) return null;
  let x = 0;
  let y = 0;
  let z = 0;
  for (const p of points) {
    const la = (p.lat * Math.PI) / 180;
    const lo = (p.lon * Math.PI) / 180;
    x += Math.cos(la) * Math.cos(lo);
    y += Math.cos(la) * Math.sin(lo);
    z += Math.sin(la);
  }
  x /= points.length;
  y /= points.length;
  z /= points.length;
  return {
    lat: (Math.atan2(z, Math.sqrt(x * x + y * y)) * 180) / Math.PI,
    lon: (Math.atan2(y, x) * 180) / Math.PI,
  };
}

/** Approximate circle polygon used for geofences and drive-time rings. */
export function circlePolygon(lat: number, lon: number, radiusM: number, steps = 64) {
  const coords: [number, number][] = [];
  const dx = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180) || 1);
  const dy = radiusM / 110_540;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 2 * Math.PI;
    coords.push([lon + dx * Math.cos(t), lat + dy * Math.sin(t)]);
  }
  return coords;
}
