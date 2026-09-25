/**
 * Server-only guardian ecosystem logic: account pairing, live location radar,
 * geofence alerts, carpool safety, parent-to-parent contacts and check-ins.
 *
 * Privacy rule that governs this whole module: a guardian only ever sees data
 * about a teen they are explicitly linked to, plus the logistics of the plans
 * that teen is attending. Never the group's private answers or other members'
 * accounts.
 */

import { haversineMiles, milesToDriveMinutes } from "./location";
import type { TeenCard } from "./guardian.types";

export type { TeenCard };

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

async function admin(): Promise<Admin> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export function metersBetween(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  return Math.round(haversineMiles(a, b) * 1609.344);
}

/* ------------------------------------------------------------------ */
/* Pairing                                                             */
/* ------------------------------------------------------------------ */

/** How long a revealed sync code stays usable. Long enough to text a parent. */
const SYNC_CODE_TTL_MS = 60 * 60 * 1000;
/** Failed pairing guesses allowed per account per hour before we lock them out. */
const MAX_FAILED_LINKS_PER_HOUR = 5;
/** How long a parent's link request waits for the teen before it lapses. */
const LINK_REQUEST_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * A teen's current 6-digit sync code. Codes are short-lived and single-use: a
 * 6-digit space is guessable if codes live forever, so each one expires an
 * hour after it's issued and is cleared once a parent links with it.
 */
export async function ensureSyncCode(
  profileId: string,
): Promise<{ code: string; expiresAt: string }> {
  const db = await admin();
  const { data: row } = await db
    .from("profiles")
    .select("sync_code, sync_code_expires_at")
    .eq("id", profileId)
    .maybeSingle();
  if (row?.sync_code && row.sync_code_expires_at) {
    // Reuse a code with plenty of life left so a re-opened card shows the same one.
    const remaining = new Date(row.sync_code_expires_at).getTime() - Date.now();
    if (remaining > SYNC_CODE_TTL_MS / 4) {
      return { code: row.sync_code, expiresAt: row.sync_code_expires_at };
    }
  }

  const { randomInt } = await import("node:crypto");
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const expiresAt = new Date(Date.now() + SYNC_CODE_TTL_MS).toISOString();
    const { error } = await db
      .from("profiles")
      .update({ sync_code: code, sync_code_expires_at: expiresAt })
      .eq("id", profileId);
    if (!error) return { code, expiresAt };
  }
  throw new Error("Could not generate a sync code — try again");
}

export async function linkTeenByCode(guardianProfileId: string, rawCode: string) {
  const code = rawCode.replace(/\D/g, "").slice(0, 6);
  if (code.length !== 6) throw new Error("Enter the 6-digit code from your teen's profile");

  const db = await admin();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recentFailures } = await db
    .from("guardian_link_attempts")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", guardianProfileId)
    .eq("succeeded", false)
    .gte("created_at", since);
  if ((recentFailures ?? 0) >= MAX_FAILED_LINKS_PER_HOUR) {
    throw new Error("Too many incorrect codes. Wait an hour, then ask your teen for a fresh code.");
  }
  const recordAttempt = (succeeded: boolean) =>
    db.from("guardian_link_attempts").insert({ profile_id: guardianProfileId, succeeded });

  const { data: teen } = await db
    .from("profiles")
    .select("id, display_name, account_type")
    .eq("sync_code", code)
    .gt("sync_code_expires_at", new Date().toISOString())
    .maybeSingle();
  if (!teen) {
    await recordAttempt(false);
    throw new Error("That code doesn't match, or it has expired. Ask your teen for a fresh one.");
  }
  if (teen.id === guardianProfileId) throw new Error("That's your own code");
  if (teen.account_type === "guardian") throw new Error("That code belongs to a parent account");
  await recordAttempt(true);
  // Single-use: burn the code so it can't link a second account.
  await db
    .from("profiles")
    .update({ sync_code: null, sync_code_expires_at: null })
    .eq("id", teen.id);

  const teenName = teen.display_name as string;
  const { data: existing } = await db
    .from("guardian_links")
    .select("id")
    .eq("guardian_profile_id", guardianProfileId)
    .eq("teen_profile_id", teen.id)
    .maybeSingle();
  if (existing) return { teenId: teen.id, teenName, status: "linked" as const };

  // A code alone never grants access: it files a request the teen must approve.
  const { error } = await db.from("guardian_link_requests").upsert(
    {
      guardian_profile_id: guardianProfileId,
      teen_profile_id: teen.id,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + LINK_REQUEST_TTL_MS).toISOString(),
    },
    { onConflict: "guardian_profile_id,teen_profile_id" },
  );
  if (error) throw new Error(error.message);

  const { data: guardian } = await db
    .from("profiles")
    .select("display_name")
    .eq("id", guardianProfileId)
    .maybeSingle();
  await db.from("notifications").insert({
    profile_id: teen.id,
    type: "parent_response",
    title: `${guardian?.display_name ?? "Someone"} wants to link as your parent`,
    body: "Approve or decline in Settings → Account. Nothing is shared until you approve.",
  });
  return { teenId: teen.id, teenName, status: "pending" as const };
}

