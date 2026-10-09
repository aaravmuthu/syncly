import { supabase } from "@/integrations/supabase/client";

export function normalizePhone(value: string) {
  const phone = value.trim().replace(/[\s().-]/g, "");
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
    throw new Error("Enter your phone number with its country code, such as +14155552671.");
  }
  return phone;
}

export async function needsSecondFactor() {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw error;
  return data.currentLevel !== "aal2" && data.nextLevel === "aal2";
}

export async function needsAccountVerification() {
  if (await needsSecondFactor()) return true;
  const { getEmailSecurity } = await import("./email-mfa.functions");
  const state = await getEmailSecurity();
  return state.enabled && !state.verified;
}
