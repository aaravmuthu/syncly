import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveMyProfileId } from "./me";

/** Runs the RLS probe as the signed-in user. Safe: only temporary rows are touched. */
export const runRlsSelfCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { runRlsProbe } = await import("./rlscheck.server");
    const me = await resolveMyProfileId(context.supabase);
    const checks = await runRlsProbe(context.supabase as never, me);
    return { checks, passed: checks.every((c) => c.passed), ranAt: new Date().toISOString() };
  });
