import { codeDigest } from "./email-mfa-crypto.server";
import { hasIndependentPrimary } from "./email-mfa-policy";
import { randomInt, randomUUID } from "node:crypto";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Context = {
  supabase: SupabaseClient<Database>;
  userId: string;
  accessToken: string;
  claims: { session_id?: unknown; amr?: unknown };
};
type Purpose = "enroll" | "verify" | "disable";
const statusShape = z.object({ enabled: z.boolean(), verified: z.boolean() });
function sessionId(context: Context) {
  return z.string().uuid().parse(context.claims.session_id);
}
async function confirmedEmail(context: Context) {
  const { data, error } = await context.supabase.auth.getUser(context.accessToken);
  if (error || data.user?.id !== context.userId) throw new Error("Please sign in again.");
  if (!data.user.email || !data.user.email_confirmed_at)
    throw new Error("Add and confirm an email address before using email verification.");
  return data.user.email;
}
export async function emailSecurityStatus(context: Context) {
  const { data, error } = await supabaseAdmin.rpc("email_mfa_status", {
    _user_id: context.userId,
    _session_id: sessionId(context),
  });
  if (error) throw new Error("Could not check email verification. Please try again.");
  const state = statusShape.parse(data);
  return {
    ...state,
    requiresPassword:
      state.enabled && !state.verified && !hasIndependentPrimary(context.claims.amr),
  };
}
async function requireProtectedSession(context: Context, purpose: Purpose) {
  if (purpose === "verify") return;
  const { data, error } = await context.supabase.rpc("has_required_mfa");
  if (error || !data) throw new Error("Finish signing in before changing two-factor settings.");
}
function otpSecret() {
  const secret = process.env.AUTH_OTP_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32)
    throw new Error("Email verification is not configured. Contact support.");
  return secret;
}
export async function sendEmailChallenge(context: Context, purpose: Purpose) {
  const secret = otpSecret();
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.AUTH_EMAIL_FROM;
  if (!apiKey || !from) throw new Error("Email verification is not configured. Contact support.");
  await requireProtectedSession(context, purpose);
  const email = await confirmedEmail(context);
  const state = await emailSecurityStatus(context);
  if (purpose === "verify" && state.requiresPassword)
    throw new Error("Sign in with a password or Google before using email as your second factor.");
  if (purpose === "enroll" && state.enabled)
    throw new Error("Email verification is already enabled.");
  if (purpose !== "enroll" && !state.enabled)
    throw new Error("Email verification is not enabled for this account.");
  const session = sessionId(context);
  const challengeId = randomUUID();
  const code = String(randomInt(100000, 1000000));
  const { error } = await supabaseAdmin.rpc("reserve_email_mfa_challenge", {
    _user_id: context.userId,
    _session_id: session,
    _challenge_id: challengeId,
    _code_hash: codeDigest(secret, context.userId, session, challengeId, purpose, code),
    _email_address: email,
    _purpose: purpose,
  });
  if (error) {
    if (error.message.startsWith("Wait at least") || error.message.startsWith("Too many email"))
      throw new Error(error.message);
    throw new Error("Could not create a verification code. Try again.");
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": challengeId,
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: "Your Syncly security code",
        text: `Your Syncly ${purpose === "enroll" ? "two-factor setup" : purpose === "disable" ? "two-factor removal" : "sign-in verification"} code is ${code}.\n\nIt expires in 10 minutes and can be used once. If you did not request this code, do not share it.`,
      }),
    });
    if (!response.ok) throw new Error("Delivery failed");
  } catch {
    throw new Error("Could not deliver the email code. Wait a minute, then try again.");
  }
  return { challengeId, destination: email.replace(/^(.{1,2}).*(@.*)$/, "$1…$2") };
}
export async function verifyEmailChallenge(
  context: Context,
  data: { challengeId: string; code: string; purpose: Purpose },
) {
  await requireProtectedSession(context, data.purpose);
  if (data.purpose === "verify") {
    const state = await emailSecurityStatus(context);
    if (state.requiresPassword)
      throw new Error(
        "Sign in with a password or Google before using email as your second factor.",
      );
  }
  const email = await confirmedEmail(context);
  const session = sessionId(context);
  const { data: result, error } = await supabaseAdmin.rpc("verify_email_mfa_challenge", {
    _user_id: context.userId,
    _session_id: session,
    _challenge_id: data.challengeId,
    _code_hash: codeDigest(
      otpSecret(),
      context.userId,
      session,
      data.challengeId,
      data.purpose,
      data.code,
    ),
    _email_address: email,
  });
  if (error) throw new Error("Could not verify the code. Try again.");
  const verified = z
    .object({ verified: z.boolean(), message: z.string().optional() })
    .parse(result);
  if (!verified.verified) throw new Error(verified.message ?? "The code could not be verified.");
  return { verified: true };
}
