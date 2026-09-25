import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as v from "./schemas";

/**
 * Public, token-scoped. A parent sees exactly one plan's logistics — never the
 * group's members, private answers, or anything else about their child's account.
 */
export const getApproval = createServerFn({ method: "GET" })
  .inputValidator(z.object({ token: v.token }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("parent_approvals")
      .select("id, status, condition_text, expires_at, plan_id, profile_id")
      .eq("token", data.token)
      .maybeSingle();
    if (!row) return null;

    const { data: plan } = await supabaseAdmin
      .from("plans")
      .select("title, category, window_start, selected_recommendation_id")
      .eq("id", row.plan_id)
      .single();
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("display_name")
      .eq("id", row.profile_id)
      .single();

    let details: {
      title: string;
      location_name: string | null;
      suggested_start: string | null;
      suggested_end: string | null;
      cost_min: number | null;
      cost_max: number | null;
    } | null = null;
    if (plan?.selected_recommendation_id) {
      const { data: rec } = await supabaseAdmin
        .from("recommendations")
        .select("title, location_name, suggested_start, suggested_end, cost_min, cost_max")
        .eq("id", plan.selected_recommendation_id)
        .maybeSingle();
      details = rec ?? null;
    }
    const { data: cars } = await supabaseAdmin
      .from("transport_assignments")
      .select("car_label, driver_label")
      .eq("plan_id", row.plan_id);

    return {
      status: row.status,
      conditionText: row.condition_text,
      expiresAt: row.expires_at,
      childName: profile?.display_name ?? "Your child",
      planTitle: plan?.title ?? "A plan",
      category: plan?.category ?? "",
      date: plan?.window_start ?? null,
      details,
      cars: cars ?? [],
    };
  });

