import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Wordmark } from "@/components/quorum/Wordmark";
import { Spinner } from "@/components/quorum/ui";
import { supabase } from "@/integrations/supabase/client";
import { isValidCode, normalizeCode, setPendingInvite } from "@/lib/quorum/invite";

/**
 * Public invite landing. Signed-in users join immediately; everyone else has the
 * code stashed and is picked back up after auth/onboarding.
 */
export const Route = createFileRoute("/join/$code")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Join a group — Quorum" },
      {
        name: "description",
        content: "You've been invited to plan with a group on Quorum. Everyone answers privately.",
      },
      { property: "og:title", content: "Join a group — Quorum" },
      { property: "og:description", content: "Plan together without sharing anyone's private limits." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: JoinPage,
});

function JoinPage() {
  const { code: raw } = Route.useParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState("Checking that invite…");

  useEffect(() => {
    const code = normalizeCode(raw);
    void (async () => {
      if (!isValidCode(code)) {
        setMessage("That invite link doesn't look right.");
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setPendingInvite(code);
        setMessage("Sign in to join this group…");
        void navigate({
          to: "/auth",
          search: { next: undefined, mode: "signin" as const },
          replace: true,
        });
        return;
      }
      setMessage("Adding you to the group…");
      const { joinGroup } = await import("@/lib/quorum/plan.functions");
      try {
        const group = (await joinGroup({ data: { code } })) as { id: string };
        void navigate({ to: "/groups/$groupId", params: { groupId: group.id }, replace: true });
      } catch {
        setMessage("That invite code doesn't match a group.");
        setTimeout(() => void navigate({ to: "/groups", replace: true }), 1600);
      }
    })();
  }, [raw, navigate]);

  return (
    <div className="paper-field grid min-h-dvh place-items-center px-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <Wordmark className="h-7" />
        <Spinner className="h-5 w-5" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
