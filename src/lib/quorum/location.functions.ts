import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as v from "./schemas";
import type { ZipLocation } from "./location";
import type { PlaceSuggestion } from "./places.server";

/**
 * Keyless ZIP → coordinates via OpenStreetMap Nominatim.
 * Public by design: a ZIP code is not private data.
 */
export const geocodeZip = createServerFn({ method: "POST" })
  .inputValidator(z.object({ zip: v.reqText(10) }))
  .handler(async ({ data }): Promise<ZipLocation | null> => {
    const { geocodeZipServer } = await import("./location.server");
    return geocodeZipServer(data.zip);
  });

/** Address / ZIP autocomplete (Mapbox, falls back to OpenStreetMap). */
export const suggestPlaces = createServerFn({ method: "POST" })
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


/** Public Mapbox GL token for the browser. Empty string when maps are disabled. */
export const getMapToken = createServerFn({ method: "GET" }).handler(async (): Promise<string> => {
  const { publicMapToken } = await import("./places.server");
  return publicMapToken();
});

/** Coordinates → ZIP, used when a picked suggestion has no postcode. */
export const reverseZip = createServerFn({ method: "POST" })
  .inputValidator(z.object({ lat: v.lat, lon: v.lon }))
  .handler(async ({ data }): Promise<string | null> => {
    const { reverseZipServer } = await import("./places.server");
    return reverseZipServer(data.lat, data.lon);
  });
