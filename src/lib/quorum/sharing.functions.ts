import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveMyProfileId } from "./me";
import type { FriendPin, GhostChoice, ShareMode, SharePeer, SharingState } from "./sharing";

export const getFriendPins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FriendPin[]> => {
    const me = await resolveMyProfileId(context.supabase);
    const { buildFriendPins } = await import("./sharing.server");
    return buildFriendPins(me);
  });

export const getSharePeers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SharePeer[]> => {
    const me = await resolveMyProfileId(context.supabase);
    const { listSharePeers } = await import("./sharing.server");
    return listSharePeers(me);
  });

export const getSharingState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SharingState> => {
    const me = await resolveMyProfileId(context.supabase);
    const { getSharingState: read } = await import("./sharing.server");
    return read(me);
  });

export const shareLocationWith = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { viewerProfileId: string; mode: ShareMode }) => d)
  .handler(async ({ data, context }) => {
    const me = await resolveMyProfileId(context.supabase);
    const { setShare } = await import("./sharing.server");
    return setShare(me, data.viewerProfileId, data.mode);
  });

export const stopSharingWith = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { viewerProfileId: string }) => d)
  .handler(async ({ data, context }) => {
    const me = await resolveMyProfileId(context.supabase);
    const { stopShare } = await import("./sharing.server");
    return stopShare(me, data.viewerProfileId);
  });

export const stopWatchingFriend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ownerProfileId: string }) => d)
  .handler(async ({ data, context }) => {
    const me = await resolveMyProfileId(context.supabase);
    const { stopWatching } = await import("./sharing.server");
    return stopWatching(me, data.ownerProfileId);
  });

export const setGhostMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { choice: GhostChoice }) => d)
  .handler(async ({ data, context }) => {
    const me = await resolveMyProfileId(context.supabase);
    const { setGhostMode: apply } = await import("./sharing.server");
    return apply(me, data.choice);
  });

export const nudgeFriendPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { profileId: string }) => d)
  .handler(async ({ data, context }) => {
    const me = await resolveMyProfileId(context.supabase);
    const { nudgeFriend } = await import("./sharing.server");
    return nudgeFriend(me, data.profileId);
  });
