import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as v from "./schemas";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveMyProfileId } from "./me";
import type { FriendProfile } from "./friend";

export const getFriendProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ profileId: v.id }))
  .handler(async ({ data, context }): Promise<FriendProfile> => {
    const me = await resolveMyProfileId(context.supabase);
    const { buildFriendProfile } = await import("./friend.server");
    return buildFriendProfile(me, data.profileId);
  });

export const getNicknames = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Record<string, string>> => {
    const me = await resolveMyProfileId(context.supabase);
    const { nicknameMap } = await import("./friend.server");
    return nicknameMap(me);
  });

export const setNickname = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ profileId: v.id, nickname: v.text(60) }))
  .handler(async ({ data, context }) => {
    const me = await resolveMyProfileId(context.supabase);
    const { saveNickname } = await import("./friend.server");
    return saveNickname(me, data.profileId, data.nickname);
  });

export const setContactGhost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ profileId: v.id, hidden: z.boolean() }))
  .handler(async ({ data, context }) => {
    const me = await resolveMyProfileId(context.supabase);
    const { setContactHidden } = await import("./friend.server");
    return setContactHidden(me, data.profileId, data.hidden);
  });

export const requestLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ profileId: v.id }))
  .handler(async ({ data, context }) => {
    const me = await resolveMyProfileId(context.supabase);
    const { requestLocationFrom } = await import("./friend.server");
    return requestLocationFrom(me, data.profileId);
  });