/** Unexpired link requests waiting on this teen, with who is asking. */
export async function pendingLinkRequestsForTeen(teenProfileId: string) {
  const db = await admin();
  const { data, error } = await db
    .from("guardian_link_requests")
    .select(
      "id, created_at, guardian:profiles!guardian_link_requests_guardian_profile_id_fkey(display_name, avatar_emoji, avatar_url)",
    )
    .eq("teen_profile_id", teenProfileId)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    createdAt: r.created_at as string,
    guardian: r.guardian as unknown as {
      display_name?: string;
      avatar_emoji?: string;
      avatar_url?: string | null;
    } | null,
  }));
}

/** Names of teens this guardian has asked to link with and is still waiting on. */
export async function pendingLinkRequestsForGuardian(guardianProfileId: string) {
  const db = await admin();
  const { data } = await db
    .from("guardian_link_requests")
    .select("id, teen:profiles!guardian_link_requests_teen_profile_id_fkey(display_name)")
    .eq("guardian_profile_id", guardianProfileId)
    .gt("expires_at", new Date().toISOString());
  return (data ?? []).map((r) => ({
    id: r.id as string,
    teenName: (r.teen as unknown as { display_name?: string } | null)?.display_name ?? "Your teen",
  }));
}

/**
 * The teen's answer to a link request. Only the teen named on the request can
 * answer it; approving creates the guardian link, declining just drops it.
 */
export async function respondToLinkRequest(
  teenProfileId: string,
  requestId: string,
  approve: boolean,
) {
  const db = await admin();
  const { data: request } = await db
    .from("guardian_link_requests")
    .select("id, guardian_profile_id, expires_at")
    .eq("id", requestId)
    .eq("teen_profile_id", teenProfileId)
    .maybeSingle();
  if (!request) throw new Error("That request is no longer waiting on you");
  await db.from("guardian_link_requests").delete().eq("id", request.id);
  if (new Date(request.expires_at).getTime() <= Date.now()) {
    throw new Error("That request expired. Share a fresh code if you still want to link.");
  }

  const guardianId = request.guardian_profile_id as string;
  const { data: teen } = await db
    .from("profiles")
    .select("display_name")
    .eq("id", teenProfileId)
    .maybeSingle();
  const teenName = teen?.display_name ?? "Your teen";

  if (!approve) {
    await db.from("notifications").insert({
      profile_id: guardianId,
      type: "parent_response",
      title: `${teenName} didn't approve your link request`,
    });
    return { approved: false };
  }

  const { error } = await db
    .from("guardian_links")
    .upsert(
      { guardian_profile_id: guardianId, teen_profile_id: teenProfileId },
      { onConflict: "guardian_profile_id,teen_profile_id" },
    );
  if (error) throw new Error(error.message);

  // Guardian links imply indefinite visibility so the safety radar never gaps.
  const { ensureGuardianShare } = await import("./sharing.server");
  await ensureGuardianShare(teenProfileId, guardianId);

  await db.from("notifications").insert({
    profile_id: guardianId,
    type: "parent_response",
    title: `${teenName} approved your link`,
    body: "Their plans, rides and shared location are now on your family hub.",
  });
  return { approved: true };
}

