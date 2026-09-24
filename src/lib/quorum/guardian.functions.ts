import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as v from "./schemas";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveMyProfileId } from "./me";


export const getMySyncCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await resolveMyProfileId(context.supabase);
    const { ensureSyncCode } = await import("./guardian.server");
    return ensureSyncCode(me);
  });

export const linkTeen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ code: v.text(20) }))
  .handler(async ({ data, context }) => {
    const me = await resolveMyProfileId(context.supabase);
    const { linkTeenByCode } = await import("./guardian.server");
    return linkTeenByCode(me, data.code);
  });

export const unlinkGuardian = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ linkId: v.id }))
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
    const me = await resolveMyProfileId(context.supabase);
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
    const me = await resolveMyProfileId(context.supabase);
    const { buildGuardianDashboard } = await import("./guardian.server");
    return buildGuardianDashboard(me);
  });

export const setLocationSharing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ enabled: z.boolean() }))
  .handler(async ({ data, context }) => {
    const me = await resolveMyProfileId(context.supabase);
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
    z.object({
      lat: v.lat,
      lon: v.lon,
      accuracyM: v.optAmount(1_000_000),
      batteryPct: v.optAmount(100),
      statusLabel: v.optText(80),
      planId: v.optId,
    }),
  )
  .handler(async ({ data, context }) => {
    const me = await resolveMyProfileId(context.supabase);
    // Sharing flags are private columns — read own row via the server client.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("location_sharing_enabled")
      .eq("id", me)
      .maybeSingle();

    if (!prof?.location_sharing_enabled) return { ok: false, reason: "sharing_off" as const };
    const { recordPing } = await import("./guardian.server");
    const result = await recordPing(me, data);
    const { broadcastDmSystemEvent } = await import("./dm.server");
    const { data: who } = await supabaseAdmin
      .from("profiles")
      .select("display_name")
      .eq("id", me)
      .maybeSingle();
    const name = who?.display_name ?? "They";
    if (typeof data.batteryPct === "number" && data.batteryPct <= 20) {
      await broadcastDmSystemEvent(me, {
        tag: "battery",
        content: `⚠️ ${name}'s battery is low (${data.batteryPct}%)`,
        lat: data.lat,
        lon: data.lon,
        label: name,
      });
    } else if (/driv|walk|way|en route/i.test(data.statusLabel ?? "")) {
      await broadcastDmSystemEvent(me, {
        tag: "enroute",
        content: `🚗 ${name} started en route`,
        lat: data.lat,
        lon: data.lon,
        label: name,
      });
    }
    return result;
  });


export const addSafeZone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      teenProfileId: v.id,
      label: v.reqText(80),
      kind: v.reqText(40),
      lat: v.lat,
      lon: v.lon,
      radiusM: v.amount(100_000),
    }),
  )
  .handler(async ({ data, context }) => {
    const me = await resolveMyProfileId(context.supabase);
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
  .inputValidator(z.object({ zoneId: v.id }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("safe_zones").delete().eq("id", data.zoneId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const decidePlanApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      approvalId: v.id,
      decision: z.enum(["approved", "approved_with_condition", "declined"]),
      condition: v.optText(500),
    }),
  )
  .handler(async ({ data, context }) => {
    const me = await resolveMyProfileId(context.supabase);
    const { decideApproval } = await import("./guardian.server");
    return decideApproval(me, data.approvalId, data.decision, data.condition ?? null);
  });

export const askForCheckin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ teenProfileId: v.id, note: v.optText(500) }))
  .handler(async ({ data, context }) => {
    const me = await resolveMyProfileId(context.supabase);
    const { requestCheckin } = await import("./guardian.server");
    return requestCheckin(me, data.teenProfileId, data.note ?? null);
  });

export const respondToCheckin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ id: v.id, lat: v.lat.nullish(), lon: v.lon.nullish(), placeLabel: v.optText(200) }),
  )
  .handler(async ({ data, context }) => {
    const me = await resolveMyProfileId(context.supabase);
    const { answerCheckin } = await import("./guardian.server");
    return answerCheckin(me, data);
  });

export const getMyCheckins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await resolveMyProfileId(context.supabase);
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
  .inputValidator(z.object({ planId: v.optId, reason: v.reqText(300), minutes: v.amount(24 * 60) }))
  .handler(async ({ data, context }) => {
    const me = await resolveMyProfileId(context.supabase);
    const { sendDelayPing } = await import("./guardian.server");
    return sendDelayPing(me, data);
  });

