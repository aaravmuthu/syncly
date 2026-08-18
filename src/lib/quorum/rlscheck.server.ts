import type { SupabaseClient } from "@supabase/supabase-js";

export type RlsCheck = { name: string; passed: boolean; detail: string };

type AnyClient = SupabaseClient<any, any, any>;

/**
 * Lightweight runtime RLS probe.
 *
 * Seeds throwaway rows that belong to a synthetic "other user", then tries to
 * update/delete them with the CALLER's own (RLS-enforced) client. Every attempt
 * must affect zero rows or error. Nothing real is ever touched, and the probe
 * rows are removed afterwards with the service role.
 */
export async function runRlsProbe(userClient: AnyClient, myProfileId: string): Promise<RlsCheck[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as unknown as AnyClient;
  const checks: RlsCheck[] = [];
  const add = (name: string, passed: boolean, detail: string) =>
    checks.push({ name, passed, detail });

  // --- seed a foreign profile + a foreign notification -----------------------
  const { data: probeProfile, error: pErr } = await admin
    .from("profiles")
    .insert({ display_name: "RLS probe (temp)", avatar_emoji: "🧪", is_demo: true })
    .select("id, display_name")
    .single();
  if (pErr || !probeProfile) {
    return [{ name: "probe setup", passed: false, detail: pErr?.message ?? "could not seed" }];
  }
  const otherId = probeProfile.id as string;

  const { data: probeNotif } = await admin
    .from("notifications")
    .insert({
      profile_id: otherId,
      type: "rls_probe",
      title: "RLS probe",
      body: "temporary row",
    })
    .select("id, read, title")
    .single();

  try {
    // 1. reading another user's notifications
    const { data: readRows, error: readErr } = await userClient
      .from("notifications")
      .select("id")
      .eq("profile_id", otherId);
    add(
      "notifications · SELECT another user's rows",
      Boolean(readErr) || (readRows ?? []).length === 0,
      readErr ? `blocked (${readErr.code ?? "error"})` : `${(readRows ?? []).length} rows visible`,
    );

    if (probeNotif) {
      // 2. updating another user's notification
      const { data: updRows, error: updErr } = await userClient
        .from("notifications")
        .update({ read: true })
        .eq("id", probeNotif.id)
        .select("id");
      const { data: afterUpd } = await admin
        .from("notifications")
        .select("read")
        .eq("id", probeNotif.id)
        .maybeSingle();
      add(
        "notifications · UPDATE another user's row",
        (Boolean(updErr) || (updRows ?? []).length === 0) && afterUpd?.read === false,
        updErr ? `blocked (${updErr.code ?? "error"})` : `${(updRows ?? []).length} rows updated`,
      );

      // 3. deleting another user's notification
      const { data: delRows, error: delErr } = await userClient
        .from("notifications")
        .delete()
        .eq("id", probeNotif.id)
        .select("id");
      const { data: afterDel } = await admin
        .from("notifications")
        .select("id")
        .eq("id", probeNotif.id)
        .maybeSingle();
      add(
        "notifications · DELETE another user's row",
        (Boolean(delErr) || (delRows ?? []).length === 0) && Boolean(afterDel),
        delErr ? `blocked (${delErr.code ?? "error"})` : `${(delRows ?? []).length} rows deleted`,
      );
    }

    // 4. renaming somebody else's profile
    const { data: profUpd, error: profErr } = await userClient
      .from("profiles")
      .update({ display_name: "hijacked" })
      .eq("id", otherId)
      .select("id");
    const { data: afterProf } = await admin
      .from("profiles")
      .select("display_name")
      .eq("id", otherId)
      .maybeSingle();
    add(
      "profiles · UPDATE another user's profile",
      (Boolean(profErr) || (profUpd ?? []).length === 0) &&
        afterProf?.display_name === probeProfile.display_name,
      profErr ? `blocked (${profErr.code ?? "error"})` : `${(profUpd ?? []).length} rows updated`,
    );

    // 5. deleting a profile at all (no DELETE policy exists)
    const { data: profDel, error: profDelErr } = await userClient
      .from("profiles")
      .delete()
      .eq("id", otherId)
      .select("id");
    const { data: stillThere } = await admin
      .from("profiles")
      .select("id")
      .eq("id", otherId)
      .maybeSingle();
    add(
      "profiles · DELETE another user's profile",
      (Boolean(profDelErr) || (profDel ?? []).length === 0) && Boolean(stillThere),
      profDelErr
        ? `blocked (${profDelErr.code ?? "error"})`
        : `${(profDel ?? []).length} rows deleted`,
    );

    // 6. parent approval tokens must never leak to non-owners
    const me = myProfileId;
    const { data: tokenRows, error: tokenErr } = await userClient
      .from("parent_approvals")
      .select("id, token")
      .limit(20);
    const ids = (tokenRows ?? []).map((r: { id: string }) => r.id);
    const { data: ownerRows } = ids.length
      ? await admin.from("parent_approvals").select("id, profile_id").in("id", ids)
      : { data: [] as { id: string; profile_id: string }[] };
    const leaked = (ownerRows ?? []).filter(
      (r: { profile_id: string }) => r.profile_id !== me,
    ).length;
    add(
      "parent_approvals · token exposure",
      Boolean(tokenErr) || leaked === 0,
      tokenErr
        ? `blocked (${tokenErr.code ?? "error"})`
        : `${leaked} of ${ids.length} readable rows belong to someone else`,
    );

    // 7. group messages owned by others cannot be edited or removed
    const { data: foreignMsg } = await admin
      .from("group_messages")
      .select("id, content")
      .neq("sender_id", otherId)
      .limit(1)
      .maybeSingle();
    if (foreignMsg) {
      const { data: msgUpd, error: msgErr } = await userClient
        .from("group_messages")
        .update({ content: foreignMsg.content })
        .eq("id", foreignMsg.id)
        .neq("sender_id", me)
        .select("id");
      add(
        "group_messages · UPDATE someone else's message",
        Boolean(msgErr) || (msgUpd ?? []).length === 0,
        msgErr ? `blocked (${msgErr.code ?? "error"})` : `${(msgUpd ?? []).length} rows updated`,
      );
    }
  } finally {
    if (probeNotif) await admin.from("notifications").delete().eq("id", probeNotif.id);
    await admin.from("profiles").delete().eq("id", otherId);
  }

  return checks;
}

