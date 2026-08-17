import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";




export const leaveGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { groupId: string; transferToProfileId?: string }) => d)
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
  .inputValidator((d: { groupId: string; toProfileId: string }) => d)
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
  .inputValidator((d: { groupId: string }) => d)
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
