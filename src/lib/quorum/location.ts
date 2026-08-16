/**
 * Keyless location layer.
 *
 * Geocoding uses the free OpenStreetMap Nominatim endpoint (see
 * `location.functions.ts`). Distances are computed locally with the Haversine
 * formula — no maps key, no billing, no third-party SDK.
 */

import { OPTION_CATALOG } from "./catalog";
import type { OptionSeed, PlanCategory } from "./types";

export type GeoPoint = { lat: number; lon: number };

export type ZipLocation = GeoPoint & {
  zip: string;
  label: string; // "Frisco, Texas"
};

export const EARTH_RADIUS_MILES = 3958.7613;

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in miles between two coordinates. */
export function haversineMiles(a: GeoPoint, b: GeoPoint): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Rough urban/suburban drive time. Keeps recommendations honest, not optimistic. */
export function milesToDriveMinutes(miles: number): number {
  return Math.max(3, Math.round(miles * 2.1 + 3));
}

export function isValidZip(zip: string): boolean {
  return /^\d{5}$/.test(zip.trim());
}

export function normalizeZip(zip: string | null | undefined): string | null {
  const z = (zip ?? "").trim();
  return isValidZip(z) ? z : null;
}

/** Deterministic 0..1 hash so the same venue always lands in the same spot. */
function hash01(seed: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

const STREETS = [
  "Main St",
  "Preston Rd",
  "Legacy Dr",
  "Oak Ave",
  "Riverside Pkwy",
  "Market Sq",
  "Elm St",
  "Northgate Blvd",
  "Cedar Ln",
  "Commerce St",
];

export function priceLevelFor(costMax: number): "$" | "$$" | "$$$" | "$$$$" {
  if (costMax <= 15) return "$";
  if (costMax <= 35) return "$$";
  if (costMax <= 80) return "$$$";
  return "$$$$";
}

export type VenueQuery = {
  origin: ZipLocation;
  category: PlanCategory;
  /** Hard travel radius in miles — the tightest radius across the group. */
  maxRadiusMiles?: number | null;
  /** Tightest hard budget cap across the group. */
  maxBudget?: number | null;
  limit?: number;
};

/**
 * Local venue query layer. Anchors the seeded catalog around the caller's ZIP
 * code and returns real, distance-aware venue metadata.
 */
export function queryVenuesNear(q: VenueQuery): OptionSeed[] {
  const { origin } = q;
  const city = origin.label.split(",")[0]?.trim() || "Nearby";

  const venues = OPTION_CATALOG.filter(
    (o) => o.category.includes(q.category) || OPTION_CATALOG.length < 4,
  );
  const pool = venues.length >= 4 ? venues : OPTION_CATALOG;

  const placed = pool.map((o) => {
    // Spread each venue on a deterministic bearing/distance around the ZIP.
    const bearing = hash01(o.key + origin.zip, 7) * Math.PI * 2;
    const spread = 0.6 + hash01(o.key, 13) * 11.5; // 0.6 – 12.1 miles
    const miles = o.category.includes("trip") || o.category.includes("roadtrip") ? spread * 9 : spread;
    const dLat = (miles / 69) * Math.cos(bearing);
    const dLon = (miles / (69 * Math.cos(rad(origin.lat)) || 69)) * Math.sin(bearing);
    const point = { lat: origin.lat + dLat, lon: origin.lon + dLon };
    const distanceMiles = Math.round(haversineMiles(origin, point) * 10) / 10;

    const venue: OptionSeed = {
      ...o,
      lat: point.lat,
      lon: point.lon,
      distanceMiles,
      travelMinutes: milesToDriveMinutes(distanceMiles),
      address: `${100 + Math.round(hash01(o.key, 29) * 8800)} ${
        STREETS[Math.floor(hash01(o.key, 31) * STREETS.length)]!
      }, ${city}`,
      priceLevel: priceLevelFor(o.costMax),
      rating: Math.round((3.7 + hash01(o.key, 41) * 1.2) * 10) / 10,
      location: `${city} · ${distanceMiles} mi`,
    };
    return venue;
  });

  const filtered = placed.filter((v) => {
    if (q.maxRadiusMiles != null && v.distanceMiles != null && v.distanceMiles > q.maxRadiusMiles) {
      return false;
    }
    if (q.maxBudget != null && v.costMin > q.maxBudget) return false;
    return true;
  });

  const result = (filtered.length ? filtered : placed).sort(
    (a, b) => (a.distanceMiles ?? 0) - (b.distanceMiles ?? 0),
  );
  return result.slice(0, q.limit ?? 12);
}