export async function guardianIdsFor(teenProfileId: string): Promise<string[]> {
  const db = await admin();
  const { data } = await db
    .from("guardian_links")
    .select("guardian_profile_id")
    .eq("teen_profile_id", teenProfileId);
  return (data ?? []).map((r) => r.guardian_profile_id as string);
}

export async function alertGuardians(
  teenProfileId: string,
  payload: {
    type: string;
    title: string;
    body?: string | null;
    planId?: string | null;
    priority?: "normal" | "high";
  },
) {
  const ids = await guardianIdsFor(teenProfileId);
  if (!ids.length) return;
  const db = await admin();
  await db.from("guardian_alerts").insert(
    ids.map((guardian_profile_id) => ({
      guardian_profile_id,
      teen_profile_id: teenProfileId,
      plan_id: payload.planId ?? null,
      type: payload.type,
      title: payload.title,
      body: payload.body ?? null,
      priority: payload.priority ?? "normal",
    })),
  );
  await db.from("notifications").insert(
    ids.map((profile_id) => ({
      profile_id,
      type: "parent_response",
      title: payload.title,
      body: payload.body ?? null,
      plan_id: payload.planId ?? null,
    })),
  );
}

export async function assertLinked(guardianProfileId: string, teenProfileId: string) {
  const db = await admin();
  const { data } = await db
    .from("guardian_links")
    .select("id")
    .eq("guardian_profile_id", guardianProfileId)
    .eq("teen_profile_id", teenProfileId)
    .maybeSingle();
  if (!data) throw new Error("You aren't linked to this teen");
}

/* ------------------------------------------------------------------ */
/* Location radar + geofences                                          */
/* ------------------------------------------------------------------ */

export type PingInput = {
  lat: number;
  lon: number;
  accuracyM?: number | null;
  batteryPct?: number | null;
  statusLabel?: string | null;
  planId?: string | null;
};

/**
 * Stores a ping, then compares it against the previous one to raise
 * arrival/departure alerts for every safe zone the teen crossed.
 */
