import { ZodError } from "zod";

const MAX_BODY = 12 * 1024 * 1024 + 4096;
const HEADERS = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
export function nativeResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value, (_key, v) => {
    if (typeof v === "number" && !Number.isFinite(v)) throw new Error("Non-finite native response");
    return v;
  }), { status, headers: HEADERS });
}
export function failure(code: string, message: string, status: number, requestId = crypto.randomUUID(), field?: string) {
  return nativeResponse({ error: { code, message, ...(field ? { field } : {}) }, requestId }, status);
}
export async function readNativeBody(request: Request): Promise<Record<string, unknown>> {
  if ((request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase() !== "application/json") throw new TypeError("json_required");
  const length = Number(request.headers.get("content-length"));
  if (length > MAX_BODY) throw new RangeError("body_limit");
  const reader = request.body?.getReader();
  if (!reader) return {};
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY) { await reader.cancel(); throw new RangeError("body_limit"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new TypeError("object_required");
  return parsed as Record<string, unknown>;
}
export function nativeError(error: unknown) {
  if (error instanceof RangeError && error.message === "body_limit") return failure("payload_too_large", "This upload is too large.", 413);
  if (error instanceof SyntaxError || error instanceof TypeError) return failure("validation_failed", "Enter valid values and try again.", 422);
  if (error instanceof ZodError) return failure("validation_failed", "Check this value and try again.", 422, undefined, error.issues[0]?.path.join("."));
  const message = error instanceof Error ? error.message : "";
  if (/Unauthorized/i.test(message)) return failure("unauthorized", "Sign in again to continue.", 401);
  if (/two.factor|verification required|account security/i.test(message)) return failure("verification_required", "Finish verifying your account before continuing.", 403);
  if (/Forbidden|Only .* (owner|admin)|not in this group/i.test(message)) return failure("forbidden", "You don’t have permission for this action.", 403);
  if (/link.*expired/i.test(message)) return failure("expired", "This link has expired.", 410);
  if (/quota|limit reached|too many|cooldown|wait.*minute/i.test(message)) return failure("rate_limited", "Please wait before trying again.", 429);
  if (/closed|locked|finalized|completed|already decided/i.test(message)) return failure("conflict", "This item has changed. Refresh and try again.", 409);
  // Never return provider, SQL, environment configuration, or private input errors.
  return failure("operation_failed", "This action couldn’t be completed. Please try again.", 503);
}
export type NativeInvoker = (name: string, data: Record<string, unknown>, headers: Headers) => Promise<unknown>;
export async function handleNativeOperation(request: Request, name: string, allowed: readonly string[], invoke: NativeInvoker) {
  if (request.method !== "POST") return failure("method_not_allowed", "Use POST for this action.", 405);
  if (!allowed.includes(name)) return failure("not_found", "This action is unavailable.", 404);
  // Cookies and body identity can never substitute for the native Bearer session.
  if (!/^Bearer [^\s]+$/.test(request.headers.get("authorization") ?? "")) return failure("unauthorized", "Sign in again to continue.", 401);
  try {
    const data = await readNativeBody(request);
    const result = await invoke(name, data, request.headers);
    return nativeResponse({ data: result ?? null });
  } catch (error) { return nativeError(error); }
}
