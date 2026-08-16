import { createServerFn } from "@tanstack/react-start";
import type { ZipLocation } from "./location";

/**
 * Keyless ZIP → coordinates via OpenStreetMap Nominatim.
 * Public by design: a ZIP code is not private data.
 */
export const geocodeZip = createServerFn({ method: "POST" })
  .inputValidator((d: { zip: string }) => d)
  .handler(async ({ data }): Promise<ZipLocation | null> => {
    const { geocodeZipServer } = await import("./location.server");
    return geocodeZipServer(data.zip);
  });

/** Address / ZIP autocomplete (Mapbox, falls back to OpenStreetMap). */
export const suggestPlaces = createServerFn({ method: "POST" })
  .inputValidator((d: { query: string }) => d)
  .handler(async ({ data }): Promise<PlaceSuggestion[]> => {
    const { suggestPlacesServer } = await import("./places.server");
    return suggestPlacesServer(data.query);
  });

/** Public Mapbox GL token for the browser. Empty string when maps are disabled. */
export const getMapToken = createServerFn({ method: "GET" }).handler(async (): Promise<string> => {
  const { publicMapToken } = await import("./places.server");
  return publicMapToken();
});
