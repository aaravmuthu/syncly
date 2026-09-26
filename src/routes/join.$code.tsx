import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Wordmark } from "@/components/quorum/Wordmark";
import { AiActivity } from "@/components/quorum/ai/AiActivity";
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
      { title: "Join a group — Syncly" },
      {
        name: "description",
        content: "You've been invited to plan with a group on Syncly. Everyone answers privately.",
      },
      { property: "og:title", content: "Join a group — Syncly" },
      {
        property: "og:description",
        content: "Plan together without sharing anyone's private limits.",
      },
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
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const code = normalizeCode(raw);
    void (async () => {
      if (!isValidCode(code)) {
        setMessage("That invite link doesn't look right. Ask your friend to send it again.");
        setFailed(true);
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setPendingInvite(code);
        setMessage("Create an account to join this group…");
        void navigate({
          to: "/auth",
          search: { next: undefined, mode: "signup" as const },
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
        setMessage("That invite code doesn't match a group. Taking you to your groups…");
        setFailed(true);
        setTimeout(() => void navigate({ to: "/groups", replace: true }), 1600);
      }
    })();
  }, [raw, navigate]);

  return (
    <div className="paper-field grid min-h-dvh place-items-center px-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <Wordmark className="h-7" />
        <h1 className="text-lg font-semibold tracking-tight">Join a Syncly group</h1>
        {failed ? (
          <>
            <p role="alert" className="max-w-xs text-sm text-muted-foreground">
              {message}
            </p>
            <Link
              to="/groups"
              className="pressable active:pressable-active tap-target inline-flex items-center rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Go to your groups
            </Link>
          </>
        ) : (
          <AiActivity state="connecting" label={message} size={64} className="py-2" />
        )}
      </div>
    </div>
  );
}
