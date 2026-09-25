// Server-only. Lovable AI Gateway provider for the AI SDK.
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { APICallError, RetryError, wrapLanguageModel, type LanguageModelMiddleware } from "ai";

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
 *
 * Pinned to an explicit version (3.5) rather than the "flash-lite-latest"
 * rolling alias, so behavior/quota-bucket identity doesn't silently shift
 * whenever Google repoints "latest". gemini-2.5-flash-lite was tried first
 * (a lower/older tier was the original ask) but this API key's project
 * postdates its cutoff -- Google's own API rejects it outright with
 * "no longer available to new users... use models/gemini-3.5-flash-lite" --
 * so 3.5 is the actual lowest available lite tier here, not a choice made
 * for capability. Confirmed tool-calling and schema-validated structured
 * output both work correctly on it.
 */
export const GEMINI_MODEL = "gemini-3.5-flash-lite";

function geminiModel(apiKey: string) {
  const google = createGoogleGenerativeAI({
    apiKey,
    baseURL: "https://generativelanguage.googleapis.com/v1beta",
  });
  return google(GEMINI_MODEL);
}

/**
 * Wraps a primary Gemini model so a 429/quota error on it is retried once
 * against each fallback key in turn, instead of failing the whole call.
 * Google buckets daily quota per API key, so a second key (its own free-tier
 * project) gives real extra headroom, not just a retry of the same limit.
 * Every fallback key is a separate `gemini-3.5-flash-lite` call under the
 * hood, so this only ever swaps identity, never model behavior.
 */
function quotaFallbackMiddleware(fallbackKeys: string[]): LanguageModelMiddleware {
  return {
    wrapGenerate: async ({ doGenerate, params }) => {
      try {
        return await doGenerate();
      } catch (error) {
        if (!isQuotaError(error)) throw error;
        for (const key of fallbackKeys) {
          try {
            console.warn("[ai] Gemini key hit its quota, retrying with fallback key");
            return await geminiModel(key).doGenerate(params);
          } catch (fallbackError) {
            if (!isQuotaError(fallbackError)) throw fallbackError;
            /* this fallback key is also exhausted -- fall through to the next one */
          }
        }
        throw error;
      }
    },
  };
}

/**
 * Primary AI model. Reads GEMINI_API_KEY (and optionally GEMINI_API_KEY_2) at
 * call time (never module scope) and talks straight to Google's REST endpoint:
 * https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key=...
 * When GEMINI_API_KEY_2 is set, a quota error (HTTP 429) on the primary key
 * automatically retries the same call against the second key instead of
 * failing -- see quotaFallbackMiddleware above.
 * Falls back to the Lovable AI Gateway when no Gemini key is configured.
 * Throws a friendly error when neither is available so callers can degrade.
 */
export function lovableAiModel() {
  const geminiKey = process.env["GEMINI_API_KEY"];
  if (geminiKey) {
    const primary = geminiModel(geminiKey);
    const fallbackKey = process.env["GEMINI_API_KEY_2"];
    if (!fallbackKey) return primary;
    return wrapLanguageModel({
      model: primary,
      middleware: quotaFallbackMiddleware([fallbackKey]),
    });
  }
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) {
    throw new Error(
      "AI is not configured: neither GEMINI_API_KEY nor LOVABLE_API_KEY is set in this environment. " +
        "A .env.local file with GEMINI_API_KEY only reaches local dev -- it's gitignored, so it never " +
        "reaches a deployed build. Add the key as a secret in the deployment platform's own project " +
        "settings (not just the local file) for it to work once published.",
    );
  }
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
