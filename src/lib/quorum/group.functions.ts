import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as v from "./schemas";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { dbError, UPLOAD_FAILED } from "@/lib/db-error";

export const leaveGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ groupId: v.id, transferToProfileId: v.id.optional() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: me } = await supabase.rpc("my_profile_id");
    if (!me) throw new Error("Profile missing");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { changeGroupMembership } = await import("./group.server");
    const transferred = await changeGroupMembership(
      data.groupId,
      me,
      data.transferToProfileId,
      true,
    );

    await supabaseAdmin.from("activity_events").insert({
      group_id: data.groupId,
      actor_profile_id: me as string,
      type: "member_left",
      message: "A member left the group",
    });
    return { ok: true, transferred };
  });

export const transferGroupOwnership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ groupId: v.id, toProfileId: v.id }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: me } = await supabase.rpc("my_profile_id");
    if (!me) throw new Error("Profile missing");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { changeGroupMembership } = await import("./group.server");
    await changeGroupMembership(data.groupId, me, data.toProfileId, false);
    await supabaseAdmin.from("activity_events").insert({
      group_id: data.groupId,
      actor_profile_id: me as string,
      type: "ownership_transferred",
      message: "Group ownership was transferred",
    });
    return { ok: true };
  });

export const deleteGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ groupId: v.id }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: me } = await supabase.rpc("my_profile_id");
    if (!me) throw new Error("Profile missing");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: mine } = await supabaseAdmin
      .from("group_members")
      .select("role")
      .eq("group_id", data.groupId)
      .eq("profile_id", me as string)
      .maybeSingle();
    if (mine?.role !== "owner") throw new Error("Only the group owner can delete this group");

    // Plans, votes, members, activity and preferences cascade from these deletes.
    await supabaseAdmin.from("plans").delete().eq("group_id", data.groupId);
    const { error } = await supabaseAdmin.from("groups").delete().eq("id", data.groupId);
    if (error) throw dbError(error, "deleteGroup");
    return { ok: true };
  });

/** Owner/admin-only: rename a circle and restyle its avatar + cover banner. */
export const updateGroupLook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      groupId: v.id,
      name: v.reqText(80).optional(),
      emoji: v.emoji.optional(),
      avatarUrl: v.optHttpsUrl,
      coverTheme: v.text(40).optional(),
      kind: z.enum(["permanent", "temporary"]).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: admin } = await supabase.rpc("is_group_admin", { _group_id: data.groupId });
    if (!admin) throw new Error("Only circle admins can change this");
    const patch: {
      name?: string;
      emoji?: string;
      avatar_url?: string | null;
      cover_theme?: string;
      kind?: "permanent" | "temporary";
    } = {};
    if (data.name != null && data.name.trim()) patch.name = data.name.trim().slice(0, 60);
    if (data.emoji != null) patch.emoji = data.emoji.slice(0, 8);
    if (data.avatarUrl !== undefined) patch.avatar_url = data.avatarUrl;
    if (data.coverTheme != null) patch.cover_theme = data.coverTheme.slice(0, 40);
    if (data.kind != null) patch.kind = data.kind;
    if (!Object.keys(patch).length) return { ok: true };
    const { error } = await supabase.from("groups").update(patch).eq("id", data.groupId);
    if (error) throw dbError(error, "updateGroupLook");
    return { ok: true };
  });

/** Uploads a group profile picture to storage and returns a long-lived URL. */
export const uploadGroupImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ dataUrl: v.dataUrl, ext: v.text(10).optional() }))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { parseImageUpload } = await import("./upload-safety.server");
    const { bytes, contentType, ext } = parseImageUpload(data.dataUrl);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const path = `${userId}/groups/${Date.now()}.${ext}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("avatars")
      .upload(path, bytes, { contentType, upsert: true });
    if (upErr) throw dbError(upErr, "uploadGroupImage", UPLOAD_FAILED);
    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("avatars")
      .createSignedUrl(path, 60 * 60 * 24 * 3650);
    if (signErr || !signed)
      throw signErr ? dbError(signErr, "uploadGroupImage") : new Error("Could not read image back");
    return { url: signed.signedUrl };
  });
