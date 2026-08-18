import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Resolve the caller's profile row id from their auth session. */
async function myProfileId(supabase: {
  rpc: (fn: "my_profile_id") => Promise<{ data: string | null }>;
}) {
  const { data } = await supabase.rpc("my_profile_id");
  if (!data) throw new Error("Profile missing");
  return data;
}

export const getMySyncCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await myProfileId(context.supabase);
    const { ensureSyncCode } = await import("./guardian.server");
    return { code: await ensureSyncCode(me) };
  });

export const linkTeen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { code: string }) => d)
  .handler(async ({ data, context }) => {
    const me = await myProfileId(context.supabase);
    const { linkTeenByCode } = await import("./guardian.server");
    return linkTeenByCode(me, data.code);
  });

export const unlinkGuardian = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { linkId: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("guardian_links")
      .delete()
      .eq("id", data.linkId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyGuardians = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await myProfileId(context.supabase);
    const { data, error } = await context.supabase
      .from("guardian_links")
      .select(
        "id, relation, created_at, guardian:profiles!guardian_links_guardian_profile_id_fkey(display_name, avatar_emoji, avatar_url)",
      )
      .eq("teen_profile_id", me);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getGuardianHub = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await myProfileId(context.supabase);
    const { buildGuardianDashboard } = await import("./guardian.server");
    return buildGuardianDashboard(me);
  });

export const setLocationSharing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { enabled: boolean }) => d)
  .handler(async ({ data, context }) => {
    const me = await myProfileId(context.supabase);
    const { error } = await context.supabase
      .from("profiles")
      .update({ location_sharing_enabled: data.enabled })
      .eq("id", me);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const pushLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      lat: number;
      lon: number;
      accuracyM?: number | null;
      batteryPct?: number | null;
      statusLabel?: string | null;
      planId?: string | null;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const me = await myProfileId(context.supabase);
    const { data: prof } = await context.supabase
      .from("profiles")
      .select("location_sharing_enabled")
      .eq("id", me)
      .maybeSingle();
    if (!prof?.location_sharing_enabled) return { ok: false, reason: "sharing_off" as const };
    const { recordPing } = await import("./guardian.server");
    return recordPing(me, data);
  });

export const addSafeZone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      teenProfileId: string;
      label: string;
      kind: string;
      lat: number;
      lon: number;
      radiusM: number;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const me = await myProfileId(context.supabase);
    const { assertLinked } = await import("./guardian.server");
    await assertLinked(me, data.teenProfileId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("safe_zones").insert({
      teen_profile_id: data.teenProfileId,
      created_by: me,
      label: data.label,
      kind: data.kind,
      lat: data.lat,
      lon: data.lon,
      radius_m: data.radiusM,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeSafeZone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { zoneId: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("safe_zones").delete().eq("id", data.zoneId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const decidePlanApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      approvalId: string;
      decision: "approved" | "approved_with_condition" | "declined";
      condition?: string | null;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const me = await myProfileId(context.supabase);
    const { decideApproval } = await import("./guardian.server");
    return decideApproval(me, data.approvalId, data.decision, data.condition ?? null);
  });

export const askForCheckin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { teenProfileId: string; note?: string | null }) => d)
  .handler(async ({ data, context }) => {
    const me = await myProfileId(context.supabase);
    const { requestCheckin } = await import("./guardian.server");
    return requestCheckin(me, data.teenProfileId, data.note ?? null);
  });

export const respondToCheckin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { id: string; lat?: number | null; lon?: number | null; placeLabel?: string | null }) => d,
  )
  .handler(async ({ data, context }) => {
    const me = await myProfileId(context.supabase);
    const { answerCheckin } = await import("./guardian.server");
    return answerCheckin(me, data);
  });

export const getMyCheckins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await myProfileId(context.supabase);
    const { data, error } = await context.supabase
      .from("checkin_requests")
      .select("id, status, note, created_at")
      .eq("teen_profile_id", me)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const sendDelay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { planId?: string | null; reason: string; minutes: number }) => d)
  .handler(async ({ data, context }) => {
    const me = await myProfileId(context.supabase);
    const { sendDelayPing } = await import("./guardian.server");
    return sendDelayPing(me, data);
  });

export const raiseSos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { lat?: number | null; lon?: number | null; note?: string | null }) => d)
  .handler(async ({ data, context }) => {
    const me = await myProfileId(context.supabase);
    const { alertGuardians, recordPing } = await import("./guardian.server");
    if (data.lat != null && data.lon != null) {
      await recordPing(me, { lat: data.lat, lon: data.lon, statusLabel: "SOS" });
    }
    const { data: prof } = await context.supabase
      .from("profiles")
      .select("display_name")
      .eq("id", me)
      .maybeSingle();
    await alertGuardians(me, {
      type: "sos",
      title: `${prof?.display_name ?? "Your teen"} needs help now`,
      body: data.note ?? "SOS sent from Quorum. Call them right away.",
      priority: "high",
    });
    return { ok: true };
  });

export const markRideLeaving = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { assignmentId: string }) => d)
  .handler(async ({ data, context }) => {
    const me = await myProfileId(context.supabase);
    const { markRideDeparted } = await import("./guardian.server");
    return markRideDeparted(me, data.assignmentId);
  });

export const saveVehicleDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      assignmentId: string;
      vehicleDesc?: string | null;
      vehicleColor?: string | null;
      vehiclePlate?: string | null;
      etaMinutes?: number | null;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("transport_assignments")
      .update({
        vehicle_desc: data.vehicleDesc ?? null,
        vehicle_color: data.vehicleColor ?? null,
        vehicle_plate: data.vehiclePlate ?? null,
        eta_minutes: data.etaMinutes ?? null,
      })
      .eq("id", data.assignmentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markAlertsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await myProfileId(context.supabase);
    const { error } = await context.supabase
      .from("guardian_alerts")
      .update({ read: true })
      .eq("guardian_profile_id", me)
      .eq("read", false);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
