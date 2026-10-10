import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json, Database } from "@/integrations/supabase/types";

// Explicit ownership filters supplement RLS. Never use the service-role client here.
export const EXPORT_TABLES = {
  groups: "created_by",
  plans: "created_by",
  activity_events: "actor_profile_id",
  group_members: "profile_id",
  group_messages: "sender_id",
  direct_messages: "sender_id",
  direct_reads: "profile_id",
  direct_reactions: "profile_id",
  contact_nicknames: "owner_profile_id",
  notifications: "profile_id",
  message_reads: "profile_id",
  transport_profiles: "profile_id",
  location_pings: "profile_id",
  location_shares: "owner_profile_id",
  saved_places: "profile_id",
  plan_constraints: "profile_id",
  plan_participants: "profile_id",
  votes: "profile_id",
  delay_pings: "profile_id",
  geofence_events: "profile_id",
  plan_conflicts: "profile_id",
} as const;

export async function exportOwnedRows(db: SupabaseClient<Database>, profileId: string) {
  const records: Record<string, Json[]> = {};
  // Serial pages avoid overwhelming the database for a large location history.
  for (const [table, column] of Object.entries(EXPORT_TABLES)) {
    const rows: Json[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await db
        .from(table as keyof typeof EXPORT_TABLES)
        .select("*")
        .eq(column as never, profileId)
        .order(
          table === "transport_profiles"
            ? "profile_id"
            : table === "message_reads"
              ? "message_id"
              : table === "direct_reads"
                ? "thread_id"
                : table === "contact_nicknames"
                  ? "target_profile_id"
                  : "id",
        )
        .range(offset, offset + 499);
      if (error) throw new Error(`Could not export ${table}. Please try again or contact support.`);
      rows.push(...(data ?? []));
      if (!data || data.length < 500) break;
    }
    records[table] = rows;
  }
  return records;
}

// These tables deny full SELECT to ordinary users. Privileged reads are strictly
// limited to the authenticated caller, independently of group membership.
export async function exportPrivateAccountRows(db: SupabaseClient<Database>, profileId: string) {
  const { data: family, error } = await db
    .from("family_plans")
    .select("*")
    .eq("profile_id", profileId);
  if (error) throw new Error("Could not export your family plan. Please try again.");
  const approvals: Json[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db
      .from("parent_approvals")
      .select(
        "id,plan_id,profile_id,status,parent_name,parent_email,condition_text,created_at,expires_at,responded_at,decided_via",
      )
      .eq("profile_id", profileId)
      .order("id")
      .range(offset, offset + 499);
    if (error) throw new Error("Could not export your approvals. Please try again.");
    approvals.push(...(data ?? []));
    if (!data || data.length < 500) break;
  }
  return { family_plans: family ?? [], parent_approvals: approvals };
}
