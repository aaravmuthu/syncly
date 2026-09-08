import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/quorum/AppShell";

// Pathless layout for the "My Squad" tab-bar experience: mounts the header,
// bottom nav, notification subscription and friend-nickname context ONCE,
// so they persist across navigation between Home/Groups/Radar/Plans/Chats
// instead of tearing down and remounting (and re-opening a realtime
// websocket) on every tab switch. Guardian's Family Hub has its own shell
// and stays a direct sibling of this layout.
export const Route = createFileRoute("/_authenticated/_app")({
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