export const raiseSos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ lat: v.lat.nullish(), lon: v.lon.nullish(), note: v.optText(500) }))
  .handler(async ({ data, context }) => {
    const me = await resolveMyProfileId(context.supabase);
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
      body: data.note ?? "SOS sent from Syncly. Call them right away.",
      priority: "high",
    });
    return { ok: true };
  });

export const markRideLeaving = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ assignmentId: v.id }))
  .handler(async ({ data, context }) => {
    const me = await resolveMyProfileId(context.supabase);
    const { markRideDeparted } = await import("./guardian.server");
    return markRideDeparted(me, data.assignmentId);
  });

export const saveVehicleDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      assignmentId: v.id,
      vehicleDesc: v.optText(100),
      vehicleColor: v.optText(40),
      vehiclePlate: v.optText(20),
      etaMinutes: v.optAmount(24 * 60),
    }),
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
    const me = await resolveMyProfileId(context.supabase);
    const { error } = await context.supabase
      .from("guardian_alerts")
      .update({ read: true })
      .eq("guardian_profile_id", me)
      .eq("read", false);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Everything the teen-facing radar screen needs about themselves. */
export const getMyRadar = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await resolveMyProfileId(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: prof }, { data: zones }, { data: pings }, { data: guardians }] =
      await Promise.all([
        supabaseAdmin
          .from("profiles")
          .select("display_name, avatar_emoji, avatar_url, curfew_time, location_sharing_enabled")
          .eq("id", me)
          .maybeSingle(),

        context.supabase
          .from("safe_zones")
          .select("id, label, kind, lat, lon, radius_m")
          .eq("teen_profile_id", me),
        context.supabase
          .from("location_pings")
          .select("lat, lon, accuracy_m, battery_pct, status_label, created_at")
          .eq("profile_id", me)
          .order("created_at", { ascending: false })
          .limit(1),
        context.supabase
          .from("guardian_links")
          .select("id, guardian:profiles!guardian_links_guardian_profile_id_fkey(display_name)")
          .eq("teen_profile_id", me),
      ]);

    const ping = (pings ?? [])[0] ?? null;
    return {
      me: {
        id: me,
        name: (prof?.display_name as string) ?? "You",
        emoji: (prof?.avatar_emoji as string | null) ?? null,
        avatar_url: (prof?.avatar_url as string | null) ?? null,
        curfew: (prof?.curfew_time as string | null) ?? null,
        sharing: Boolean(prof?.location_sharing_enabled),
      },
      zones: (zones ?? []) as {
        id: string;
        label: string;
        kind: string;
        lat: number;
        lon: number;
        radius_m: number;
      }[],
      lastPing: ping as {
        lat: number;
        lon: number;
        accuracy_m: number | null;
        battery_pct: number | null;
        status_label: string | null;
        created_at: string;
      } | null,
      guardians: (guardians ?? []).length,
    };
  });

/** One-tap "I arrived safely" beacon: records the ping and pings guardians. */
export const arrivedSafely = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      lat: v.lat.nullish(),
      lon: v.lon.nullish(),
      batteryPct: v.optAmount(100),
      placeLabel: v.optText(200),
    }),
  )
  .handler(async ({ data, context }) => {
    const me = await resolveMyProfileId(context.supabase);
    const { alertGuardians, recordPing } = await import("./guardian.server");
    if (data.lat != null && data.lon != null) {
      await recordPing(me, {
        lat: data.lat,
        lon: data.lon,
        batteryPct: data.batteryPct ?? null,
        statusLabel: "Arrived safely",
      });
    }
    const { data: prof } = await context.supabase
      .from("profiles")
      .select("display_name")
      .eq("id", me)
      .maybeSingle();
    await alertGuardians(me, {
      type: "checkin",
      title: `${prof?.display_name ?? "Your teen"} arrived safely`,
      body: data.placeLabel ? `At ${data.placeLabel}` : "Location shared with you.",
      priority: "normal",
    });
    const { broadcastDmSystemEvent } = await import("./dm.server");
    await broadcastDmSystemEvent(me, {
      tag: "arrived",
      content: `📍 ${prof?.display_name ?? "They"} arrived safely${data.placeLabel ? ` at ${data.placeLabel}` : ""}`,
      lat: data.lat ?? null,
      lon: data.lon ?? null,
      label: data.placeLabel ?? null,
    });
    return { ok: true };
  });

