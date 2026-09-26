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
let appliedInitialRoute = false;

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
      throw redirect({ to: "/auth", search: { next: "/home", mode: "signin" as const } });
    }

    if (!appliedInitialRoute && location.pathname === "/home") {
      appliedInitialRoute = true;
      let me: Awaited<ReturnType<typeof getMe>> | null = null;
      try {
        me = await getMe();
      } catch {
        me = null; // network hiccup on the routing check -- fall through to the normal teen home
      }
      if (me?.onboarded) {
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
