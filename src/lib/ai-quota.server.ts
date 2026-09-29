/**
 * Per-user daily cap on AI calls. Normal use (digest and summaries cached
 * for 10 minutes, a handful of questions) stays far below it; the cap only
 * bounds what one account can spend by calling server functions directly.
 */
export const AI_DAILY_LIMIT = 100;

export class AiQuotaError extends Error {
  constructor() {
    super("You've hit today's AI limit. It resets at midnight UTC.");
    this.name = "AiQuotaError";
  }
}

/**
 * Counts one AI call for `userId` and throws `AiQuotaError` once the day's
 * limit is passed. Call it right before the model call, after the caller's
 * own permission checks. Fails open: if the counter itself errors, the call
 * is logged and allowed, because this is abuse protection, not access control.
 */
export async function assertAiQuota(userId: string, feature: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: allowed, error } = await supabaseAdmin.rpc("take_ai_call", {
    _user_id: userId,
    _feature: feature,
    _limit: AI_DAILY_LIMIT,
  });
  if (error) {
    console.error(`[ai-quota:${feature}] counter failed, allowing call: ${error.message}`);
    return;
  }
  if (allowed === false) throw new AiQuotaError();
}
