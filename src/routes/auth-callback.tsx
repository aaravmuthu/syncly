import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Wordmark } from "@/components/quorum/Wordmark";
import { safeRedirectPath } from "@/lib/safe-dom";
import { AiActivity } from "@/components/quorum/ai/AiActivity";

/**
 * Public landing spot for social sign-in. Waits for the session to hydrate,
 * then sends first-time users through onboarding and everyone else home.
 */
export const Route = createFileRoute("/auth-callback")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Signing you in — Syncly" },
      { name: "description", content: "Finishing your Syncly sign-in and loading your groups." },
      { property: "og:title", content: "Signing you in — Syncly" },
      { property: "og:description", content: "Finishing your Syncly sign-in." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" ? s.next : undefined,
  }),
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const target = safeRedirectPath(next, "/home");
  const [message, setMessage] = useState("Finishing sign-in…");

  useEffect(() => {
    let done = false;
    const go = async () => {
      if (done) return;
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      done = true;
      setMessage("Loading your account…");
      const { getMe } = await import("@/lib/quorum/plan.functions");
      try {
        const me = await getMe();
        void navigate({ to: me?.onboarded ? target : "/onboarding", replace: true });
      } catch {
        void navigate({ to: "/onboarding", replace: true });
      }
    };

    void go();
    const { data: sub } = supabase.auth.onAuthStateChange(() => void go());
    const timer = window.setTimeout(() => {
      if (!done)
        void navigate({
          to: "/auth",
          search: { next: undefined, mode: "signin" as const },
          replace: true,
        });
    }, 6000);

    return () => {
      sub.subscription.unsubscribe();
      window.clearTimeout(timer);
    };
  }, [navigate, target]);

  return (
    <div className="paper-field grid min-h-dvh place-items-center px-6">
      <div className="text-center">
        <Wordmark className="mx-auto h-7" />
        <h1 className="mt-6 text-lg font-semibold tracking-tight">Finishing your sign-in</h1>
        <AiActivity state="connecting" label={message} size={64} className="mt-2" />
      </div>
    </div>
  );
}
