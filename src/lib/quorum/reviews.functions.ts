import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { VenueInsight } from "./reviews.server";

/** AI dish highlights, vibe tags and community-style reviews for one venue. */
export const getVenueInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      name: string;
      address?: string | null;
      cuisine?: string | null;
      kind?: string | null;
      priceLevel?: string | null;
    }) => d,
  )
  .handler(async ({ data }): Promise<VenueInsight> => {
    const { generateVenueInsight } = await import("./reviews.server");
    return generateVenueInsight({
      name: data.name,
      address: data.address ?? null,
      cuisine: data.cuisine ?? null,
      kind: data.kind ?? "food",
      priceLevel: data.priceLevel ?? null,
    });
  });
