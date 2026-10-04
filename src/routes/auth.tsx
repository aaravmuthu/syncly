import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import { safeRedirectPath } from "@/lib/safe-dom";
import { cn } from "@/lib/utils";

type Mode = "signin" | "signup" | "reset";
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
    mode: (s.mode === "signup" || s.mode === "reset" ? s.mode : "signin") as Mode,
  }),
  component: AuthPage,
});

function AuthPage() {
  const { next, mode: initialMode } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [social, setSocial] = useState<"google" | null>(null);
  const [checking, setChecking] = useState(true);
  const [focus, setFocus] = useState<Field | null>(null);
  const [look, setLook] = useState(0);
  const [pulse, setPulse] = useState(0);
  const [outcome, setOutcome] = useState<"success" | "error" | null>(null);

  const target = safeNext(next);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        window.location.href = target;
      } else {
        setChecking(false);
      }
    });
  }, [target]);

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
        options: { redirectTo: `${window.location.origin}/auth-callback` },
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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth`,
        });
        if (error) throw error;
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
          toast.success("Account created. Confirm your email, then log in.");
          setOutcome("success");
          setMode("signin");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      if (target.startsWith("/.lovable/")) {
        window.location.href = target;
      } else if (target === "/home") {
        // Let the callback decide between onboarding and the dashboard.
        void navigate({ to: "/auth-callback" });
      } else {
        void navigate({ to: target });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "We couldn't sign you in. Try again.");
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
        {mode !== "reset" && (
          <div className="mt-7 flex justify-center">
            <SyncAvatar mood={mood} look={look} pulse={pulse} />
          </div>
        )}
        <h1 className={cn("text-3xl font-semibold", mode === "reset" ? "mt-6" : "mt-5")}>
          {mode === "signin"
            ? "Welcome back"
            : mode === "signup"
              ? "Create your account"
              : "Reset your password"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "reset"
            ? "We'll email you a link to set a new password."
            : "Your private answers stay yours. Groups only ever see whether a plan works."}
        </p>

        {mode !== "reset" ? (
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
              <span className="text-xs text-muted-foreground">or sign in with email</span>
              <span className="h-px flex-1 bg-border" />
            </div>
          </>
        ) : null}

        <form onSubmit={submit} className={mode === "reset" ? "mt-8 space-y-4" : "space-y-4"}>
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
          {mode !== "reset" && (
            <label className="block text-sm font-medium">
              Password
              <input
                type="password"
                required
                minLength={6}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
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
          <Button type="submit" loading={busy} orb="connecting" className="w-full py-3.5">
            {mode === "signin"
              ? "Log in"
              : mode === "signup"
                ? "Create account"
                : "Send reset link"}
          </Button>
        </form>

        <div className="mt-4 text-sm text-muted-foreground">
          {mode !== "reset" && (
            <button
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="inline-flex min-h-11 items-center underline underline-offset-4 transition-colors hover:text-foreground"
            >
              {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Log in"}
            </button>
          )}
          <div>
            <button
              onClick={() => setMode(mode === "reset" ? "signin" : "reset")}
              className="inline-flex min-h-11 items-center underline underline-offset-4 transition-colors hover:text-foreground"
            >
              {mode === "reset" ? "Back to log in" : "Forgot your password?"}
            </button>
          </div>
          <div>
            <Link
              to="/demo"
              className="inline-flex min-h-11 items-center underline underline-offset-4 transition-colors hover:text-foreground"
            >
              Just looking? Try the demo without an account
            </Link>
          </div>
        </div>

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
