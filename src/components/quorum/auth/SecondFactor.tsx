import { VerificationFeedback } from "./VerificationFeedback";
import { useEffect, useState } from "react";
import { Button, inputClass } from "@/components/quorum/ui";
import { supabase } from "@/integrations/supabase/client";
import { normalizePhone } from "@/lib/auth-security";
import { CodeInput } from "./CodeInput";

type Factor = { id: string; factor_type: string; phone?: string; friendly_name?: string };
export function SecondFactor({
  enroll = false,
  onComplete,
  onCancel,
}: {
  enroll?: boolean;
  onComplete: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const [phone, setPhone] = useState("");
  const [factors, setFactors] = useState<Factor[]>([]);
  const [factorId, setFactorId] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(!enroll);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (enroll) return;
    let active = true;
    void supabase.auth.mfa
      .listFactors()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setError(error.message);
        else {
          const available = data.all.filter(
            (f) =>
              f.status === "verified" && (f.factor_type === "phone" || f.factor_type === "totp"),
          );
          setFactors(available);
          setFactorId(available[0]?.id ?? "");
          if (!available.length)
            setError(
              "No supported verification method found. Contact support for account recovery.",
            );
        }
        setLoading(false);
      })
      .catch(() => {
        if (active) {
          setError("Could not load verification methods. Reload to try again.");
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [enroll]);
  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);
  async function send() {
    setBusy(true);
    setError("");
    try {
      let id = factorId;
      if (enroll && !id) {
        const { data, error } = await supabase.auth.mfa.enroll({
          factorType: "phone",
          phone: normalizePhone(phone),
          friendlyName: "Text message",
        });
        if (error) throw error;
        id = data.id;
        setFactorId(id);
      }
      const { data, error } = await supabase.auth.mfa.challenge({ factorId: id, channel: "sms" });
      if (error) throw error;
      setChallengeId(data.id);
      setCode("");
      setCooldown(60);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send a code. Try again.");
    } finally {
      setBusy(false);
    }
  }
  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const { error } = await supabase.auth.mfa.verify({ factorId, challengeId, code });
      if (error) throw error;
      setAccepted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not verify the code. Try again.");
    } finally {
      setBusy(false);
    }
  }
  async function cancel() {
    setBusy(true);
    setError("");
    try {
      if (enroll && factorId) {
        const { error } = await supabase.auth.mfa.unenroll({ factorId });
        if (error) throw error;
      }
      onCancel();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not cancel setup. Try again.");
    } finally {
      setBusy(false);
    }
  }
  const factor = factors.find((f) => f.id === factorId);
  return (
    <VerificationFeedback accepted={accepted} onComplete={onComplete}>
      <div className="auth-step space-y-4">
        <div>
          <h2 className="text-xl font-semibold">
            {enroll ? "Protect your account" : "One more step"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {enroll
              ? "After signing in, you’ll enter a second code sent to your phone. Keep access to this number."
              : "Verify your second factor to finish signing in."}
          </p>
        </div>
        {error && (
          <p id="mfa-error" role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {loading ? (
          <p role="status">Loading verification methods…</p>
        ) : (
          <>
            {enroll && !factorId && (
              <label className="block text-sm font-medium">
                Phone number
                <input
                  type="tel"
                  autoComplete="tel"
                  placeholder="+1 415 555 2671"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={`${inputClass} mt-1.5`}
                />
                <span className="mt-2 block text-xs text-muted-foreground">
                  Include your country code. SMS charges may apply.
                </span>
              </label>
            )}
            {!enroll && factors.length > 1 && !challengeId && (
              <label className="block text-sm font-medium">
                Verification method
                <select
                  className={`${inputClass} mt-1.5`}
                  value={factorId}
                  onChange={(e) => setFactorId(e.target.value)}
                >
                  {factors.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.factor_type === "phone" ? "Text message" : "Authenticator app"}
                      {f.phone ? ` · …${f.phone.slice(-4)}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {challengeId ? (
              <form
                onSubmit={verify}
                aria-describedby={error ? "mfa-error" : undefined}
                className="space-y-4"
              >
                <p role="status" className="text-sm text-muted-foreground">
                  {factor?.factor_type === "totp"
                    ? "Enter the code from your authenticator app."
                    : "Check your phone for your verification code."}
                </p>
                <CodeInput
                  value={code}
                  onChange={setCode}
                  error={!!error}
                  errorId="mfa-error"
                  digits={6}
                  disabled={busy}
                />
                <Button className="w-full" type="submit" loading={busy}>
                  Verify code
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy || cooldown > 0}
                  onClick={() => void send()}
                >
                  {cooldown ? `Send again in ${cooldown}s` : "Send a new code"}
                </Button>
              </form>
            ) : (
              <Button loading={busy} disabled={!enroll && !factorId} onClick={() => void send()}>
                {factor?.factor_type === "totp"
                  ? "Enter authenticator code"
                  : "Send verification code"}
              </Button>
            )}
          </>
        )}
        <Button variant="ghost" disabled={busy} onClick={() => void cancel()}>
          {enroll ? "Cancel setup" : "Cancel sign-in"}
        </Button>
      </div>
    </VerificationFeedback>
  );
}
