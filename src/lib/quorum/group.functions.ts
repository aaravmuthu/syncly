import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as v from "./schemas";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const leaveGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ groupId: v.id, transferToProfileId: v.id.optional() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: me } = await supabase.rpc("my_profile_id");
    if (!me) throw new Error("Profile missing");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: membership } = await supabaseAdmin
      .from("group_members")
      .select("role")
      .eq("group_id", data.groupId)
      .eq("profile_id", me as string)
      .maybeSingle();
    if (!membership) throw new Error("You are not in this group");

    if (membership.role === "owner") {
      if (!data.transferToProfileId) {
        throw new Error("Choose a new owner or delete the group before leaving");
      }
      const { data: next } = await supabaseAdmin
        .from("group_members")
        .select("profile_id")
        .eq("group_id", data.groupId)
        .eq("profile_id", data.transferToProfileId)
        .maybeSingle();
      if (!next) throw new Error("That member is not in this group");
      await supabaseAdmin
        .from("group_members")
        .update({ role: "owner" })
        .eq("group_id", data.groupId)
        .eq("profile_id", data.transferToProfileId);
      await supabaseAdmin
        .from("groups")
        .update({ created_by: data.transferToProfileId })
        .eq("id", data.groupId);
    }

    const { clearMemberFromGroupPlans } = await import("./group.server");
    await clearMemberFromGroupPlans(data.groupId, me as string);
    const { error } = await supabaseAdmin
      .from("group_members")
      .delete()
      .eq("group_id", data.groupId)
      .eq("profile_id", me as string);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("activity_events").insert({
      group_id: data.groupId,
      actor_profile_id: me as string,
      type: "member_left",
      message: "A member left the group",
    });
    return { ok: true, transferred: membership.role === "owner" };
  });

export const transferGroupOwnership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ groupId: v.id, toProfileId: v.id }))
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
    if (mine?.role !== "owner") throw new Error("Only the group owner can transfer ownership");

    const { data: next } = await supabaseAdmin
      .from("group_members")
      .select("profile_id")
      .eq("group_id", data.groupId)
      .eq("profile_id", data.toProfileId)
      .maybeSingle();
    if (!next) throw new Error("That member is not in this group");

    await supabaseAdmin
      .from("group_members")
      .update({ role: "owner" })
      .eq("group_id", data.groupId)
      .eq("profile_id", data.toProfileId);
    await supabaseAdmin
      .from("group_members")
      .update({ role: "member" })
      .eq("group_id", data.groupId)
      .eq("profile_id", me as string);
    await supabaseAdmin
      .from("groups")
      .update({ created_by: data.toProfileId })
      .eq("id", data.groupId);
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
    if (error) throw new Error(error.message);
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
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Uploads a group profile picture to storage and returns a long-lived URL. */
export const uploadGroupImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ dataUrl: v.dataUrl, ext: v.text(10).optional() }))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const match = /^data:([^;]+);base64,(.+)$/.exec(data.dataUrl);
    if (!match) throw new Error("Unsupported image");
    const contentType = match[1]!;
    if (!/^image\/(png|jpeg|jpg|gif|webp)$/.test(contentType)) {
      throw new Error("Use a PNG, JPG, GIF, or WebP image");
    }
    const bytes = Buffer.from(match[2]!, "base64");
    if (bytes.byteLength > 5 * 1024 * 1024) throw new Error("Image must be under 5 MB");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ext = (data.ext ?? "png").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "png";
    const path = `${userId}/groups/${Date.now()}.${ext}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("avatars")
      .upload(path, bytes, { contentType, upsert: true });
    if (upErr) throw new Error(upErr.message);
    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("avatars")
      .createSignedUrl(path, 60 * 60 * 24 * 3650);
    if (signErr || !signed) throw new Error(signErr?.message ?? "Could not read image back");
    return { url: signed.signedUrl };
  });
