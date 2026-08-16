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
