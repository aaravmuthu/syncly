/** Server-only helpers that drop safety/status cards into DM threads. */
import { canViewFriendLocation } from "./sharing";

export type DmSystemEvent = {
  /** Dedupe key: only one of each kind lands per profile every 30 minutes. */
  tag: "arrived" | "enroute" | "battery";
  content: string;
  lat?: number | null;
  lon?: number | null;
  label?: string | null;
};

/**
 * Sends status cards only to linked guardians and authorized location viewers.
 * Never throws — safety cards must not break the flow that triggered them.
 */
export async function broadcastDmSystemEvent(profileId: string, event: DmSystemEvent) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: threads } = await supabaseAdmin
      .from("direct_threads")
      .select("id, a_profile_id, b_profile_id")
      .or(`a_profile_id.eq.${profileId},b_profile_id.eq.${profileId}`);
    const [{ data: profile }, { data: shares }, { data: guardians }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("location_sharing_enabled, location_pause_indefinite, location_paused_until")
        .eq("id", profileId)
        .maybeSingle(),
      supabaseAdmin
        .from("location_shares")
        .select("viewer_profile_id, expires_at, hidden")
        .eq("owner_profile_id", profileId),
      supabaseAdmin
        .from("guardian_links")
        .select("guardian_profile_id")
        .eq("teen_profile_id", profileId),
    ]);
    const guardianIds = new Set((guardians ?? []).map((g) => g.guardian_profile_id));
    const allowed = new Set(
      (shares ?? [])
        .filter((share) => profile && canViewFriendLocation(profile, share))
        .map((share) => share.viewer_profile_id),
    );
    const ids = (threads ?? [])
      .filter((thread) => {
        const peer = thread.a_profile_id === profileId ? thread.b_profile_id : thread.a_profile_id;
        return guardianIds.has(peer) || allowed.has(peer);
      })
      .map((t) => t.id);
    if (ids.length === 0) return;

    const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: recent } = await supabaseAdmin
      .from("direct_messages")
      .select("thread_id, meta")
      .in("thread_id", ids)
      .eq("kind", "system")
      .eq("sender_id", profileId)
      .gte("created_at", since);
    const blocked = new Set(
      (recent ?? [])
        .filter((r) => (r.meta as { tag?: string } | null)?.tag === event.tag)
        .map((r) => r.thread_id as string),
    );

    const rows = ids
      .filter((id) => !blocked.has(id))
      .map((thread_id) => ({
        thread_id,
        sender_id: profileId,
        kind: "system",
        content: event.content,
        meta: {
          tag: event.tag,
          lat: event.lat ?? null,
          lon: event.lon ?? null,
          label: event.label ?? null,
        } as never,
      }));
    if (rows.length === 0) return;
    await supabaseAdmin.from("direct_messages").insert(rows);
  } catch (err) {
    console.error("[dm] system event failed", err);
  }
}