export async function recordPing(teenProfileId: string, input: PingInput) {
  const db = await admin();

  const { data: previous } = await db
    .from("location_pings")
    .select("lat, lon")
    .eq("profile_id", teenProfileId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await db.from("location_pings").insert({
    profile_id: teenProfileId,
    lat: input.lat,
    lon: input.lon,
    accuracy_m: input.accuracyM ?? null,
    battery_pct: input.batteryPct ?? null,
    status_label: input.statusLabel ?? null,
    plan_id: input.planId ?? null,
  });
  if (error) throw new Error(error.message);

  const { data: zones } = await db
    .from("safe_zones")
    .select("id, label, lat, lon, radius_m")
    .eq("teen_profile_id", teenProfileId);

  const crossings: { zone_id: string; zone_label: string; kind: "arrive" | "depart" }[] = [];
  for (const z of zones ?? []) {
    const now = metersBetween(input, { lat: z.lat as number, lon: z.lon as number });
    const inside = now <= (z.radius_m as number);
    const was = previous
      ? metersBetween(
          { lat: previous.lat as number, lon: previous.lon as number },
          { lat: z.lat as number, lon: z.lon as number },
        ) <= (z.radius_m as number)
      : null;
    if (was === null || was === inside) continue;
    crossings.push({
      zone_id: z.id as string,
      zone_label: z.label as string,
      kind: inside ? "arrive" : "depart",
    });
  }

  if (crossings.length) {
    await db.from("geofence_events").insert(
      crossings.map((c) => ({
        profile_id: teenProfileId,
        zone_id: c.zone_id,
        zone_label: c.zone_label,
        kind: c.kind,
      })),
    );
    const { data: teen } = await db
      .from("profiles")
      .select("display_name")
      .eq("id", teenProfileId)
      .maybeSingle();
    const name = teen?.display_name ?? "Your teen";
    for (const c of crossings) {
      await alertGuardians(teenProfileId, {
        type: c.kind === "arrive" ? "geofence_arrive" : "geofence_depart",
        title:
          c.kind === "arrive"
            ? `${name} arrived at ${c.zone_label}`
            : `${name} left ${c.zone_label}`,
        body: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      });
    }
  }

  return { ok: true, crossings: crossings.length };
}

/** Human status chip: nearest safe zone wins, otherwise "En route". */
function statusFor(
  ping: { lat: number; lon: number; status_label?: string | null } | null,
  zones: { label: string; kind: string; lat: number; lon: number; radius_m: number }[],
) {
  if (!ping) return { label: "Location off", emoji: "🌙", tone: "neutral" as const };
  const hit = zones.find((z) => metersBetween(ping, z) <= z.radius_m);
  if (hit) {
    const emoji =
      hit.kind === "home"
        ? "🏠"
        : hit.kind === "school"
          ? "📚"
          : hit.kind === "venue"
            ? "⚽"
            : "📍";
    return { label: `At ${hit.label}`, emoji, tone: "good" as const };
  }
  if (ping.status_label) return { label: ping.status_label, emoji: "🚗", tone: "accent" as const };
  return { label: "En route", emoji: "🚗", tone: "accent" as const };
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

export type GuardianDashboard = Awaited<ReturnType<typeof buildGuardianDashboard>>;

export async function buildGuardianDashboard(guardianProfileId: string) {
  const db = await admin();

  const { data: links } = await db
    .from("guardian_links")
    .select(
      "teen_profile_id, relation, created_at, teen:profiles!guardian_links_teen_profile_id_fkey(id, display_name, avatar_emoji, avatar_url, curfew_time, school, home_address, home_lat, home_lon, location_sharing_enabled)",
    )
    .eq("guardian_profile_id", guardianProfileId)
    .order("created_at");

  const teens = (links ?? [])
    .map((l) => l.teen as unknown as Record<string, unknown> | null)
    .filter(Boolean) as Record<string, unknown>[];
  const teenIds = teens.map((t) => t["id"] as string);

  const pendingRequests = await pendingLinkRequestsForGuardian(guardianProfileId);
  if (!teenIds.length) {
    return { teens: [] as TeenCard[], alerts: [], unreadAlerts: 0, pendingRequests };
  }

  const [
    { data: pings },
    { data: zones },
    { data: participants },
    { data: approvals },
    { data: alerts },
    { data: checkins },
    { data: delays },
  ] = await Promise.all([
    db
      .from("location_pings")
      .select("profile_id, lat, lon, accuracy_m, battery_pct, status_label, created_at")
      .in("profile_id", teenIds)
      .order("created_at", { ascending: false })
      .limit(400),
    db
      .from("safe_zones")
      .select("id, teen_profile_id, label, kind, lat, lon, radius_m")
      .in("teen_profile_id", teenIds),
    db.from("plan_participants").select("plan_id, profile_id, attending").in("profile_id", teenIds),
    db
      .from("parent_approvals")
      .select("id, plan_id, profile_id, status, condition_text, created_at")
      .in("profile_id", teenIds)
      .order("created_at", { ascending: false }),
    db
      .from("guardian_alerts")
      .select("id, teen_profile_id, plan_id, type, title, body, priority, read, created_at")
      .eq("guardian_profile_id", guardianProfileId)
      .order("created_at", { ascending: false })
      .limit(40),
    db
      .from("checkin_requests")
      .select("id, teen_profile_id, status, note, lat, lon, place_label, created_at, responded_at")
      .eq("guardian_profile_id", guardianProfileId)
      .order("created_at", { ascending: false })
      .limit(20),
    db
      .from("delay_pings")
      .select("id, profile_id, plan_id, reason, minutes, new_eta, created_at")
      .in("profile_id", teenIds)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const planIds = [...new Set((participants ?? []).map((p) => p.plan_id as string))];

  const [{ data: plans }, { data: rides }, { data: roster }] = await Promise.all([
    planIds.length
      ? db
          .from("plans")
          .select(
            "id, group_id, title, category, status, window_start, window_end, est_cost_min, est_cost_max, adult_supervised, supervision_note, selected_recommendation_id, groups(name, emoji)",
          )
          .in("id", planIds)
      : Promise.resolve({ data: [] as never[] }),
    planIds.length
      ? db
          .from("transport_assignments")
          .select(
            "id, plan_id, car_label, leg, driver_label, driver_profile_id, passenger_profile_ids, vehicle_desc, vehicle_color, vehicle_plate, departed_at, eta_minutes, driver:profiles!transport_assignments_driver_profile_id_fkey(display_name, avatar_emoji, avatar_url, phone, share_contact_with_parents)",
          )
          .in("plan_id", planIds)
      : Promise.resolve({ data: [] as never[] }),
    planIds.length
      ? db
          .from("plan_participants")
          .select(
            "plan_id, profile_id, attending, profiles(display_name, avatar_emoji, avatar_url)",
          )
          .in("plan_id", planIds)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const recIds = (plans ?? [])
    .map((p) => p.selected_recommendation_id as string | null)
    .filter((x): x is string => Boolean(x));
  const { data: recs } = recIds.length
    ? await db
        .from("recommendations")
        .select("id, title, location_name, address, lat, lon, suggested_start, suggested_end")
        .in("id", recIds)
    : { data: [] as never[] };

  // Parent-to-parent network: guardians of everyone attending the same plans.

  const attendeeIds = [...new Set((roster ?? []).map((r) => r.profile_id as string))];
  const { data: otherLinks } = attendeeIds.length
    ? await db
        .from("guardian_links")
        .select(
          "teen_profile_id, guardian_profile_id, relation, guardian:profiles!guardian_links_guardian_profile_id_fkey(display_name, avatar_emoji, avatar_url, phone, share_contact_with_parents)",
        )
        .in("teen_profile_id", attendeeIds)
    : { data: [] as never[] };

  const teenCards: TeenCard[] = teens.map((t) => {
    const id = t["id"] as string;
    const myZones = (zones ?? [])
      .filter((z) => z.teen_profile_id === id)
      .map((z) => ({
        id: z.id as string,
        label: z.label as string,
        kind: z.kind as string,
        lat: z.lat as number,
        lon: z.lon as number,
        radius_m: z.radius_m as number,
      }));
    const ping = (pings ?? []).find((p) => p.profile_id === id) ?? null;
    const status = statusFor(
      ping
        ? {
            lat: ping.lat as number,
            lon: ping.lon as number,
            status_label: ping.status_label as string | null,
          }
        : null,
      myZones,
    );

    const myPlanIds = new Set(
      (participants ?? []).filter((p) => p.profile_id === id).map((p) => p.plan_id as string),
    );

    const myPlans = (plans ?? [])
      .filter((p) => myPlanIds.has(p.id as string))
      .map((p) => {
        const rec =
          ((recs ?? []).find((r) => r.id === p.selected_recommendation_id) as unknown as Record<
            string,
            unknown
          > | null) ?? null;

        const planRides = (rides ?? [])
          .filter((r) => r.plan_id === p.id)
          .map((r) => {
            const d = r.driver as unknown as Record<string, unknown> | null;
            return {
              id: r.id as string,
              car_label: (r.car_label as string) ?? "Car",
              leg: (r.leg as string) ?? "there",
              driver_name:
                ((d?.["display_name"] as string | undefined) ??
                  (r.driver_label as string | null)) ||
                "Unassigned",
              driver_avatar: (d?.["avatar_url"] as string | null) ?? null,
              driver_emoji: (d?.["avatar_emoji"] as string | null) ?? null,
              driver_phone:
                d?.["share_contact_with_parents"] === true
                  ? ((d?.["phone"] as string | null) ?? null)
                  : null,
              vehicle: [r.vehicle_color, r.vehicle_desc].filter(Boolean).join(" ") || null,
              plate: (r.vehicle_plate as string | null) ?? null,
              passengers: ((r.passenger_profile_ids as string[] | null) ?? []).length,
              departed_at: (r.departed_at as string | null) ?? null,
              eta_minutes: (r.eta_minutes as number | null) ?? null,
              carries_my_teen: ((r.passenger_profile_ids as string[] | null) ?? []).includes(id),
            };
          });

        const attendees = (roster ?? [])
          .filter((r) => r.plan_id === p.id && r.attending)
          .map((r) => {
            const prof = r.profiles as unknown as Record<string, unknown> | null;
            return {
              profile_id: r.profile_id as string,
              name: (prof?.["display_name"] as string) ?? "Member",
              emoji: (prof?.["avatar_emoji"] as string) ?? "🙂",
              avatar_url: (prof?.["avatar_url"] as string | null) ?? null,
            };
          });

        const parentNetwork = (otherLinks ?? [])
          .filter(
            (l) =>
              attendees.some((a) => a.profile_id === l.teen_profile_id) &&
              l.teen_profile_id !== id &&
              l.guardian_profile_id !== guardianProfileId,
          )
          .map((l) => {
            const g = l.guardian as unknown as Record<string, unknown> | null;
            const teenName =
              attendees.find((a) => a.profile_id === l.teen_profile_id)?.name ?? "a friend";
            return {
              id: l.guardian_profile_id as string,
              name: (g?.["display_name"] as string) ?? "Parent",
              emoji: (g?.["avatar_emoji"] as string) ?? "🙂",
              avatar_url: (g?.["avatar_url"] as string | null) ?? null,
              relation: (l.relation as string) ?? "parent",
              teen_name: teenName,
              phone:
                g?.["share_contact_with_parents"] === true
                  ? ((g?.["phone"] as string | null) ?? null)
                  : null,
            };
          });

        const approval = (approvals ?? []).find((a) => a.plan_id === p.id && a.profile_id === id);

        const venueLat = (rec?.["lat"] as number | null) ?? null;
        const venueLon = (rec?.["lon"] as number | null) ?? null;
        const homeLat = t["home_lat"] as number | null;
        const homeLon = t["home_lon"] as number | null;
        const driveMinutes =
          venueLat != null && venueLon != null && homeLat != null && homeLon != null
            ? milesToDriveMinutes(
                haversineMiles({ lat: homeLat, lon: homeLon }, { lat: venueLat, lon: venueLon }),
              )
            : null;

        return {
          id: p.id as string,
          title: p.title as string,
          category: p.category as string,
          status: p.status as string,
          window_start: (p.window_start as string | null) ?? null,
          window_end: (p.window_end as string | null) ?? null,
          est_cost_min: (p.est_cost_min as number | null) ?? null,
          est_cost_max: (p.est_cost_max as number | null) ?? null,
          adult_supervised: Boolean(p.adult_supervised),
          supervision_note: (p.supervision_note as string | null) ?? null,
          group_name: ((p.groups as unknown as { name?: string } | null)?.name ??
            "Squad") as string,
          venue: (rec?.["title"] as string | null) ?? (rec?.["location_name"] as string | null),
          address: (rec?.["address"] as string | null) ?? null,
          lat: venueLat,
          lon: venueLon,
          drive_minutes: driveMinutes,
          rides: planRides,
          attendees,
          parentNetwork,
          approval: approval
            ? {
                id: approval.id as string,
                status: approval.status as string,
                condition_text: (approval.condition_text as string | null) ?? null,
              }
            : null,
        };
      })
      .sort((a, b) => (a.window_start ?? "").localeCompare(b.window_start ?? ""));

    return {
      id,
      name: (t["display_name"] as string) ?? "Teen",
      emoji: (t["avatar_emoji"] as string) ?? "🙂",
      avatar_url: (t["avatar_url"] as string | null) ?? null,
      school: (t["school"] as string | null) ?? null,
      curfew: (t["curfew_time"] as string | null) ?? null,
      sharing: Boolean(t["location_sharing_enabled"]),
      home: {
        address: (t["home_address"] as string | null) ?? null,
        lat: (t["home_lat"] as number | null) ?? null,
        lon: (t["home_lon"] as number | null) ?? null,
      },
      location: ping
        ? {
            lat: ping.lat as number,
            lon: ping.lon as number,
            accuracy_m: (ping.accuracy_m as number | null) ?? null,
            battery_pct: (ping.battery_pct as number | null) ?? null,
            at: ping.created_at as string,
          }
        : null,
      status,
      zones: myZones,
      plans: myPlans,
      delays: (delays ?? [])
        .filter((d) => d.profile_id === id)
        .map((d) => ({
          id: d.id as string,
          reason: d.reason as string,
          minutes: d.minutes as number,
          new_eta: (d.new_eta as string | null) ?? null,
          created_at: d.created_at as string,
        })),
      checkins: (checkins ?? [])
        .filter((c) => c.teen_profile_id === id)
        .map((c) => ({
          id: c.id as string,
          status: c.status as string,
          note: (c.note as string | null) ?? null,
          lat: (c.lat as number | null) ?? null,
          lon: (c.lon as number | null) ?? null,
          place_label: (c.place_label as string | null) ?? null,
          created_at: c.created_at as string,
          responded_at: (c.responded_at as string | null) ?? null,
        })),
    };
  });

  return {
    teens: teenCards,
    alerts: (alerts ?? []).map((a) => ({
      id: a.id as string,
      teen_profile_id: (a.teen_profile_id as string | null) ?? null,
      plan_id: (a.plan_id as string | null) ?? null,
      type: a.type as string,
      title: a.title as string,
      body: (a.body as string | null) ?? null,
      priority: a.priority as string,
      read: Boolean(a.read),
      created_at: a.created_at as string,
    })),
    unreadAlerts: (alerts ?? []).filter((a) => !a.read).length,
    pendingRequests,
  };
}

/* ------------------------------------------------------------------ */
/* Approvals, rides, check-ins, delays                                 */
/* ------------------------------------------------------------------ */

export async function decideApproval(
  guardianProfileId: string,
  approvalId: string,
  decision: "approved" | "approved_with_condition" | "declined",
  condition?: string | null,
) {
  const db = await admin();
  const { data: row } = await db
    .from("parent_approvals")
    .select("id, profile_id, plan_id")
    .eq("id", approvalId)
    .maybeSingle();
  if (!row) throw new Error("That approval request no longer exists");
  await assertLinked(guardianProfileId, row.profile_id as string);

  const { error } = await db
    .from("parent_approvals")
    .update({
      status: decision,
      condition_text: decision === "approved_with_condition" ? (condition ?? null) : null,
      responded_at: new Date().toISOString(),
    })
    .eq("id", approvalId);
  if (error) throw new Error(error.message);

  const label =
    decision === "approved"
      ? "approved your plan"
      : decision === "approved_with_condition"
        ? `approved your plan with a condition${condition ? `: ${condition}` : ""}`
        : "can't approve this plan";
  await db.from("notifications").insert({
    profile_id: row.profile_id,
    plan_id: row.plan_id,
    type: "parent_response",
    title: `Your parent ${label}`,
  });
  return { ok: true };
}

/** Driver taps "we're leaving" — every passenger's guardians get the alert. */
export async function markRideDeparted(actorProfileId: string, assignmentId: string) {
  const db = await admin();
  const { data: ride } = await db
    .from("transport_assignments")
    .select(
      "id, plan_id, car_label, driver_profile_id, driver_label, passenger_profile_ids, vehicle_desc, vehicle_color, vehicle_plate, eta_minutes",
    )
    .eq("id", assignmentId)
    .maybeSingle();
  if (!ride) throw new Error("That ride no longer exists");
  const passengers = (ride.passenger_profile_ids as string[] | null) ?? [];
  const isRider = ride.driver_profile_id === actorProfileId || passengers.includes(actorProfileId);
  if (!isRider) throw new Error("You're not part of this ride");

  const { data: plan } = await db
    .from("plans")
    .select("title, selected_recommendation_id")
    .eq("id", ride.plan_id as string)
    .maybeSingle();
  let destination = plan?.title ?? "the plan";
  if (plan?.selected_recommendation_id) {
    const { data: rec } = await db
      .from("recommendations")
      .select("title, location_name")
      .eq("id", plan.selected_recommendation_id)
      .maybeSingle();
    destination = rec?.title ?? rec?.location_name ?? destination;
  }

  const departedAt = new Date().toISOString();
  await db.from("transport_assignments").update({ departed_at: departedAt }).eq("id", assignmentId);

  const { data: driver } = ride.driver_profile_id
    ? await db
        .from("profiles")
        .select("display_name")
        .eq("id", ride.driver_profile_id)
        .maybeSingle()
    : { data: null };
  const driverName = driver?.display_name ?? ride.driver_label ?? "The driver";
  const vehicle = [ride.vehicle_color, ride.vehicle_desc].filter(Boolean).join(" ");
  const eta = ride.eta_minutes ? ` • about ${ride.eta_minutes} min` : "";

  const riders = [
    ...new Set([
      ...(((ride.passenger_profile_ids as string[] | null) ?? []) as string[]),
      ...(ride.driver_profile_id ? [ride.driver_profile_id as string] : []),
      actorProfileId,
    ]),
  ];
  for (const teenId of riders) {
    await alertGuardians(teenId, {
      type: "ride_departed",
      title: `Carpool to ${destination} just left`,
      body: `${driverName} driving${vehicle ? ` a ${vehicle}` : ""}${eta}`,
      planId: ride.plan_id as string,
    });
  }
  return { ok: true, departedAt };
}

export async function sendDelayPing(
  teenProfileId: string,
  input: { planId?: string | null; reason: string; minutes: number },
) {
  const db = await admin();
  const newEta = new Date(Date.now() + input.minutes * 60_000).toISOString();
  const { error } = await db.from("delay_pings").insert({
    profile_id: teenProfileId,
    plan_id: input.planId ?? null,
    reason: input.reason,
    minutes: input.minutes,
    new_eta: newEta,
  });
  if (error) throw new Error(error.message);

  const { data: teen } = await db
    .from("profiles")
    .select("display_name")
    .eq("id", teenProfileId)
    .maybeSingle();
  await alertGuardians(teenProfileId, {
    type: "delay_ping",
    title: `${teen?.display_name ?? "Your teen"} is running about ${input.minutes} min late`,
    body: `${input.reason} • new ETA ${new Date(newEta).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
    planId: input.planId ?? null,
  });
  return { ok: true, newEta };
}

export async function requestCheckin(
  guardianProfileId: string,
  teenProfileId: string,
  note?: string | null,
) {
  await assertLinked(guardianProfileId, teenProfileId);
  const db = await admin();
  const { data, error } = await db
    .from("checkin_requests")
    .insert({
      guardian_profile_id: guardianProfileId,
      teen_profile_id: teenProfileId,
      note: note?.slice(0, 140) ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const { data: guardian } = await db
    .from("profiles")
    .select("display_name")
    .eq("id", guardianProfileId)
    .maybeSingle();
  await db.from("notifications").insert({
    profile_id: teenProfileId,
    type: "parent_response",
    title: `${guardian?.display_name ?? "Your parent"} asked for a quick check-in`,
    body: note?.slice(0, 140) ?? "Tap once to share where you are — nothing else is shared.",
  });
  return { id: data.id as string };
}

export async function answerCheckin(
  teenProfileId: string,
  input: { id: string; lat?: number | null; lon?: number | null; placeLabel?: string | null },
) {
  const db = await admin();
  const { data: row } = await db
    .from("checkin_requests")
    .select("id, guardian_profile_id, teen_profile_id")
    .eq("id", input.id)
    .maybeSingle();
  if (!row || row.teen_profile_id !== teenProfileId) throw new Error("That request isn't yours");

  await db
    .from("checkin_requests")
    .update({
      status: "answered",
      lat: input.lat ?? null,
      lon: input.lon ?? null,
      place_label: input.placeLabel ?? null,
      responded_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  const { data: teen } = await db
    .from("profiles")
    .select("display_name")
    .eq("id", teenProfileId)
    .maybeSingle();
  await db.from("guardian_alerts").insert({
    guardian_profile_id: row.guardian_profile_id,
    teen_profile_id: teenProfileId,
    type: "checkin_answered",
    title: `${teen?.display_name ?? "Your teen"} checked in`,
    body: input.placeLabel ?? "Location shared",
    priority: "high",
  });
  await db.from("notifications").insert({
    profile_id: row.guardian_profile_id,
    type: "parent_response",
    title: `${teen?.display_name ?? "Your teen"} checked in`,
    body: input.placeLabel ?? "Location shared",
  });
  return { ok: true };
}
