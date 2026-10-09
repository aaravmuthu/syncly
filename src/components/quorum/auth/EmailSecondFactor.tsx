import { VerificationFeedback } from "./VerificationFeedback";
import { useEffect, useState } from "react";
import { Button } from "@/components/quorum/ui";
import { sendEmailSecondFactor, verifyEmailSecondFactor } from "@/lib/email-mfa.functions";
import { CodeInput } from "./CodeInput";
export function EmailSecondFactor({
  purpose = "verify",
  onComplete,
  onCancel,
}: {
  purpose?: "enroll" | "verify" | "disable";
  onComplete: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const [challenge, setChallenge] = useState<{ challengeId: string; destination: string } | null>(
    null,
  );
  const [accepted, setAccepted] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);
  async function send() {
    if (busy || cooldown) return;
    setBusy(true);
    setError("");
    try {
      setChallenge(await sendEmailSecondFactor({ data: { purpose } }));
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
    if (!challenge || busy) return;
    setBusy(true);
    setError("");
    try {
      await verifyEmailSecondFactor({
        data: { purpose, challengeId: challenge.challengeId, code },
      });
      setAccepted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not verify this code. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <VerificationFeedback accepted={accepted} onComplete={onComplete}>
      <div className="auth-step space-y-4">
        <h2 className="text-xl font-semibold">
          {purpose === "enroll"
            ? "Set up email verification"
            : purpose === "disable"
              ? "Turn off email verification"
              : "Verify with email"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {purpose === "enroll"
            ? "Confirm a code sent to your verified account email. Future sign-ins will require a separate email code."
            : purpose === "disable"
              ? "Confirm a code from your email before removing this protection."
              : "Enter a separate security code to finish signing in. It expires after 10 minutes."}
        </p>
        {error && (
          <p id="email-mfa-error" role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {challenge ? (
          <form
            onSubmit={verify}
            aria-describedby={error ? "email-mfa-error" : undefined}
            className="space-y-4"
          >
            <p role="status" className="text-sm">
              Code sent to {challenge.destination}.
            </p>
            <CodeInput
              value={code}
              onChange={setCode}
              error={!!error}
              errorId="email-mfa-error"
              digits={6}
              disabled={busy}
            />
            <Button className="w-full" type="submit" loading={busy}>
              Verify code
            </Button>
          </form>
        ) : (
          <Button loading={busy} onClick={() => void send()}>
            Send email verification code
          </Button>
        )}
        {challenge && (
          <Button variant="ghost" disabled={busy || cooldown > 0} onClick={() => void send()}>
            {cooldown ? `Send again in ${cooldown}s` : "Send a new code"}
          </Button>
        )}
        <Button variant="ghost" disabled={busy} onClick={onCancel}>
          {purpose === "verify" ? "Cancel sign-in" : "Cancel"}
        </Button>
      </div>
    </VerificationFeedback>
  );
}
