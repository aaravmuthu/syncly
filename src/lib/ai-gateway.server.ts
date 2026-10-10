// Server-only. Lovable AI Gateway provider for the AI SDK.
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
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

/** Lovable AI Gateway model, only used when no direct provider key is configured. */
export const SYNCLY_AI_MODEL = "google/gemini-3.6-flash";

type AiTier = "strong" | "light";

/**
 * Every AI feature, tagged with how much model it needs. "strong" is for
 * calls that reason or act: parsing a free-text plan, calling tools,
 * resolving a conflict, summarizing a teen's day for a parent. "light" is
 * for short rewrites and ranking, where the cheap tier reads the same and its
 * much bigger free quota matters more.
 */
const FEATURE_TIER = {
  magic_plan_draft: "strong",
  ai_compromise: "strong",
  plan_concierge: "strong",
  ask_syncly: "strong",
  guardian_summary: "strong",
  compromise_summaries: "light",
  plan_b_pitch: "light",
  squad_digest: "light",
  vibe_search: "light",
  venue_insight: "light",
  demo_coach: "light",
} as const satisfies Record<string, AiTier>;

export type AiFeature = keyof typeof FEATURE_TIER;

type AiProvider = "gemini" | "groq";
type ModelStep = { provider: AiProvider; model: string };

/**
 * Model order per tier. Each step is tried with every configured key for its
 * provider before moving on, because free-tier quota is tracked per model per
 * key (each key is its own project) -- so every (model, key) pair is a
 * separate bucket, and a 429 on one just moves the call to the next.
 *
 * - gemini-3.6-flash is the strongest model on Gemini's free tier (Pro is
 *   0 requests/day there), but flash's daily bucket is small.
 * - gemini-3.5-flash-lite has the biggest Gemini bucket. Pinned to 3.5, not
 *   "flash-lite-latest", so the bucket doesn't shift when Google repoints
 *   the alias; 2.5-flash-lite is closed to this key's project.
 * - Groq's gpt-oss models carry roughly 1K requests/day each per key, on
 *   their own quota, and both support strict JSON schema and tool calling
 *   (just not together in one call, which no Syncly feature does).
 */
const TIER_CHAIN: Record<AiTier, ModelStep[]> = {
  strong: [
    { provider: "gemini", model: "gemini-3.6-flash" },
    { provider: "groq", model: "openai/gpt-oss-120b" },
    { provider: "gemini", model: "gemini-3.5-flash-lite" },
  ],
  light: [
    { provider: "gemini", model: "gemini-3.5-flash-lite" },
    { provider: "groq", model: "openai/gpt-oss-20b" },
    { provider: "groq", model: "openai/gpt-oss-120b" },
  ],
};

/** How hard gpt-oss thinks per tier; light calls are short rewrites. */
const GROQ_REASONING: Record<AiTier, "low" | "medium"> = { strong: "medium", light: "low" };

const KEY_ENV: Record<AiProvider, string> = { gemini: "GEMINI_API_KEY", groq: "GROQ_API_KEY" };

/**
 * Configured keys for a provider: GEMINI_API_KEY, GEMINI_API_KEY_2, ... _5.
 * Read at call time (never module scope). `slot` is the env var's number, so
 * logs can say which key ran out without ever printing the key.
 */
function providerKeys(provider: AiProvider): { key: string; slot: number }[] {
  const base = KEY_ENV[provider];
  const seen = new Set<string>();
  const keys: { key: string; slot: number }[] = [];
  for (let slot = 1; slot <= 5; slot++) {
    const key = process.env[slot === 1 ? base : `${base}_${slot}`]?.trim();
    if (key && !seen.has(key)) {
      seen.add(key);
      keys.push({ key, slot });
    }
  }
  return keys;
}

function providerModel(step: ModelStep, apiKey: string) {
  if (step.provider === "groq") return createGroq({ apiKey })(step.model);
  return createGoogleGenerativeAI({
    apiKey,
    baseURL: "https://generativelanguage.googleapis.com/v1beta",
  })(step.model);
}

type Candidate = { label: string; step: ModelStep; apiKey: string };

function candidatesFor(tier: AiTier): Candidate[] {
  return TIER_CHAIN[tier].flatMap((step) =>
    providerKeys(step.provider).map(({ key, slot }) => ({
      label: slot === 1 ? step.model : `${step.model} (key ${slot})`,
      step,
      apiKey: key,
    })),
  );
}

/**
 * label -> epoch ms until which that (model, key) is skipped. Module-scope on
 * purpose: it lives as long as the worker isolate, so a bucket that just ran
 * dry isn't re-hit by every following request. Best-effort only -- a fresh
 * isolate starts empty and simply rediscovers the 429.
 */
const coolingUntil = new Map<string, number>();

/** How long to skip a (model, key) after it failed, or 0 to keep using it. */
function cooldownMs(error: unknown): number {
  if (!APICallError.isInstance(error)) return 0;
  if (isKeyOrModelError(error)) return 60 * 60_000;
  if (!isQuotaError(error)) return 0;
  const retryAfter = Number(error.responseHeaders?.["retry-after"]);
  if (Number.isFinite(retryAfter) && retryAfter > 0)
    return Math.min(retryAfter * 1000, 60 * 60_000);
  return /per ?day|daily/i.test(error.message) ? 60 * 60_000 : 60_000;
}

