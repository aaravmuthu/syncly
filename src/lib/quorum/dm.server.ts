/** Server-only helpers that drop safety/status cards into DM threads. */

export type DmSystemEvent = {
  /** Dedupe key: only one of each kind lands per profile every 30 minutes. */
  tag: "arrived" | "enroute" | "battery";
  content: string;
  lat?: number | null;
  lon?: number | null;
  label?: string | null;
};

/**
 * Fans a status card out to every existing 1-on-1 thread the profile is part of.
 * Never throws — safety cards must not break the flow that triggered them.
 */
export async function broadcastDmSystemEvent(profileId: string, event: DmSystemEvent) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: threads } = await supabaseAdmin
      .from("direct_threads")
      .select("id")
      .or(`a_profile_id.eq.${profileId},b_profile_id.eq.${profileId}`);
    const ids = (threads ?? []).map((t) => t.id as string);
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
