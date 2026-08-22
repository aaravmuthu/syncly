/**
 * Server-only engine behind the Friend Profile Sheet.
 *
 * Everything here is authorised against squad membership or an active
 * `location_shares` row before any telemetry leaves the server. Nicknames are
 * strictly private to the person who wrote them.
 */

import { haversineMiles, milesToDriveMinutes } from "./location";
import { motionEmoji, motionLabel } from "./sharing";
import type { ShareMode } from "./sharing";
import type { FriendProfile, FriendTelemetry, MutualCircle, SharedPlan } from "./friend";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const live = (r: { expires_at: string | null }) =>
  r.expires_at == null || new Date(r.expires_at).getTime() > Date.now();

/** Circles both people belong to — also the permission gate for the sheet. */
async function mutualCircles(a: string, b: string): Promise<MutualCircle[]> {
  const db = await admin();
  const [{ data: mine }, { data: theirs }] = await Promise.all([
    db.from("group_members").select("group_id").eq("profile_id", a),
    db.from("group_members").select("group_id").eq("profile_id", b),
  ]);
  const theirSet = new Set((theirs ?? []).map((r) => r.group_id));
  const shared = [...new Set((mine ?? []).map((r) => r.group_id))].filter((id) =>
    theirSet.has(id),
  );
  if (!shared.length) return [];
  const { data: groups } = await db
    .from("groups")
    .select("id, name, emoji")
    .in("id", shared);
  return (groups ?? []).map((g) => ({ id: g.id, name: g.name, emoji: g.emoji }));
}

/** My private alias map, e.g. { "<profileId>": "Mom" }. */
export async function nicknameMap(ownerProfileId: string): Promise<Record<string, string>> {
  const db = await admin();
  const { data } = await db
    .from("contact_nicknames")
    .select("target_profile_id, nickname")
    .eq("owner_profile_id", ownerProfileId);
  const out: Record<string, string> = {};
  for (const row of data ?? []) out[row.target_profile_id] = row.nickname;
  return out;
}

export async function saveNickname(
  ownerProfileId: string,
  targetProfileId: string,
  nickname: string,
) {
  if (ownerProfileId === targetProfileId) throw new Error("You can't nickname yourself");
  const db = await admin();
  const clean = nickname.trim().slice(0, 40);
  if (!clean) {
    const { error } = await db
      .from("contact_nicknames")
      .delete()
      .eq("owner_profile_id", ownerProfileId)
      .eq("target_profile_id", targetProfileId);
    if (error) throw new Error(error.message);
    return { nickname: null as string | null };
  }
  const { error } = await db
    .from("contact_nicknames")
    .upsert(
      { owner_profile_id: ownerProfileId, target_profile_id: targetProfileId, nickname: clean },
      { onConflict: "owner_profile_id,target_profile_id" },
    );
  if (error) throw new Error(error.message);
  return { nickname: clean };
}

