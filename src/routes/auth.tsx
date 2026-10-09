import { VerificationFeedback } from "@/components/quorum/auth/VerificationFeedback";
import { EmailSecondFactor } from "@/components/quorum/auth/EmailSecondFactor";
import { getEmailSecurity } from "@/lib/email-mfa.functions";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BRAND } from "@/lib/brand";
import { Wordmark } from "@/components/quorum/Wordmark";
import { SocialButtons } from "@/components/quorum/SocialButtons";
import { Button } from "@/components/quorum/ui";
import { AiActivity } from "@/components/quorum/ai/AiActivity";
import { SyncAvatar, type SyncMood } from "@/components/quorum/auth/SyncAvatar";
import { caretLook } from "@/components/quorum/auth/caret-look";
import { useIsMobile } from "@/hooks/use-mobile";
import { safeRedirectPath } from "@/lib/safe-dom";
import { SecondFactor } from "@/components/quorum/auth/SecondFactor";
import { CodeInput } from "@/components/quorum/auth/CodeInput";
import { needsSecondFactor, normalizePhone } from "@/lib/auth-security";
import { cn } from "@/lib/utils";

type Mode = "signin" | "signup" | "reset" | "update";
type Field = "email" | "password";

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function safeNext(next: string | undefined) {
  return safeRedirectPath(next, "/home");
}

const TITLE = `Sign in — ${BRAND.name}`;
const DESCRIPTION =
  "Log in or create a Syncly account to plan with your group while keeping your budget, schedule, and rules private.";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: "https://syncly.website/auth" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://syncly.website/auth" }],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" ? s.next : undefined,
    mode: (s.mode === "signup" || s.mode === "reset" || s.mode === "update"
      ? s.mode
      : "signin") as Mode,
  }),
  pendingMs: 0,
  pendingComponent: () => (
    <div className="paper-field grid min-h-dvh place-items-center">
      <AiActivity state="connecting" label="Opening sign-in…" size={64} />
    </div>
  ),
  component: AuthPage,
});

