// Server-only. Lovable AI Gateway provider for the AI SDK.
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

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

/** The one chat model Quorum uses. */
export const QUORUM_AI_MODEL = "google/gemini-3.6-flash";

/** Direct Google Gemini model id used for every AI feature. */
export const GEMINI_MODEL = "gemini-flash-latest";

/**
 * Primary AI model. Reads GEMINI_API_KEY at call time (never module scope) and
 * talks straight to Google's REST endpoint:
 * https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=...
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
  return createLovableAiGatewayProvider(key)(QUORUM_AI_MODEL);
}
