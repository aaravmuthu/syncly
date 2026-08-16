// Server-only notification fan-out. Notification copy is always group-safe:
// it never names a member's private constraint or why an option failed.

export type NotifyKind =
  | "plan_created"
  | "all_answered"
  | "recommendations_ready"
  | "vote_cast"
  | "plan_finalized"
  | "parent_response"
  | "member_joined";

export async function notifyProfiles(
  profileIds: string[],
  payload: { type: NotifyKind; title: string; body?: string; planId?: string | null; groupId?: string | null },
) {
  const ids = [...new Set(profileIds.filter(Boolean))];
  if (!ids.length) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("notifications").insert(
    ids.map((profile_id) => ({
      profile_id,
      type: payload.type,
      title: payload.title,
      body: payload.body ?? null,
      plan_id: payload.planId ?? null,
      group_id: payload.groupId ?? null,
    })),
  );
}

/** Notifies every participant of a plan, optionally skipping the actor. */
export async function notifyPlanParticipants(
  planId: string,
  payload: { type: NotifyKind; title: string; body?: string; exclude?: string | null },
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: plan } = await supabaseAdmin
    .from("plans")
    .select("group_id")
    .eq("id", planId)
    .maybeSingle();
  const { data: participants } = await supabaseAdmin
    .from("plan_participants")
    .select("profile_id")
    .eq("plan_id", planId);
  const ids = (participants ?? [])
    .map((p) => p.profile_id)
    .filter((id) => id !== payload.exclude);
  await notifyProfiles(ids, {
    type: payload.type,
    title: payload.title,
    ...(payload.body ? { body: payload.body } : {}),
    planId,
    groupId: plan?.group_id ?? null,
  });
}

/** Notifies every member of a group. */
export async function notifyGroupMembers(
  groupId: string,
  payload: { type: NotifyKind; title: string; body?: string; exclude?: string | null },
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: members } = await supabaseAdmin
    .from("group_members")
    .select("profile_id")
    .eq("group_id", groupId);
  const ids = (members ?? []).map((m) => m.profile_id).filter((id) => id !== payload.exclude);
  await notifyProfiles(ids, {
    type: payload.type,
    title: payload.title,
    ...(payload.body ? { body: payload.body } : {}),
    groupId,
  });
}
