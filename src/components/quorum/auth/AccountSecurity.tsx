import { EmailSecondFactor } from "./EmailSecondFactor";
import { PHONE_AUTH_ENABLED } from "@/lib/auth-security";
import { getEmailSecurity } from "@/lib/email-mfa.functions";
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button, Card, inputClass } from "@/components/quorum/ui";
import { SectionHeader } from "@/components/quorum/settings/shared";
import { SecondFactor } from "./SecondFactor";
import { DynamicButton } from "@/components/quorum/DynamicButton";

export function AccountSecurity() {
  const [factors, setFactors] = useState<{ id: string; phone?: string }[]>([]);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailSetup, setEmailSetup] = useState<"enroll" | "disable" | null>(null);
  const [confirmedEmail, setConfirmedEmail] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [notice, setNotice] = useState("");
  const [setup, setSetup] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [verifyRemoval, setVerifyRemoval] = useState<string | null>(null);
  async function load() {
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      setFactors(data.phone);
      const security = await getEmailSecurity();
      setEmailEnabled(security.enabled);
      const { data: account, error: accountError } = await supabase.auth.getUser();
      if (accountError) throw accountError;
      setConfirmedEmail(!!account.user?.email_confirmed_at);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load security settings.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function remove(id: string) {
    setBusy(true);
    setError("");
    try {
      const { data, error: assuranceError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assuranceError) throw assuranceError;
      if (data.currentLevel !== "aal2") {
        setVerifyRemoval(id);
        return;
      }
      const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
      if (error) throw error;
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove verification.");
    } finally {
      setBusy(false);
    }
  }
  async function addEmail(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { error } = await supabase.auth.updateUser(
        { email: recoveryEmail.trim() },
        { emailRedirectTo: `${window.location.origin}/auth-callback` },
      );
      if (error) throw error;
      setNotice("Check your email to confirm the address, then reopen these settings.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add your email.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="mt-4 space-y-4">
      <SectionHeader
        icon={ShieldCheck}
        title="Two-factor authentication"
        subtitle="Add a second code after signing in to protect your account."
      />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {emailSetup ? (
        <EmailSecondFactor
          purpose={emailSetup}
          onComplete={() => {
            setEmailSetup(null);
            void load();
          }}
          onCancel={() => setEmailSetup(null)}
        />
      ) : verifyRemoval ? (
        <SecondFactor
          onComplete={() => {
            const id = verifyRemoval;
            setVerifyRemoval(null);
            void remove(id);
          }}
          onCancel={() => setVerifyRemoval(null)}
        />
      ) : setup ? (
        <SecondFactor
          enroll
          onComplete={() => {
            setSetup(false);
            void load();
          }}
          onCancel={() => {
            setSetup(false);
            void load();
          }}
        />
      ) : (
        <>
          {factors.length ? (
            factors.map((f) => (
              <div key={f.id} className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm">
                  Text message enabled{f.phone ? ` · …${f.phone.slice(-4)}` : ""}
                </p>
                <Button variant="outline" disabled={busy} onClick={() => void remove(f.id)}>
                  Turn off SMS verification
                </Button>
              </div>
            ))
          ) : PHONE_AUTH_ENABLED ? (
            <DynamicButton
              variant="outline"
              disabled={busy}
              onClick={() => {
                setError("");
                setSetup(true);
              }}
            >
              {busy ? "Loading…" : "Set up SMS verification"}
            </DynamicButton>
          ) : null}
          <div
            className={
              factors.length || PHONE_AUTH_ENABLED
                ? "border-t border-border pt-4 space-y-3"
                : "space-y-3"
            }
          >
            <p className="text-sm font-medium">
              Email verification {emailEnabled ? "· enabled" : "· off"}
            </p>
            <p className="text-sm text-muted-foreground">
              Require a separate email code after signing in with your password or Google.
              {(factors.length > 0 || PHONE_AUTH_ENABLED) &&
                " If you enable both email and SMS verification, each sign-in requires both codes."}
            </p>
            {!confirmedEmail && (
              <form onSubmit={addEmail} className="space-y-3">
                <label className="block text-sm font-medium">
                  Recovery email
                  <input
                    className={`${inputClass} mt-1.5`}
                    type="email"
                    autoComplete="email"
                    required
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                  />
                </label>
                <Button type="submit" variant="outline" loading={busy}>
                  Add and confirm email
                </Button>
              </form>
            )}
            {notice && (
              <p role="status" className="text-sm text-primary">
                {notice}
              </p>
            )}
            <DynamicButton
              variant="outline"
              disabled={busy || !confirmedEmail}
              onClick={() => {
                setError("");
                setEmailSetup(emailEnabled ? "disable" : "enroll");
              }}
            >
              {emailEnabled ? "Turn off email verification" : "Set up email verification"}
            </DynamicButton>
            {!confirmedEmail && (
              <p className="text-xs text-muted-foreground">
                Confirm an email address before enabling email verification.
              </p>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
