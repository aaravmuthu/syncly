/**
 * Keyless location layer.
 *
 * Geocoding uses the free OpenStreetMap Nominatim endpoint (see
 * `location.functions.ts`). Distances are computed locally with the Haversine
 * formula — no maps key, no billing, no third-party SDK.
 */

import type { PlanCategory } from "./types";

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
