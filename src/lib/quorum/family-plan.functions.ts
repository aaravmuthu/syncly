import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveMyProfileId } from "./me";

export const getMyFamilyPlan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await resolveMyProfileId(context.supabase);
    const { myFamilyPlan } = await import("./family-plan.server");
    return myFamilyPlan(me);
  });

export const startFamilyPlus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ interval: z.enum(["month", "year"]) }))
  .handler(async ({ data, context }) => {
    const me = await resolveMyProfileId(context.supabase);
    const { startFamilyPlus } = await import("./family-plan.server");
    return startFamilyPlus(me, data.interval);
  });

export const cancelFamilyPlus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await resolveMyProfileId(context.supabase);
    const { cancelFamilyPlus } = await import("./family-plan.server");
    return cancelFamilyPlus(me);
  });