function AuthPage() {
  const { next, mode: initialMode } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [phone, setPhone] = useState("");
  const [emailCode, setEmailCode] = useState(false);
  const [otp, setOtp] = useState<{
    destination: string;
    type: "email" | "sms";
    recovery?: boolean;
  } | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [code, setCode] = useState("");
  const [emailMfa, setEmailMfa] = useState(false);
  const [phoneRecovery, setPhoneRecovery] = useState(false);
  const [mfa, setMfa] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [social, setSocial] = useState<"google" | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [focus, setFocus] = useState<Field | null>(null);
  const [look, setLook] = useState(0);
  const [pulse, setPulse] = useState(0);
  const [outcome, setOutcome] = useState<"success" | "error" | null>(null);

  const isMobile = useIsMobile();
  const target = safeNext(next);

  const finishSignIn = useCallback(async () => {
    if (await needsSecondFactor()) {
      setAccepted(false);
      setOtp(null);
      setEmailMfa(false);
      setMfa(true);
      return;
    }
    const security = await getEmailSecurity();
    if (security.enabled && !security.verified) {
      if (security.requiresPassword) {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        setAccepted(false);
        setMfa(false);
        setEmailMfa(false);
        setOtp(null);
        setEmailCode(false);
        setPassword("");
        setMode("signin");
        setNotice("Sign in with your password or Google to use email as your second factor.");
        return;
      }
      setAccepted(false);
      setOtp(null);
      setMfa(false);
      setEmailMfa(true);
      return;
    }
    window.location.href = target.startsWith("/.lovable/")
      ? target
      : `/auth-callback?next=${encodeURIComponent(target)}`;
  }, [target]);

  useEffect(() => {
    let active = true;
    let recovering = initialMode === "update";
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" && active) {
        recovering = true;
        setMode("update");
        setChecking(false);
      }
    });
    void supabase.auth
      .getSession()
      .then(async ({ data, error }) => {
        if (!active) return;
        if (recovering) {
          setChecking(false);
          if (error || !data.session) {
            setMode("reset");
            setFormError("This reset link has expired. Request a new one below.");
          }
        } else if (data.session) {
          await finishSignIn();
          setChecking(false);
        } else {
          setChecking(false);
        }
      })
      .catch(() => {
        if (active) {
          setChecking(false);
          setFormError("Couldn't check your session. Please try signing in again.");
        }
      });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [initialMode, target, finishSignIn]);

  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  function changeMode(nextMode: Mode) {
    setAccepted(false);
    setMode(nextMode);
    setPhoneRecovery(false);
    setOtp(null);
    setCode("");
    setFormError(null);
    setNotice(null);
    setPassword("");
    setEmailCode(false);
  }
  async function resendCode() {
    if (!otp || busy || cooldown) return;
    setBusy(true);
    setFormError(null);
    try {
      const result =
        otp.type === "sms"
          ? otp.recovery
            ? await supabase.auth.signInWithOtp({
                phone: otp.destination,
                options: { shouldCreateUser: false },
              })
            : await supabase.auth.resend({ type: "sms", phone: otp.destination })
          : await supabase.auth.signInWithOtp({
              email: otp.destination,
              options: { shouldCreateUser: false },
            });
      if (result.error) throw result.error;
      setCooldown(60);
      setNotice("A new code has been sent.");
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not send a new code.");
    } finally {
      setBusy(false);
    }
  }

  // The avatar's reaction to the outcome is momentary; it relaxes back to the form.
  useEffect(() => {
    if (!outcome) return;
    const t = window.setTimeout(() => setOutcome(null), 1800);
    return () => window.clearTimeout(t);
  }, [outcome]);

  const mood: SyncMood = busy
    ? "thinking"
    : outcome === "error"
      ? "oops"
      : outcome === "success"
        ? "celebrate"
        : focus === "password"
          ? "private"
          : focus === "email"
            ? EMAIL_SHAPE.test(email)
              ? "happy"
              : "watching"
            : "idle";

  async function signInWith(provider: "google") {
    setSocial(provider);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth-callback?next=${encodeURIComponent(target)}`,
        },
      });
      if (error) throw error;
      // Supabase redirects the browser to the provider; nothing left to do here.
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : `We couldn't sign you in with ${provider}. Try again.`,
      );
      setSocial(null);
    }
  }

  async function completeCode() {
    if (otp?.recovery) {
      const needsMfa = await needsSecondFactor();
      setAccepted(false);
      setOtp(null);
      setCode("");
      setNotice(null);
      setPhoneRecovery(true);
      if (needsMfa) setMfa(true);
      else setMode("update");
      return;
    }
    await finishSignIn();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || social) return;
    setBusy(true);
    setFormError(null);
    setNotice(null);
    try {
      if (otp) {
        const result =
          otp.type === "sms"
            ? await supabase.auth.verifyOtp({ phone: otp.destination, token: code, type: "sms" })
            : await supabase.auth.verifyOtp({ email: otp.destination, token: code, type: "email" });
        if (result.error) throw result.error;
        setOutcome("success");
        setAccepted(true);
        return;
      }
      if (mode === "signin" && method === "email" && emailCode) {
        const destination = email.trim();
        const { error } = await supabase.auth.signInWithOtp({
          email: destination,
          options: { shouldCreateUser: false },
        });
        if (error) throw error;
        setOtp({ destination, type: "email" });
        setCooldown(60);
        setCode("");
        setNotice("Check your email for your sign-in code.");
        return;
      }
      if ((mode === "signin" || mode === "signup") && method === "phone") {
        const destination = normalizePhone(phone);
        if (mode === "signup") {
          const { error } = await supabase.auth.signUp({ phone: destination, password });
          if (error) throw error;
          setOtp({ destination, type: "sms" });
          setCode("");
          setCooldown(60);
          setNotice("Check your phone for a code to confirm your number.");
          return;
        }
        const { error } = await supabase.auth.signInWithPassword({ phone: destination, password });
        if (error) throw error;
        await finishSignIn();
        return;
      }
      if (mode === "update") {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setPassword("");
        toast.success("Password updated");
        if (phoneRecovery) {
          const { error } = await supabase.auth.signOut();
          if (error) throw error;
          setPhoneRecovery(false);
          setMode("signin");
          setNotice("Password updated. Sign in with your phone number and new password.");
          return;
        }
        void navigate({ to: "/auth-callback", search: { next: target }, replace: true });
        return;
      }
      if (mode === "reset" && method === "phone") {
        const destination = normalizePhone(phone);
        const { error } = await supabase.auth.signInWithOtp({
          phone: destination,
          options: { shouldCreateUser: false },
        });
        if (error) throw error;
        setOtp({ destination, type: "sms", recovery: true });
        setCode("");
        setCooldown(60);
        setNotice("Verify your phone number to choose a new password.");
        return;
      }
      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth?mode=update`,
        });
        if (error) throw error;
        setNotice("Check your email for a reset link.");
        toast.success("Check your email for a reset link.");
        setOutcome("success");
        setMode("signin");
        return;
      }
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}${target}` },
        });
        if (error) throw error;
        if (!data.session) {
          setNotice("Account created. Confirm your email, then log in.");
          toast.success("Account created. Confirm your email, then log in.");
          setOutcome("success");
          setMode("signin");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      await finishSignIn();
    } catch (err) {
      const message = err instanceof Error ? err.message : "We couldn't sign you in. Try again.";
      setFormError(message);
      toast.error(message);
      setOutcome("error");
    } finally {
      setBusy(false);
    }
  }

  if (checking) {
    return (
      <div className="paper-field grid min-h-dvh place-items-center">
        <AiActivity state="connecting" label="Checking if you're signed in…" size={64} />
      </div>
    );
  }

  return (
    <div className="paper-field min-h-dvh px-5 py-8">
      <Link
        to="/"
        className="tap-target -ml-1 inline-flex items-center gap-1.5 px-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back
      </Link>

      <div className="mx-auto mt-10 w-full max-w-sm">
        <Wordmark />
        {(mode === "signin" || mode === "signup") && (
          // Pinned under the status bar on phones so the keyboard and the
          // browser's scroll-into-view never carry the avatar off screen.
          <div className="z-20 mt-4 flex justify-center pt-3 pb-2 max-md:sticky max-md:top-[env(safe-area-inset-top)] max-md:-mx-5 max-md:bg-background/85 max-md:backdrop-blur-md md:mt-7">
            <SyncAvatar mood={mood} look={look} pulse={pulse} size={isMobile ? 84 : 120} />
          </div>
        )}
        <h1 className={cn("text-3xl font-semibold", mode === "reset" ? "mt-6" : "mt-5")}>
          {mfa || emailMfa
            ? "Verify your sign-in"
            : otp
              ? "Check your code"
              : mode === "signin"
                ? "Welcome back"
                : mode === "signup"
                  ? "Create your account"
                  : mode === "update"
                    ? "Choose a new password"
                    : "Reset your password"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "update"
            ? "Enter a new password to finish resetting your account."
            : mode === "reset"
              ? method === "phone"
                ? "We’ll text you a code to verify your number and reset your password."
                : "We'll email you a link to set a new password."
              : "Your private answers stay yours. Groups only ever see whether a plan works."}
        </p>

        {!mfa && !emailMfa && !otp && (mode === "signin" || mode === "signup") ? (
          <>
            <div className="mt-7">
              <SocialButtons
                onGoogle={() => void signInWith("google")}
                pending={social}
                disabled={busy}
              />
            </div>
            <div className="my-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">or continue with</span>
              <span className="h-px flex-1 bg-border" />
            </div>
          </>
        ) : null}

        {notice ? (
          <p role="status" className="mt-4 text-sm text-primary">
            {notice}
          </p>
        ) : null}
        {formError ? (
          <p id="auth-error" role="alert" className="mt-4 text-sm text-destructive">
            {formError}
          </p>
        ) : null}
        {emailMfa ? (
          <div className="mt-6">
            <EmailSecondFactor
              onComplete={() => finishSignIn()}
              onCancel={() => {
                void supabase.auth.signOut().then(({ error }) => {
                  if (error) setFormError(error.message);
                  else {
                    setEmailMfa(false);
                    setPassword("");
                  }
                });
              }}
            />
          </div>
        ) : mfa ? (
          <div className="mt-6">
            <SecondFactor
              onComplete={() => {
                if (phoneRecovery) {
                  setMfa(false);
                  setMode("update");
                  return;
                }
                return finishSignIn();
              }}
              onCancel={() => {
                void supabase.auth.signOut().then(({ error }) => {
                  if (error) {
                    setFormError(error.message);
                    return;
                  }
                  setMfa(false);
                  setPhoneRecovery(false);
                  setMode("signin");
                  setPassword("");
                  setNotice(null);
                });
              }}
            />
          </div>
        ) : (
          <>
            {!otp && (mode === "signin" || mode === "signup" || mode === "reset") && (
              <div
                role="group"
                aria-label={mode === "reset" ? "Recovery method" : "Sign-in method"}
                className="relative mb-5 flex rounded-2xl bg-secondary p-1"
              >
                {/* One pill that slides between options, so the switch reads as
                    a single physical control rather than two buttons swapping fills. */}
                <span
                  aria-hidden="true"
                  className="segment-thumb absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-xl bg-card shadow-sm"
                  data-side={method === "phone" ? "end" : undefined}
                />
                {(["email", "phone"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={method === value}
                    disabled={busy || !!social}
                    onClick={() => {
                      setMethod(value);
                      setPassword("");
                      setFormError(null);
                      setNotice(null);
                    }}
                    className={cn(
                      "tap-target relative flex-1 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors",
                      method === value && "text-foreground",
                    )}
                  >
                    {value === "email" ? "Email" : "Phone number"}
                  </button>
                ))}
              </div>
            )}
            <VerificationFeedback
              accepted={accepted}
              onComplete={completeCode}
              className={otp ? "min-h-56" : undefined}
            >
              <form
                aria-describedby={formError ? "auth-error" : undefined}
                onSubmit={submit}
                className={mode === "reset" ? "mt-8 space-y-4" : "space-y-4"}
              >
                {otp ? (
                  <div className="auth-step">
                    <p className="mb-4 break-words text-sm text-muted-foreground">
                      Enter the code sent to {otp.destination}.
                    </p>
                    <CodeInput
                      value={code}
                      onChange={setCode}
                      error={!!formError}
                      errorId="auth-error"
                      disabled={busy}
                    />
                  </div>
                ) : (mode === "signin" || mode === "signup" || mode === "reset") &&
                  method === "phone" ? (
                  <label className="auth-step block text-sm font-medium">
                    Phone number
                    <input
                      type="tel"
                      required
                      autoComplete="tel"
                      placeholder="+1 415 555 2671"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      aria-describedby="phone-hint"
                      className="mt-1.5 w-full rounded-2xl border border-input bg-card px-3.5 py-3 outline-none focus:border-primary/60"
                    />
                    <span id="phone-hint" className="mt-2 block text-xs text-muted-foreground">
                      Include your country code. SMS charges may apply.
                    </span>
                  </label>
                ) : mode !== "update" ? (
                  <label className="block text-sm font-medium">
                    Email
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setPulse((n) => n + 1);
                        setLook(caretLook(e.target));
                        setOutcome(null);
                      }}
                      onSelect={(e) => setLook(caretLook(e.currentTarget))}
                      onFocus={(e) => {
                        setFocus("email");
                        setLook(caretLook(e.currentTarget));
                      }}
                      onBlur={() => setFocus(null)}
                      className="mt-1.5 w-full rounded-2xl border border-input bg-card px-3.5 py-3 outline-none transition-colors focus:border-primary/60"
                    />
                  </label>
                ) : null}
                {!otp &&
                  mode !== "reset" &&
                  !(mode === "signin" && method === "email" && emailCode) && (
                    <label className="block text-sm font-medium">
                      Password
                      <input
                        type="password"
                        required
                        minLength={6}
                        autoComplete={
                          mode === "signup" || mode === "update"
                            ? "new-password"
                            : "current-password"
                        }
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setPulse((n) => n + 1);
                          setOutcome(null);
                        }}
                        onFocus={() => setFocus("password")}
                        onBlur={() => setFocus(null)}
                        className="mt-1.5 w-full rounded-2xl border border-input bg-card px-3.5 py-3 outline-none transition-colors focus:border-primary/60"
                      />
                    </label>
                  )}
                <Button
                  type="submit"
                  loading={busy}
                  disabled={Boolean(social)}
                  orb="connecting"
                  className="w-full py-3.5"
                >
                  {otp
                    ? "Verify code"
                    : mode === "signin" && method === "email" && emailCode
                      ? "Send email code"
                      : mode === "signin"
                        ? "Log in"
                        : mode === "signup"
                          ? "Create account"
                          : mode === "update"
                            ? "Save new password"
                            : method === "phone"
                              ? "Send recovery code"
                              : "Send reset link"}
                </Button>
              </form>
            </VerificationFeedback>
            {otp && !accepted && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  disabled={busy || cooldown > 0}
                  onClick={() => void resendCode()}
                >
                  {cooldown ? `Send again in ${cooldown}s` : "Send a new code"}
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    setOtp(null);
                    setCode("");
                    setNotice(null);
                    setFormError(null);
                  }}
                >
                  Change details
                </Button>
              </div>
            )}
            {!otp && !accepted && mode === "signin" && method === "email" && (
              <button
                disabled={busy || !!social}
                type="button"
                className="tap-target mt-3 text-sm underline underline-offset-4"
                onClick={() => {
                  setEmailCode((v) => !v);
                  setPassword("");
                  setFormError(null);
                }}
              >
                {emailCode ? "Use your password instead" : "Email me a sign-in code"}
              </button>
            )}
          </>
        )}

        {!mfa && !emailMfa && !accepted && (
          <div className="mt-4 text-sm text-muted-foreground">
            {(mode === "signin" || mode === "signup") && (
              <button
                disabled={busy || !!social}
                onClick={() => changeMode(mode === "signin" ? "signup" : "signin")}
                className="inline-flex min-h-11 items-center underline underline-offset-4 transition-colors hover:text-foreground"
              >
                {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Log in"}
              </button>
            )}
            {mode !== "update" ? (
              <div>
                <button
                  disabled={busy || !!social}
                  onClick={() => changeMode(mode === "reset" ? "signin" : "reset")}
                  className="inline-flex min-h-11 items-center underline underline-offset-4 transition-colors hover:text-foreground"
                >
                  {mode === "reset" ? "Back to log in" : "Forgot your password?"}
                </button>
              </div>
            ) : null}
            <div>
              <Link
                to="/demo"
                className="inline-flex min-h-11 items-center underline underline-offset-4 transition-colors hover:text-foreground"
              >
                Just looking? Try the demo without an account
              </Link>
            </div>
          </div>
        )}

        {mode === "signup" && (
          <p className="mt-6 text-xs text-muted-foreground">
            By creating an account, you agree to Syncly's{" "}
            <Link to="/terms" className="underline underline-offset-4 hover:text-foreground">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link to="/privacy" className="underline underline-offset-4 hover:text-foreground">
              Privacy Policy
            </Link>
            .
          </p>
        )}
      </div>
    </div>
  );
}