/**
 * Any API error moves the call on, not just quota/auth/outage: models differ
 * in what they accept (Groq's strict JSON schema mode can 400 where Gemini
 * doesn't), so a rejection from one says nothing about the next. Aborts and
 * local errors still stop the chain.
 */
function shouldTryNext(error: unknown): boolean {
  return APICallError.isInstance(error);
}

/** A revoked/invalid key or a retired model. Gemini reports a bad key as a 400, not a 401. */
function isKeyOrModelError(error: APICallError): boolean {
  const status = error.statusCode ?? 0;
  return [401, 403, 404].includes(status) || (status === 400 && /api key/i.test(error.message));
}

/**
 * Runs one generate call down the tier's candidate list until one succeeds.
 * Cooling candidates go to the back rather than being dropped, so a stale
 * cooldown can never make the whole chain refuse to try. The final error is
 * rethrown as non-retryable: the chain already was the retry, and letting
 * generateText back off and rerun it would only delay the caller's fallback.
 */
function chainMiddleware(
  feature: AiFeature,
  tier: AiTier,
  candidates: Candidate[],
): LanguageModelMiddleware {
  return {
    wrapGenerate: async ({ params }) => {
      const now = Date.now();
      const ordered = [
        ...candidates.filter((c) => (coolingUntil.get(c.label) ?? 0) <= now),
        ...candidates.filter((c) => (coolingUntil.get(c.label) ?? 0) > now),
      ];
      let lastError: unknown;
      for (const [i, c] of ordered.entries()) {
        if (params.abortSignal?.aborted) throw params.abortSignal.reason;
        const callParams =
          c.step.provider === "groq"
            ? {
                ...params,
                providerOptions: {
                  ...params.providerOptions,
                  groq: {
                    reasoningEffort: GROQ_REASONING[tier],
                    ...params.providerOptions?.["groq"],
                  },
                },
              }
            : params;
        try {
          return await providerModel(c.step, c.apiKey).doGenerate(callParams);
        } catch (error) {
          lastError = error;
          if (!shouldTryNext(error)) throw error;
          const cooldown = cooldownMs(error);
          if (cooldown) coolingUntil.set(c.label, Date.now() + cooldown);
          void logAiEvent(feature, c.label, error);
          if (i < ordered.length - 1)
            console.warn(`[ai:${feature}] ${c.label} failed, trying next model`);
        }
      }
      if (APICallError.isInstance(lastError)) {
        throw new APICallError({
          message: lastError.message,
          url: lastError.url,
          requestBodyValues: lastError.requestBodyValues,
          statusCode: lastError.statusCode,
          responseHeaders: lastError.responseHeaders,
          responseBody: lastError.responseBody,
          cause: lastError,
          isRetryable: false,
        });
      }
      throw lastError;
    },
  };
}

/**
 * The model for one AI feature. Picks the feature's tier, then chains every
 * configured (model, key) pair for that tier -- see TIER_CHAIN -- so a quota,
 * auth or outage error on one quietly moves the call to the next.
 * Falls back to the Lovable AI Gateway only when no Gemini or Groq key is
 * set at all. Throws a friendly error when nothing is configured so callers
 * can degrade.
 */
export function aiModel(feature: AiFeature) {
  const tier = FEATURE_TIER[feature];
  const candidates = candidatesFor(tier);
  const first = candidates[0];
  if (first) {
    return wrapLanguageModel({
      model: providerModel(first.step, first.apiKey),
      middleware: chainMiddleware(feature, tier, candidates),
    });
  }
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) {
    throw new Error(
      "AI is not configured: none of GEMINI_API_KEY, GROQ_API_KEY or LOVABLE_API_KEY is set in this environment. " +
        "A .env.local file only reaches local dev -- it's gitignored, so it never reaches a deployed build. " +
        "Add the keys as secrets in the deployment platform's own project settings (not just the local file) " +
        "for them to work once published.",
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

/** One row in `ai_quota_events`. Never throws -- logging is best-effort only. */
async function logAiEvent(feature: string, model: string, error: unknown): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("ai_quota_events").insert({
      feature,
      model,
      error_type: isQuotaError(error) ? "quota" : "other",
      message: (error instanceof Error ? error.message : String(error)).slice(0, 500),
    });
  } catch {
    /* logging is best-effort only */
  }
}

/**
 * Every AI feature already has a deterministic fallback for when the model
 * is unavailable, which is exactly why quota exhaustion was previously
 * invisible -- the app just quietly degraded. This makes that visible: logs
 * to the server console immediately, and persists a row to
 * `ai_quota_events` so real-world frequency can be queried later instead of
 * guessed at. Each (model, key) that failed along the way already logged its
 * own row from chainMiddleware; this one, with model "all <tier> models",
 * marks that the feature itself fell back. Never throws -- a logging failure
 * must never break the caller's own fallback path.
 */
export async function recordAiFailure(feature: AiFeature, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    `[ai:${feature}] ${isQuotaError(error) ? "quota exceeded" : "call failed"}: ${message.slice(0, 300)}`,
  );
  await logAiEvent(feature, `all ${FEATURE_TIER[feature]} models`, error);
}