/** Per-contact Ghost Mode: hide my pin from one person, keep sharing elsewhere. */
export async function setContactHidden(
  ownerProfileId: string,
  viewerProfileId: string,
  hidden: boolean,
) {
  const db = await admin();
  const { data, error } = await db
    .from("location_shares")
    .update({ hidden })
    .eq("owner_profile_id", ownerProfileId)
    .eq("viewer_profile_id", viewerProfileId)
    .select("owner_profile_id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("You aren't sharing your location with them yet");
  return { hidden };
}

/** High-priority "please share your location" ping. */
export async function requestLocationFrom(fromProfileId: string, toProfileId: string) {
  const circles = await mutualCircles(fromProfileId, toProfileId);
  if (!circles.length) throw new Error("You can only ask people in your circles");
  const db = await admin();
  const { data: me } = await db
    .from("profiles")
    .select("display_name")
    .eq("id", fromProfileId)
    .maybeSingle();
  await db.from("notifications").insert({
    profile_id: toProfileId,
    type: "location_request",
    title: `${me?.display_name ?? "A friend"} is requesting your location 📡`,
    body: "Tap to share your live radar — you choose for how long.",
  });
  return { ok: true as const };
}

async function telemetryFor(
  viewerProfileId: string,
  targetProfileId: string,
  visible: boolean,
): Promise<FriendTelemetry | null> {
  if (!visible) return null;
  const db = await admin();
  const { data: pings } = await db
    .from("location_pings")
    .select("lat, lon, battery_pct, status_label, created_at")
    .eq("profile_id", targetProfileId)
    .order("created_at", { ascending: false })
    .limit(1);
  const ping = pings?.[0];
  if (!ping) return null;

  const { data: prof } = await db
    .from("profiles")
    .select("home_lat, home_lon")
    .eq("id", targetProfileId)
    .maybeSingle();
  const atHome =
    prof?.home_lat != null &&
    prof.home_lon != null &&
    haversineMiles({ lat: ping.lat, lon: ping.lon }, { lat: prof.home_lat, lon: prof.home_lon }) <
      0.1;

  const { data: myPings } = await db
    .from("location_pings")
    .select("lat, lon")
    .eq("profile_id", viewerProfileId)
    .order("created_at", { ascending: false })
    .limit(1);
  const origin = myPings?.[0] ?? null;
  const distanceMiles = origin
    ? Math.round(haversineMiles(origin, { lat: ping.lat, lon: ping.lon }) * 10) / 10
    : null;

  let address: string | null = null;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${ping.lat}&lon=${ping.lon}&format=json&zoom=18`,
      { headers: { "User-Agent": "Syncly (https://syncly.website)", Accept: "application/json" } },
    );
    if (res.ok) {
      const j = (await res.json()) as {
        name?: string;
        address?: Record<string, string>;
        display_name?: string;
      };
      const a = j.address ?? {};
      const street = [a["house_number"], a["road"]].filter(Boolean).join(" ");
      const city = a["city"] ?? a["town"] ?? a["village"] ?? a["suburb"] ?? "";
      address = j.name || [street, city].filter(Boolean).join(", ") || j.display_name || null;
    }
  } catch {
    address = null;
  }

  return {
    lat: ping.lat,
    lon: ping.lon,
    batteryPct: ping.battery_pct,
    motion: motionLabel(ping.status_label, Boolean(atHome)),
    statusEmoji: motionEmoji(ping.status_label, Boolean(atHome)),
    atHome: Boolean(atHome),
    address,
    lastSeen: ping.created_at,
    distanceMiles,
    driveMinutes: distanceMiles != null ? milesToDriveMinutes(distanceMiles) : null,
  };
}

/** Upcoming plans we're both in, and the hangouts we already shared. */
async function sharedPlans(a: string, b: string) {
  const db = await admin();
  const { data: rows } = await db
    .from("plan_participants")
    .select("plan_id, profile_id")
    .in("profile_id", [a, b]);
  const mine = new Set((rows ?? []).filter((r) => r.profile_id === a).map((r) => r.plan_id));
  const both = [
    ...new Set((rows ?? []).filter((r) => r.profile_id === b && mine.has(r.plan_id)).map((r) => r.plan_id)),
  ];
  if (!both.length) return { upcoming: [] as SharedPlan[], memories: [] as SharedPlan[] };

  const { data: plans } = await db
    .from("plans")
    .select("id, title, category, window_start, status, location_area")
    .in("id", both)
    .order("window_start", { ascending: false })
    .limit(40);

  const now = Date.now();
  const upcoming: SharedPlan[] = [];
  const memories: SharedPlan[] = [];
  for (const p of plans ?? []) {
    const when = p.window_start ? new Date(p.window_start).getTime() : null;
    const item: SharedPlan = {
      id: p.id,
      title: p.title,
      category: p.category,
      status: p.status,
      when: p.window_start,
      where: p.location_area,
    };
    if (p.status === "cancelled") continue;
    if (when != null && when >= now) upcoming.push(item);
    else memories.push(item);
  }
  upcoming.sort((x, y) => (x.when ?? "").localeCompare(y.when ?? ""));
  return { upcoming: upcoming.slice(0, 5), memories: memories.slice(0, 5) };
}

/** Everything the Friend Profile Sheet renders, in a single authorised read. */
export async function buildFriendProfile(
  viewerProfileId: string,
  targetProfileId: string,
): Promise<FriendProfile> {
  if (viewerProfileId === targetProfileId) throw new Error("That's you");
  const db = await admin();

  const [circles, { data: prof }] = await Promise.all([
    mutualCircles(viewerProfileId, targetProfileId),
    db
      .from("profiles")
      .select("id, display_name, avatar_emoji, avatar_url, bio, school, grad_year")
      .eq("id", targetProfileId)
      .maybeSingle(),
  ]);
  if (!prof) throw new Error("Member not found");

  const guardianLinked = Boolean(
    (
      await db
        .from("guardian_links")
        .select("id")
        .or(
          `and(guardian_profile_id.eq.${viewerProfileId},teen_profile_id.eq.${targetProfileId}),and(guardian_profile_id.eq.${targetProfileId},teen_profile_id.eq.${viewerProfileId})`,
        )
        .limit(1)
    ).data?.length,
  );

  // No shared circle and no guardian link means no relationship: reveal nothing.
  if (!circles.length && !guardianLinked) throw new Error("Member not found");


  const [{ data: shares }, nicks, plans] = await Promise.all([
    db
      .from("location_shares")
      .select("owner_profile_id, viewer_profile_id, mode, expires_at, hidden")
      .or(
        `and(owner_profile_id.eq.${viewerProfileId},viewer_profile_id.eq.${targetProfileId}),and(owner_profile_id.eq.${targetProfileId},viewer_profile_id.eq.${viewerProfileId})`,
      ),
    nicknameMap(viewerProfileId),
    sharedPlans(viewerProfileId, targetProfileId),
  ]);

  const outgoing = (shares ?? []).find(
    (s) => s.owner_profile_id === viewerProfileId && live(s),
  );
  const incoming = (shares ?? []).find(
    (s) => s.owner_profile_id === targetProfileId && live(s),
  );


  const visible = Boolean(incoming && !incoming.hidden) || guardianLinked;

  return {
    profileId: prof.id,
    name: prof.display_name,
    nickname: nicks[prof.id] ?? null,
    emoji: prof.avatar_emoji,
    avatarUrl: prof.avatar_url,
    bio: prof.bio,
    school: prof.school,
    gradYear: prof.grad_year,
    handle: `@${prof.display_name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 16) || "member"}`,
    circles,
    sharingWithThem: outgoing
      ? { mode: outgoing.mode as ShareMode, expiresAt: outgoing.expires_at, hidden: outgoing.hidden }
      : null,
    sharingWithMe: incoming
      ? { mode: incoming.mode as ShareMode, expiresAt: incoming.expires_at, hidden: incoming.hidden }
      : null,
    guardianLinked,
    telemetry: await telemetryFor(viewerProfileId, targetProfileId, visible),
    upcoming: plans.upcoming,
    memories: plans.memories,
  };
}
