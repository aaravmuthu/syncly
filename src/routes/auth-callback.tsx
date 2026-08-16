import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Wordmark } from "@/components/quorum/Wordmark";

/**
 * Public landing spot for social sign-in. Waits for the session to hydrate,
 * then sends first-time users through onboarding and everyone else home.
 */
export const Route = createFileRoute("/auth-callback")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Signing you in — Quorum" },
      { name: "description", content: "Finishing your Quorum sign-in and loading your groups." },
      { property: "og:title", content: "Signing you in — Quorum" },
      { property: "og:description", content: "Finishing your Quorum sign-in." },
    ],
  }),
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
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
        void navigate({ to: me?.onboarded ? "/home" : "/onboarding", replace: true });
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
  }, [navigate]);

  return (
    <div className="paper-field grid min-h-dvh place-items-center px-6">
      <div className="text-center">
        <Wordmark className="mx-auto h-7" />
        <p className="mt-6 inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {message}
        </p>
      </div>
    </div>
  );
}
