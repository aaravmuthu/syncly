import crypto from "node:crypto";

/**
 * Signs the "share parent summary link" URLs (/approve/<planId>.<sig>).
 *
 * Plan ids are not secret -- they're visible to every group member and show
 * up throughout the app (routes, activity feed, chat). Before this, the
 * public parent-summary page (getParentSummary/parentRespondToPlan in
 * approval.functions.ts) trusted the bare plan id as if it were a bearer
 * credential, which let anyone who could see a plan id read every
 * participant's curfew/home-distance and submit a completed "approved"
 * decision with zero verification. This HMAC ties the link to a secret only
 * the server holds, so a valid link can only come from getSummaryShareLink
 * (plan.functions.ts), which is auth + can_see_plan gated.
 *
 * Reuses the service role key as the signing secret rather than introducing
 * a new one -- it's already a real server-only secret, and there's no
 * dedicated app-level signing secret in this project's env vars today.
 */
function signingSecret(): string {
  const secret = process.env["SB_SERVICE_ROLE_KEY"] || process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!secret) {
    throw new Error("Missing signing secret: SB_SERVICE_ROLE_KEY / SUPABASE_SERVICE_ROLE_KEY");
  }
  return secret;
}

export function signPlanSummary(planId: string): string {
  return crypto.createHmac("sha256", signingSecret()).update(planId).digest("hex").slice(0, 32);
}

export function verifyPlanSummarySig(planId: string, sig: string): boolean {
  if (typeof sig !== "string" || sig.length === 0) return false;
  const expected = signPlanSummary(planId);
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
