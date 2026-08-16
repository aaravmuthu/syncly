import { createServerFn } from "@tanstack/react-start";
import { isValidZip, type ZipLocation } from "./location";

/** In-memory cache — Nominatim asks for light, cached usage. */
const cache = new Map<string, ZipLocation>();

/**
 * Keyless ZIP → coordinates via OpenStreetMap Nominatim.
 * Public by design: a ZIP code is not private data.
 */
export const geocodeZip = createServerFn({ method: "POST" })
  .inputValidator((d: { zip: string }) => d)
  .handler(async ({ data }): Promise<ZipLocation | null> => {
    const zip = data.zip.trim();
    if (!isValidZip(zip)) return null;
    const hit = cache.get(zip);
    if (hit) return hit;

    try {
      const url = `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(
        zip,
      )}&country=us&format=json&limit=1&addressdetails=1`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Quorum group planner (https://quorumapp.lovable.app)",
          Accept: "application/json",
        },
      });
      if (!res.ok) return null;
      const json = (await res.json()) as {
        lat: string;
        lon: string;
        display_name?: string;
        address?: { city?: string; town?: string; village?: string; state?: string };
      }[];
      const first = json[0];
      if (!first) return null;
      const a = first.address ?? {};
      const city = a.city ?? a.town ?? a.village ?? first.display_name?.split(",")[0] ?? zip;
      const label = a.state ? `${city}, ${a.state}` : city;
      const loc: ZipLocation = {
        zip,
        lat: Number(first.lat),
        lon: Number(first.lon),
        label,
      };
      if (!Number.isFinite(loc.lat) || !Number.isFinite(loc.lon)) return null;
      cache.set(zip, loc);
      return loc;
    } catch {
      return null;
    }
  });
