import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Remove a member's plan-level participation (votes, RSVPs, private constraints). */
export async function clearMemberFromGroupPlans(groupId: string, profileId: string) {
  const { data: plans } = await supabaseAdmin.from("plans").select("id").eq("group_id", groupId);
  const planIds = (plans ?? []).map((p) => p.id);
  if (!planIds.length) return;
  await supabaseAdmin.from("votes").delete().in("plan_id", planIds).eq("profile_id", profileId);
  await supabaseAdmin
    .from("plan_participants")
    .delete()
    .in("plan_id", planIds)
    .eq("profile_id", profileId);
  await supabaseAdmin
    .from("plan_constraints")
    .delete()
    .in("plan_id", planIds)
    .eq("profile_id", profileId);
}