export const respondToApproval = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      token: v.token,
      decision: z.enum(["approved", "approved_with_condition", "declined"]),
      condition: v.text(500).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("parent_approvals")
      .select("id, expires_at, status, plan_id, profile_id")
      .eq("token", data.token)
      .maybeSingle();
    if (!row) throw new Error("This link is not valid");
    if (new Date(row.expires_at) < new Date()) throw new Error("This link has expired");

    const condition =
      data.decision === "approved_with_condition" ? data.condition?.trim() || null : null;

    const { error } = await supabaseAdmin
      .from("parent_approvals")
      .update({
        status: data.decision,
        condition_text: condition,
        responded_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (error) throw new Error(error.message);

    // A condition becomes a private constraint for that member, then the whole
    // group's options are recalculated against it.
    const { notifyProfiles } = await import("./notify.server");
    await notifyProfiles([row.profile_id], {
      type: "parent_response",
      title:
        data.decision === "declined"
          ? "A parent did not approve this plan"
          : data.decision === "approved_with_condition"
            ? "A parent approved with a condition"
            : "A parent approved this plan",
      ...(condition ? { body: condition } : {}),
      planId: row.plan_id,
    });

    if (condition) {
      const { applyParentCondition, regenerateRecommendations } =
        await import("./recommend.server");
      await applyParentCondition(row.plan_id, row.profile_id, condition);
      try {
        await regenerateRecommendations(row.plan_id);
      } catch {
        /* recalculation is best-effort; the response itself is already saved */
      }
    }

    await supabaseAdmin.from("activity_events").insert({
      plan_id: row.plan_id,
      group_id: null,
      type: "parent_response",
      message:
        data.decision === "declined"
          ? "A permission request was declined"
          : condition
            ? "A permission request was approved with a condition"
            : "A permission request was approved",
    });

    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Public parent summary — /approve/:planId                            */
/* ------------------------------------------------------------------ */

export type ParentSummary = {
  planId: string;
  childName: string;
  returnTime: string | null;
  title: string;
  category: string;
  status: string;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  curfewLimit: string | null;
  curfewOk: boolean | null;
  roster: {
    id: string;
    name: string;
    emoji: string;
    avatarUrl: string | null;
    host: boolean;
    confirmed: boolean;
    curfew: string | null;
    curfewOk: boolean | null;
    distanceMiles: number | null;
  }[];
  cars: {
    car_label: string;
    driver: string;
    leg: string;
    riders: string[];
    seatsLeft: number | null;
  }[];
  venue: {
    title: string;
    address: string | null;
    locationName: string | null;
    category: string | null;
    lat: number | null;
    lon: number | null;
  } | null;
  costMin: number | null;
  costMax: number | null;
  estCostMin: number | null;
  estCostMax: number | null;
  totalCostMin: number | null;
  totalCostMax: number | null;
  parentDecision: { status: string; note: string | null } | null;
};

/**
 * Public, plan-scoped: only the logistics a parent needs, nothing private.
 * `sig` is required and verified against the plan id -- see
 * summary-link.server.ts. Without it, a bare plan id (which is not secret;
 * every group member can see it) would let anyone read every participant's
 * curfew and home-distance.
 */
export const getParentSummary = createServerFn({ method: "GET" })
  .inputValidator(z.object({ planId: v.id, sig: v.token }))
  .handler(async ({ data }): Promise<ParentSummary | null> => {
    const { verifyPlanSummarySig } = await import("./summary-link.server");
    if (!verifyPlanSummarySig(data.planId, data.sig)) return null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: plan } = await supabaseAdmin
      .from("plans")
      .select(
        "id, title, category, status, window_start, window_end, created_by, selected_recommendation_id, est_cost_min, est_cost_max",
      )
      .eq("id", data.planId)
      .maybeSingle();
    if (!plan) return null;

    const { data: parts } = await supabaseAdmin
      .from("plan_participants")
      .select(
        "profile_id, attending, responded, profiles(id, display_name, avatar_emoji, avatar_url, curfew_time, home_lat, home_lon)",
      )
      .eq("plan_id", plan.id);

    type P = {
      profile_id: string;
      attending: boolean;
      responded: boolean;
      profiles: {
        id: string;
        display_name: string;
        avatar_emoji: string;
        avatar_url: string | null;
        curfew_time: string | null;
        home_lat: number | null;
        home_lon: number | null;
      } | null;
    };
    const rows = (parts ?? []) as unknown as P[];
    const nameOf = (id: string) =>
      rows.find((r) => r.profile_id === id)?.profiles?.display_name ?? "A member";

    let venue: ParentSummary["venue"] = null;
    let startTime: string | null = null;
    let endTime: string | null = null;
    let costMin: number | null = null;
    let costMax: number | null = null;
    if (plan.selected_recommendation_id) {
      const { data: rec } = await supabaseAdmin
        .from("recommendations")
        .select(
          "title, subtitle, category, address, location_name, lat, lon, suggested_start, suggested_end, cost_min, cost_max",
        )
        .eq("id", plan.selected_recommendation_id)
        .maybeSingle();
      if (rec) {
        venue = {
          title: rec.title,
          address: rec.address,
          locationName: rec.location_name,
          category: rec.category,
          lat: rec.lat,
          lon: rec.lon,
        };
        startTime = rec.suggested_start?.slice(0, 5) ?? null;
        endTime = rec.suggested_end?.slice(0, 5) ?? null;
        costMin = rec.cost_min;
        costMax = rec.cost_max;
      }
    }
    if (!startTime && plan.window_start)
      startTime = new Date(plan.window_start).toISOString().slice(11, 16);
    if (!endTime && plan.window_end)
      endTime = new Date(plan.window_end).toISOString().slice(11, 16);

    // Per-member curfew + distance-from-home, computed once the venue and end
    // time are known.
    const { haversineMiles, milesToDriveMinutes } = await import("./location");
    const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
    const roster = rows.map((r) => {
      const curfew = r.profiles?.curfew_time?.slice(0, 5) ?? null;
      const lat = r.profiles?.home_lat ?? null;
      const lon = r.profiles?.home_lon ?? null;
      const distanceMiles =
        lat != null && lon != null && venue?.lat != null && venue?.lon != null
          ? Math.round(haversineMiles({ lat, lon }, { lat: venue.lat, lon: venue.lon }) * 10) / 10
          : null;
      const driveHome = distanceMiles != null ? milesToDriveMinutes(distanceMiles) : 0;
      const memberCurfewOk =
        curfew && endTime ? toMinutes(endTime) + driveHome <= toMinutes(curfew) : null;
      return {
        id: r.profile_id,
        name: r.profiles?.display_name ?? "Member",
        emoji: r.profiles?.avatar_emoji ?? "🙂",
        avatarUrl: r.profiles?.avatar_url ?? null,
        host: r.profile_id === plan.created_by,
        confirmed: Boolean(r.attending && r.responded),
        curfew,
        curfewOk: memberCurfewOk,
        distanceMiles,
      };
    });

    // Seat availability per car comes from each driver's saved capacity.
    const driverIds = [] as string[];
    const { data: transport } = await supabaseAdmin
      .from("transport_assignments")
      .select("car_label, driver_label, driver_profile_id, passenger_profile_ids, leg")
      .eq("plan_id", plan.id);
    for (const t of transport ?? []) if (t.driver_profile_id) driverIds.push(t.driver_profile_id);
    const { data: transportProfiles } = driverIds.length
      ? await supabaseAdmin
          .from("transport_profiles")
          .select("profile_id, passenger_capacity")
          .in("profile_id", driverIds)
      : { data: [] as { profile_id: string; passenger_capacity: number }[] };

    const cars = (transport ?? []).map((t) => {
      const riders = (t.passenger_profile_ids ?? []).map((id: string) => nameOf(id));
      const capacity =
        (transportProfiles ?? []).find((p) => p.profile_id === t.driver_profile_id)
          ?.passenger_capacity ?? null;
      return {
        car_label: t.car_label,
        driver: t.driver_label ?? (t.driver_profile_id ? nameOf(t.driver_profile_id) : "TBC"),
        leg: t.leg,
        riders,
        seatsLeft: capacity != null ? Math.max(capacity - riders.length, 0) : null,
      };
    });

    // Curfew check uses the earliest curfew among attendees.
    const curfews = rows
      .map((r) => r.profiles?.curfew_time?.slice(0, 5) ?? null)
      .filter((c): c is string => Boolean(c))
      .sort();
    const curfewLimit = curfews[0] ?? null;
    const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
    const curfewOk =
      curfewLimit && endTime
        ? (mins(endTime) === 0 ? 1440 : mins(endTime)) <=
          (mins(curfewLimit) === 0 ? 1440 : mins(curfewLimit))
        : null;

    const { data: approval } = await supabaseAdmin
      .from("parent_approvals")
      .select("status, condition_text, created_at")
      .eq("plan_id", plan.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Expected return home = end time + the host's drive home.
    const host = roster.find((r) => r.host) ?? roster[0] ?? null;
    let returnTime: string | null = null;
    if (endTime) {
      const extra = host?.distanceMiles != null ? milesToDriveMinutes(host.distanceMiles) : 0;
      const total = (mins(endTime) + extra) % 1440;
      returnTime = `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
    }

    return {
      planId: plan.id,
      childName: host?.name ?? "your child",
      returnTime,
      title: plan.title,
      category: plan.category,
      status: plan.status,
      date: plan.window_start ? plan.window_start.slice(0, 10) : null,
      startTime,
      endTime,
      curfewLimit,
      curfewOk,
      roster,
      cars,
      venue,
      costMin,
      costMax,
      estCostMin: (plan.est_cost_min as number | null) ?? null,
      estCostMax: (plan.est_cost_max as number | null) ?? null,
      totalCostMin: costMin != null ? costMin * Math.max(rows.length, 1) : null,
      totalCostMax: costMax != null ? costMax * Math.max(rows.length, 1) : null,
      parentDecision:
        approval && approval.status !== "pending"
          ? { status: approval.status, note: approval.condition_text }
          : null,
    };
  });

/**
 * Public one-tap parent action from the shared plan link. `sig` is required
 * and verified against the plan id (see getParentSummary above) -- without
 * it, this would let anyone who can see a plan id insert an already-decided
 * "approved" row for it, with no verification of who they are at all.
 */
export const parentRespondToPlan = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      planId: v.id,
      sig: v.token,
      decision: z.enum(["approved", "approved_with_condition"]),
      note: v.text(500).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { verifyPlanSummarySig } = await import("./summary-link.server");
    if (!verifyPlanSummarySig(data.planId, data.sig))
      throw new Error("This plan link is not valid");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: plan } = await supabaseAdmin
      .from("plans")
      .select("id, created_by, title")
      .eq("id", data.planId)
      .maybeSingle();
    if (!plan) throw new Error("This plan link is not valid");

    const note = data.note?.trim() || null;
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();
    const { error } = await supabaseAdmin.from("parent_approvals").insert({
      plan_id: plan.id,
      profile_id: plan.created_by,
      token: crypto.randomUUID().replace(/-/g, ""),
      status: data.decision,
      condition_text: note,
      responded_at: new Date().toISOString(),
      expires_at: expires,
    });
    if (error) throw new Error(error.message);

    const { notifyPlanParticipants } = await import("./notify.server");
    await notifyPlanParticipants(plan.id, {
      type: "parent_response",
      title: note ? "A parent approved with a note" : "A parent approved this plan",
      ...(note ? { body: note } : {}),
    });

    await supabaseAdmin.from("activity_events").insert({
      plan_id: plan.id,
      group_id: null,
      type: "parent_response",
      message: note ? "A parent approved with a note" : "A parent approved this plan",
    });

    return { ok: true };
  });
