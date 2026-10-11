import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as v from "./schemas";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { VenueInsight } from "./reviews.server";

/** Factual checks to make before visiting a venue. */
export const getVenueInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      name: v.reqText(300),
      address: v.optText(500),
      cuisine: v.optText(200),
      kind: v.optText(40),
      priceLevel: v.optText(20),
    }),
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
