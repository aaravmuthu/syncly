import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as v from "./schemas";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ZipLocation } from "./location";
import type { MapSearchResult, PlaceSuggestion } from "./places.server";

/**
 * Keyless ZIP → coordinates via OpenStreetMap Nominatim.
 * Signed-in only, so the server isn't an open geocoding proxy.
 */
export const geocodeZip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ zip: v.reqText(10) }))
  .handler(async ({ data }): Promise<ZipLocation | null> => {
    const { geocodeZipServer } = await import("./location.server");
    return geocodeZipServer(data.zip);
  });

/** Address / ZIP autocomplete (Mapbox, falls back to OpenStreetMap). */
export const suggestPlaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      query: v.text(300),
      addressOnly: z.boolean().optional(),
      proximity: z.object({ lat: v.lat, lon: v.lon }).nullish(),
    }),
  )
  .handler(async ({ data }): Promise<PlaceSuggestion[]> => {
    const { suggestPlacesServer } = await import("./places.server");
    return suggestPlacesServer(data.query, {
      ...(data.addressOnly != null ? { addressOnly: data.addressOnly } : {}),
      ...(data.proximity != null ? { proximity: data.proximity } : {}),
    });
  });

/** Venue / address search for the squad map, biased to where the map is looking. */
export const searchMapPlaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      query: v.text(120).optional(),
      /** Lists what's around the map instead of matching a name. */
      category: z.enum(["restaurant", "coffee", "park", "entertainment", "shopping"]).optional(),
      proximity: z.object({ lat: v.lat, lon: v.lon }).nullish(),
      limit: z.number().int().min(1).max(10).optional(),
    }),
  )
  .handler(async ({ data }): Promise<MapSearchResult[]> => {
    const { searchMapPlacesServer } = await import("./places.server");
    return searchMapPlacesServer({
      ...(data.query != null ? { query: data.query } : {}),
      ...(data.category != null ? { category: data.category } : {}),
      proximity: data.proximity ?? null,
      ...(data.limit != null ? { limit: data.limit } : {}),
    });
  });

/** Public Mapbox GL token for the browser. Empty string when maps are disabled. */
export const getMapToken = createServerFn({ method: "GET" }).handler(async (): Promise<string> => {
  const { publicMapToken } = await import("./places.server");
  return publicMapToken();
});

/** Coordinates → ZIP, used when a picked suggestion has no postcode. */
export const reverseZip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ lat: v.lat, lon: v.lon }))
  .handler(async ({ data }): Promise<string | null> => {
    const { reverseZipServer } = await import("./places.server");
    return reverseZipServer(data.lat, data.lon);
  });
