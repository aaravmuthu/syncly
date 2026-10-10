import { LEGAL } from "@/lib/legal";
import { needsAccountVerification } from "@/lib/auth-security";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getMe } from "@/lib/quorum/plan.functions";
import { getLastContext } from "@/components/quorum/last-context";
import { AiActivity } from "@/components/quorum/ai/AiActivity";

// Which shell (My Squad vs. Family Hub) someone lands in is decided here,
// once per browser session -- applied only the first time /home is visited
// (the universal post-login landing target), never on later navigation, so
// it doesn't fight ContextSwitcher's explicit "My Squad" choice or hijack a
// direct deep link. Resets on a full page reload, which is fine: that's
// effectively a new session anyway.
let initialRouteUserId: string | null = null;
let verifiedSessionToken: string | null = null;

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    // getSession() reads the persisted/auto-refreshed session locally --
    // getUser() instead hits Supabase's auth server over the network, and
    // since this beforeLoad reruns on every navigation in the authenticated
    // tree, that was adding a network round-trip to every single tab switch.
    const { data, error } = await supabase.auth.getSession();
    const user = data.session?.user ?? null;
    if (error || !user) {
      initialRouteUserId = null;
      throw redirect({ to: "/auth", search: { next: location.href, mode: "signin" as const } });
    }

    // Only re-check verification when the session token changes: once a session
    // passes, later tab switches skip the network round-trip. The server
    // (requireSupabaseAuth) still enforces MFA on every data call, so a
    // transient failure here falls through instead of showing an error screen.
    const token = data.session?.access_token ?? null;
    if (token !== verifiedSessionToken) {
      let needs = false;
      try {
        needs = await needsAccountVerification();
        if (!needs) verifiedSessionToken = token;
      } catch {
        needs = false;
      }
      if (needs) {
        throw redirect({ to: "/auth", search: { next: location.href, mode: "signin" as const } });
      }
    }

    if (
      location.pathname !== "/agreement" &&
      user.app_metadata?.terms_version !== LEGAL.effectiveDate
    ) {
      throw redirect({ to: "/agreement", search: { next: location.href } });
    }

    if (initialRouteUserId !== user.id && location.pathname === "/home") {
      let me: Awaited<ReturnType<typeof getMe>> | null = null;
      try {
        me = await getMe();
      } catch {
        me = null; // network hiccup on the routing check -- fall through to the normal teen home
      }
      if (me?.onboarded) {
        initialRouteUserId = user.id;
        const last = getLastContext();
        // hasLinkedTeens=false: land on whichever shell matches signup intent
        // (Family Hub shows its own empty "link your first teen" state).
        // hasLinkedTeens=true: land on whichever shell was used last,
        // falling back to signup intent the first time both are available.
        const wantsFamily = me.hasLinkedTeens
          ? last === "family" || (last === null && me.account_type === "guardian")
          : me.account_type === "guardian";
        if (wantsFamily) throw redirect({ to: "/guardian" });
      }
    }

    return { user };
  },
  // ssr:false means the server has nothing to paint here, and the session
  // check above can take a beat on a cold load -- without this the whole
  // screen sat solid black until it resolved.
  pendingComponent: () => (
    <div className="paper-field grid min-h-dvh place-items-center">
      <AiActivity state="connecting" label="Opening Syncly…" size={64} />
    </div>
  ),
  component: () => <Outlet />,
});
