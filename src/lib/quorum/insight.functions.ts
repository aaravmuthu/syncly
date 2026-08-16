import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AVAILABILITY_SLOTS, type AvailabilityCell } from "./availability";
import type { ConstraintPayload } from "./types";
import type { Forecast } from "./weather";

/**
 * Aggregate availability for a plan. Reads private answers with elevated
 * access and returns ONLY counts — never who is free or why they aren't.
 */
export const getAvailabilityHeatmap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { planId: string }) => d)
  .handler(async ({ data, context }): Promise<{ cells: AvailabilityCell[]; answered: number; total: number }> => {
    const { data: allowed } = await context.supabase.rpc("can_see_plan", { _plan_id: data.planId });
    if (!allowed) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: participants } = await supabaseAdmin
      .from("plan_participants")
      .select("profile_id, attending")
      .eq("plan_id", data.planId);
    const { data: rows } = await supabaseAdmin
      .from("plan_constraints")
      .select("profile_id, payload")
      .eq("plan_id", data.planId);

    const attending = (participants ?? []).filter((p) => p.attending !== false);
    const total = attending.length;
    const marked = attending
      .map((p) => (rows ?? []).find((r) => r.profile_id === p.profile_id)?.payload as ConstraintPayload | undefined)
      .filter((p): p is ConstraintPayload => Boolean(p?.availability?.length));

    const cells: AvailabilityCell[] = AVAILABILITY_SLOTS.map((slot) => ({
      slot,
      free: marked.filter((m) => (m.availability ?? []).includes(slot)).length,
      total,
    }));

    return { cells, answered: marked.length, total };
  });

/** Live forecast for the plan's date and ZIP-anchored area. */
export const getPlanWeather = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { planId: string }) => d)
  .handler(async ({ data, context }): Promise<Forecast | null> => {
    const { data: allowed } = await context.supabase.rpc("can_see_plan", { _plan_id: data.planId });
    if (!allowed) return null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: plan } = await supabaseAdmin
      .from("plans")
      .select("location_area, window_start, group_id")
      .eq("id", data.planId)
      .maybeSingle();
    if (!plan) return null;

    const { normalizeZip } = await import("./location");
    let zip = normalizeZip(plan.location_area);
    if (!zip) {
      const { data: participants } = await supabaseAdmin
        .from("plan_participants")
        .select("profile_id")
        .eq("plan_id", data.planId);
      const ids = (participants ?? []).map((p) => p.profile_id);
      if (ids.length) {
        const { data: profiles } = await supabaseAdmin
          .from("profiles")
          .select("zip_code")
          .in("id", ids);
        zip = (profiles ?? []).map((p) => normalizeZip(p.zip_code)).find(Boolean) ?? null;
      }
    }
    if (!zip) return null;

    const { geocodeZipServer } = await import("./location.server");
    const origin = await geocodeZipServer(zip);
    if (!origin) return null;
    const { fetchForecast } = await import("./weather.server");
    return fetchForecast(origin.lat, origin.lon, plan.window_start);
  });

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("notifications")
      .select("id, type, title, body, read, plan_id, group_id, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    return data ?? [];
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ids?: string[] } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    const { data: me } = await context.supabase.rpc("my_profile_id");
    if (!me) return { ok: false };
    let q = context.supabase.from("notifications").update({ read: true }).eq("profile_id", me).eq("read", false);
    if (data.ids?.length) q = q.in("id", data.ids);
    await q;
    return { ok: true };
  });

/** Group memory: aggregate patterns used to pre-fill future plans. */
export const getGroupMemory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { groupId: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: allowed } = await context.supabase.rpc("is_group_member", { _group_id: data.groupId });
    if (!allowed) return null;
    const { data: row } = await context.supabase
      .from("group_preferences")
      .select("*")
      .eq("group_id", data.groupId)
      .maybeSingle();
    return row;
  });
