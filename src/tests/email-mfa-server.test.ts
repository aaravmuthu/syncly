import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), getUser: vi.fn(), gate: vi.fn(), fetch: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc: mocks.rpc } }));
import {
  emailSecurityStatus,
  sendEmailChallenge,
  verifyEmailChallenge,
} from "@/lib/email-mfa.server";
import { codeDigest } from "@/lib/email-mfa-crypto.server";

const userId = "10000000-0000-4000-8000-000000000001";
const sessionId = "20000000-0000-4000-8000-000000000002";
const secret = "test-only-secret-with-at-least-32-bytes";
const context = {
  userId,
  accessToken: "verified-bearer",
  claims: { session_id: sessionId, amr: [{ method: "password" }] },
  supabase: { auth: { getUser: mocks.getUser }, rpc: mocks.gate },
} as unknown as Parameters<typeof sendEmailChallenge>[0];

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("AUTH_OTP_SECRET", secret);
  vi.stubEnv("RESEND_API_KEY", "test-only-key");
  vi.stubEnv("AUTH_EMAIL_FROM", "Syncly <security@example.com>");
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.fetch.mockResolvedValue({ ok: true });
  mocks.gate.mockResolvedValue({ data: true, error: null });
  mocks.getUser.mockResolvedValue({
    data: { user: { id: userId, email: "owner@example.com", email_confirmed_at: "2026-10-09" } },
    error: null,
  });
  mocks.rpc.mockImplementation(async (method: string) => ({
    data: method === "email_mfa_status" ? { enabled: true, verified: false } : null,
    error: null,
  }));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("trusted email MFA service", () => {
  it("sends only to the confirmed account email and stores a session-bound digest", async () => {
    const sent = await sendEmailChallenge(context, "verify");
    const request = JSON.parse(mocks.fetch.mock.calls[0]![1].body);
    expect(request.to).toEqual(["owner@example.com"]);
    const code = request.text.match(/code is (\d{6})/)[1];
    const reservation = mocks.rpc.mock.calls.find(
      ([method]) => method === "reserve_email_mfa_challenge",
    )![1];
    expect(reservation._user_id).toBe(userId);
    expect(reservation._session_id).toBe(sessionId);
    expect(reservation._code_hash).toBe(
      codeDigest(secret, userId, sessionId, sent.challengeId, "verify", code),
    );
    expect(sent).not.toHaveProperty("code");
    expect(sent).not.toHaveProperty("code_hash");
    expect(mocks.getUser).toHaveBeenCalledWith("verified-bearer");
  });
  it("does not treat email OTP login as the independent primary factor", async () => {
    const otpContext = { ...context, claims: { session_id: sessionId, amr: [{ method: "otp" }] } };
    expect((await emailSecurityStatus(otpContext)).requiresPassword).toBe(true);
    await expect(sendEmailChallenge(otpContext, "verify")).rejects.toThrow("password or Google");
    await expect(
      verifyEmailChallenge(otpContext, {
        purpose: "verify",
        challengeId: sessionId,
        code: "123456",
      }),
    ).rejects.toThrow("password or Google");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("requires full account verification before enrollment or removal", async () => {
    mocks.gate.mockResolvedValue({ data: false, error: null });
    await expect(sendEmailChallenge(context, "disable")).rejects.toThrow("Finish signing in");
    await expect(
      verifyEmailChallenge(context, { purpose: "enroll", challengeId: sessionId, code: "123456" }),
    ).rejects.toThrow("Finish signing in");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("refuses changed identity and unconfirmed destination addresses", async () => {
    for (const user of [
      { id: "other", email: "owner@example.com", email_confirmed_at: "yes" },
      { id: userId, email: "owner@example.com" },
    ]) {
      mocks.getUser.mockResolvedValue({ data: { user }, error: null });
      await expect(sendEmailChallenge(context, "verify")).rejects.toThrow();
    }
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("fails closed for a missing security RPC and retains database rate limits", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "missing migration" } });
    await expect(emailSecurityStatus(context)).rejects.toThrow("Could not check");
    mocks.rpc.mockImplementation(async (method: string) =>
      method === "email_mfa_status"
        ? { data: { enabled: true, verified: false }, error: null }
        : {
            data: null,
            error: { message: "Wait at least a minute before requesting another email code." },
          },
    );
    await expect(sendEmailChallenge(context, "verify")).rejects.toThrow("Wait at least");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("rejects expired, exhausted and replayed challenges without granting verification", async () => {
    mocks.rpc.mockImplementation(async (method: string) => ({
      data:
        method === "email_mfa_status"
          ? { enabled: true, verified: false }
          : {
              verified: false,
              message: "This code has expired or cannot be used. Request a new code.",
            },
      error: null,
    }));
    await expect(
      verifyEmailChallenge(context, { purpose: "verify", challengeId: sessionId, code: "123456" }),
    ).rejects.toThrow("expired");
  });
  it("returns a recoverable delivery error without leaking provider details", async () => {
    mocks.fetch.mockRejectedValue(new Error("private provider diagnostic"));
    await expect(sendEmailChallenge(context, "verify")).rejects.toThrow("Wait a minute");
  });
});
