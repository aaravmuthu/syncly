import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveMyProfileId } from "./me";

/**
 * The probe writes rows with the service role, so it's an operator tool, not a
 * user feature: allowed in dev, and in production only for auth user ids listed
 * in SECURITY_CHECK_USER_IDS (comma-separated).
 */
function mayRunProbe(userId: string): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const allowed = (process.env.SECURITY_CHECK_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return allowed.includes(userId);
}

/** Runs the RLS probe as the signed-in user. Safe: only temporary rows are touched. */
export const runRlsSelfCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!mayRunProbe(context.userId)) {
      throw new Error("The security self-check is only available to Syncly operators.");
    }
    const { runRlsProbe } = await import("./rlscheck.server");
    const me = await resolveMyProfileId(context.supabase);
    const checks = await runRlsProbe(context.supabase as never, me);
    return { checks, passed: checks.every((c) => c.passed), ranAt: new Date().toISOString() };
  });
