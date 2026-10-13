import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { dbError } from "@/lib/db-error";

/** Actor identity comes exclusively from the authenticated server context. */
export async function changeGroupMembership(
  groupId: string,
  actorId: string,
  newOwnerId: string | undefined,
  leave: boolean,
) {
  const { data, error } = await supabaseAdmin.rpc("change_group_membership", {
    _group_id: groupId,
    _actor_id: actorId,
    _new_owner_id: newOwnerId ?? null,
    _leave: leave,
  });
  if (error) {
    const expected = [
      "Group not found",
      "You are not in this group",
      "Choose another member as the new owner",
      "Only the group owner can transfer ownership",
      "That member is not in this group",
      "Choose a new owner or delete the group before leaving",
    ];
    throw dbError(
      error,
      "changeGroupMembership",
      error.code === "P0001" && expected.includes(error.message) ? error.message : undefined,
    );
  }
  return data;
}
