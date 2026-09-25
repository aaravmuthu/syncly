/** Server-only helpers for Squad Chat system event cards. */

export type SystemEvent =
  | { type: "plan_created"; content: string; meta?: Record<string, unknown> }
  | { type: "ride_update"; content: string; meta?: Record<string, unknown> }
  | { type: "plan_locked"; content: string; meta?: Record<string, unknown> };

/**
 * Drops an automated card into the squad chat feed. Never throws — chat cards
 * must not be able to break the plan flow that triggered them.
 */
export async function postSystemEvent(groupId: string, planId: string | null, event: SystemEvent) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("group_messages").insert({
      group_id: groupId,
      plan_id: planId,
      sender_id: null,
      content: event.content,
      system_type: event.type,
      meta: (event.meta ?? {}) as never,
    });
  } catch (err) {
    console.error("[chat] system event failed", err);
  }
}
