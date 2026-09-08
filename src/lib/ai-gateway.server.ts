// Server-only. Lovable AI Gateway provider for the AI SDK.
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { APICallError, RetryError } from "ai";

const LOVABLE_AIG_RUN_ID_HEADER = "X-Lovable-AIG-Run-ID";

export function createLovableAiGatewayRunIdFetch(initialRunId?: string) {
  let runId = initialRunId?.trim() || undefined;
  let resolveRunId: (value: string | undefined) => void = () => {};
  let runIdResolved = false;
  const runIdReady = new Promise<string | undefined>((resolve) => {
    resolveRunId = resolve;
  });

  const publishRunId = (value?: string) => {
    const nextRunId = value?.trim() || undefined;
    if (!runId && nextRunId) runId = nextRunId;
    if (!runIdResolved) {
      runIdResolved = true;
      resolveRunId(runId);
    }
  };
  if (runId) publishRunId(runId);

  return {
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (runId && !headers.has(LOVABLE_AIG_RUN_ID_HEADER)) {
        headers.set(LOVABLE_AIG_RUN_ID_HEADER, runId);
      }
      try {
        const response = await fetch(input, { ...init, headers });
        publishRunId(response.headers.get(LOVABLE_AIG_RUN_ID_HEADER) ?? undefined);
        return response;
      } catch (error) {
        publishRunId(undefined);
        throw error;
      }
    },
    getRunId: () => runId,
    waitForRunId: () => (runId ? Promise.resolve(runId) : runIdReady),
  };
}

export function createLovableAiGatewayProvider(lovableApiKey: string, initialRunId?: string) {
  const runIdFetch = createLovableAiGatewayRunIdFetch(initialRunId);
  const provider = createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": lovableApiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
    fetch: runIdFetch.fetch as typeof fetch,
  });
  return Object.assign(provider, {
    getRunId: runIdFetch.getRunId,
    waitForRunId: runIdFetch.waitForRunId,
  });
}

/** The one chat model Syncly uses. */
export const SYNCLY_AI_MODEL = "google/gemini-3.6-flash";

/**
 * Direct Google Gemini model id used for every AI feature.
 * Deliberately the "flash-lite" tier, not plain "flash": Google tracks free-
 * tier daily request quota separately per model, and flash-lite's bucket is
 * meaningfully larger than flash's (confirmed directly against this API key
 * -- the full flash model hit its 20-requests/day cap during testing).
 * Every AI feature in this app already has a deterministic fallback for when
 * the model is unavailable for any reason, quota included, so this is a
 * capacity choice, not a correctness one -- confirmed tool-calling and
 * schema-validated structured output both still work correctly on this tier.
 */
export const GEMINI_MODEL = "gemini-flash-lite-latest";

/**
 * Primary AI model. Reads GEMINI_API_KEY at call time (never module scope) and
 * talks straight to Google's REST endpoint:
 * https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key=...
 * Falls back to the Lovable AI Gateway when no Gemini key is configured.
 * Throws a friendly error when neither is available so callers can degrade.
 */
export function lovableAiModel() {
  const geminiKey = process.env["GEMINI_API_KEY"];
  if (geminiKey) {
    const google = createGoogleGenerativeAI({
      apiKey: geminiKey,
      baseURL: "https://generativelanguage.googleapis.com/v1beta",
    });
    return google(GEMINI_MODEL);
  }
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI is not configured");
  return createLovableAiGatewayProvider(key)(SYNCLY_AI_MODEL);
}

/** True when a generateText/generateObject failure was specifically a rate/quota limit (HTTP 429), not some other failure. */
function isQuotaError(error: unknown): boolean {
  const candidates: unknown[] = [error];
  if (RetryError.isInstance(error)) candidates.push(...error.errors);
  return candidates.some(
    (e) =>
      APICallError.isInstance(e) &&
      (e.statusCode === 429 || /quota|resource_exhausted/i.test(e.message)),
  );
}

/**
 * Every AI feature already has a deterministic fallback for when the model
 * is unavailable, which is exactly why quota exhaustion was previously
 * invisible -- the app just quietly degraded. This makes that visible: logs
 * to the server console immediately, and persists a row to
 * `ai_quota_events` so real-world frequency can be queried later instead of
 * guessed at. Never throws -- a logging failure must never break the
 * caller's own fallback path.
 */
export async function recordAiFailure(feature: string, error: unknown): Promise<void> {
  const quota = isQuotaError(error);
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[ai:${feature}] ${quota ? "quota exceeded" : "call failed"}: ${message.slice(0, 300)}`);
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("ai_quota_events").insert({
      feature,
      model: GEMINI_MODEL,
      error_type: quota ? "quota" : "other",
      message: message.slice(0, 500),
    });
  } catch {
    /* logging is best-effort only */
  }
}
