/**
 * Server-only engine for "Find My Friends" permanent location sharing.
 *
 * Every read is authorised in code against `location_shares` before any pin
 * leaves the server: the admin client is used only after the caller has been
 * proven to be an active viewer of that owner.
 */

import { haversineMiles, milesToDriveMinutes } from "./location";
import { expiryFor, ghostUntilFor, motionEmoji, motionLabel } from "./sharing";
import type { FriendPin, GhostChoice, ShareMode, SharePeer, SharingState } from "./sharing";
import { realName } from "./names";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type ShareRow = {
  owner_profile_id: string;
  viewer_profile_id: string;
  mode: ShareMode;
  expires_at: string | null;
  hidden?: boolean | null;
};

const isLive = (r: { expires_at: string | null }) =>
  r.expires_at == null || new Date(r.expires_at).getTime() > Date.now();

/** Drops rows whose 1-hour / end-of-day window has already closed. */
export async function sweepExpiredShares() {
  const db = await admin();
  await db
    .from("location_shares")
    .delete()
    .not("expires_at", "is", null)
    .lt("expires_at", new Date().toISOString());
}

function ghostActive(p: {
  location_paused_until: string | null;
  location_pause_indefinite: boolean;
}) {
  if (p.location_pause_indefinite) return true;
  return (
    p.location_paused_until != null && new Date(p.location_paused_until).getTime() > Date.now()
  );
}

/** Owners whose live pin the caller is currently allowed to see. */
export async function activeOwnersFor(viewerProfileId: string): Promise<ShareRow[]> {
  const db = await admin();
  const { data } = await db
    .from("location_shares")
    .select("owner_profile_id, viewer_profile_id, mode, expires_at, hidden")
    .eq("viewer_profile_id", viewerProfileId);
  return ((data ?? []) as ShareRow[]).filter(isLive);
}

/** The caller's own outgoing shares. */
export async function myOutgoingShares(ownerProfileId: string): Promise<ShareRow[]> {
  const db = await admin();
  const { data } = await db
    .from("location_shares")
    .select("owner_profile_id, viewer_profile_id, mode, expires_at, hidden")
    .eq("owner_profile_id", ownerProfileId);
  return ((data ?? []) as ShareRow[]).filter(isLive);
}

export async function setShare(ownerProfileId: string, viewerProfileId: string, mode: ShareMode) {
  if (ownerProfileId === viewerProfileId) throw new Error("You already know where you are");
  const db = await admin();
  const { error } = await db.from("location_shares").upsert(
    {
      owner_profile_id: ownerProfileId,
      viewer_profile_id: viewerProfileId,
      mode,
      expires_at: expiryFor(mode),
    },
    { onConflict: "owner_profile_id,viewer_profile_id" },
  );
  if (error) throw new Error(error.message);

  const { data: me } = await db
    .from("profiles")
    .select("display_name")
    .eq("id", ownerProfileId)
    .maybeSingle();
  await db.from("notifications").insert({
    profile_id: viewerProfileId,
    type: "location_share",
    title: `${realName(me?.display_name) ?? "A friend"} is sharing their location with you`,
    body:
      mode === "indefinite"
        ? "Live on your map until they turn it off ♾️"
        : mode === "hour"
          ? "Live on your map for the next hour ⏱️"
          : "Live on your map until the end of the day 🌙",
  });
  return { ok: true as const };
}

export async function stopShare(ownerProfileId: string, viewerProfileId: string) {
  const db = await admin();
  const { error } = await db
    .from("location_shares")
    .delete()
    .eq("owner_profile_id", ownerProfileId)
    .eq("viewer_profile_id", viewerProfileId);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

/** Viewer-side removal: stop seeing someone without touching their settings. */
export async function stopWatching(viewerProfileId: string, ownerProfileId: string) {
  const db = await admin();
  const { error } = await db
    .from("location_shares")
    .delete()
    .eq("owner_profile_id", ownerProfileId)
    .eq("viewer_profile_id", viewerProfileId);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

export async function setGhostMode(profileId: string, choice: GhostChoice) {
  const db = await admin();
  const { error } = await db
    .from("profiles")
    .update({
      location_paused_until: choice === "resume" ? null : ghostUntilFor(choice),
      location_pause_indefinite: choice === "until_reenabled",
    })
    .eq("id", profileId);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

export async function getSharingState(profileId: string): Promise<SharingState> {
  await sweepExpiredShares();
  const db = await admin();
  const [{ data: prof }, shares] = await Promise.all([
    db
      .from("profiles")
      .select("location_paused_until, location_pause_indefinite, location_sharing_enabled")
      .eq("id", profileId)
      .maybeSingle(),
    myOutgoingShares(profileId),
  ]);
  const paused = prof
    ? ghostActive({
        location_paused_until: prof.location_paused_until,
        location_pause_indefinite: prof.location_pause_indefinite,
      })
    : false;
  return {
    ghost: {
      active: paused,
      until: prof?.location_pause_indefinite ? null : (prof?.location_paused_until ?? null),
      indefinite: prof?.location_pause_indefinite ?? false,
    },
    sharingWith: shares.length,
    streaming: Boolean(prof?.location_sharing_enabled) && !paused,
  };
}

type ProfileLite = {
  id: string;
  display_name: string;
  avatar_emoji: string;
  avatar_url: string | null;
  home_lat: number | null;
  home_lon: number | null;
  location_paused_until: string | null;
  location_pause_indefinite: boolean;
};

async function profilesById(ids: string[]): Promise<Map<string, ProfileLite>> {
  if (!ids.length) return new Map();
  const db = await admin();
  const { data } = await db
    .from("profiles")
    .select(
      "id, display_name, avatar_emoji, avatar_url, home_lat, home_lon, location_paused_until, location_pause_indefinite",
    )
    .in("id", ids);
  return new Map(((data ?? []) as ProfileLite[]).map((p) => [p.id, p]));
}

async function latestPings(ids: string[]) {
  const map = new Map<
    string,
    {
      lat: number;
      lon: number;
      battery_pct: number | null;
      status_label: string | null;
      created_at: string;
    }
  >();
  if (!ids.length) return map;
  const db = await admin();
  const { data } = await db
    .from("location_pings")
    .select("profile_id, lat, lon, battery_pct, status_label, created_at")
    .in("profile_id", ids)
    .order("created_at", { ascending: false })
    .limit(600);
  for (const row of data ?? []) {
    if (map.has(row.profile_id)) continue;
    map.set(row.profile_id, {
      lat: row.lat,
      lon: row.lon,
      battery_pct: row.battery_pct,
      status_label: row.status_label,
      created_at: row.created_at,
    });
  }
  return map;
}

/** Cheap reverse geocode with an in-process cache; keyless OpenStreetMap. */
const addressCache = new Map<string, string | null>();
async function reverseAddress(lat: number, lon: number): Promise<string | null> {
  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  if (addressCache.has(key)) return addressCache.get(key) ?? null;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=18`,
      { headers: { "User-Agent": "Syncly (https://syncly.website)", Accept: "application/json" } },
    );
    if (!res.ok) return null;
    const j = (await res.json()) as {
      name?: string;
      address?: Record<string, string>;
      display_name?: string;
    };
    const a = j.address ?? {};
    const street = [a["house_number"], a["road"]].filter(Boolean).join(" ");
    const city = a["city"] ?? a["town"] ?? a["village"] ?? a["suburb"] ?? "";
    const label = j.name || [street, city].filter(Boolean).join(", ") || j.display_name || null;
    addressCache.set(key, label);
    return label;
  } catch {
    return null;
  }
}

/** Live friend pins for everyone currently sharing with the caller. */
export async function buildFriendPins(viewerProfileId: string): Promise<FriendPin[]> {
  await sweepExpiredShares();
  const incoming = await activeOwnersFor(viewerProfileId);
  const outgoing = await myOutgoingShares(viewerProfileId);
  const outgoingBy = new Map(outgoing.map((s) => [s.viewer_profile_id, s]));

  const ownerIds = incoming.map((s) => s.owner_profile_id);
  const [profiles, pings, mine] = await Promise.all([
    profilesById([...ownerIds, viewerProfileId]),
    latestPings(ownerIds),
    Promise.resolve(null),
  ]);
  void mine;

  const meProfile = profiles.get(viewerProfileId);
  const myPing = (await latestPings([viewerProfileId])).get(viewerProfileId);
  const origin =
    myPing ??
    (meProfile?.home_lat != null && meProfile.home_lon != null
      ? { lat: meProfile.home_lat, lon: meProfile.home_lon }
      : null);

  const pins: FriendPin[] = [];
  for (const share of incoming) {
    const p = profiles.get(share.owner_profile_id);
    const ping = pings.get(share.owner_profile_id);
    if (!p || !ping) continue;
    // Ghost Mode hides friend pins; guardian radar is a separate read path.
    if (ghostActive(p)) continue;
    // Per-contact ghosting: hidden from me specifically.
    if (share.hidden) continue;

    const atHome =
      p.home_lat != null &&
      p.home_lon != null &&
      haversineMiles({ lat: ping.lat, lon: ping.lon }, { lat: p.home_lat, lon: p.home_lon }) < 0.1;
    const distanceMiles = origin
      ? Math.round(haversineMiles(origin, { lat: ping.lat, lon: ping.lon }) * 10) / 10
      : null;
    const back = outgoingBy.get(share.owner_profile_id);

    pins.push({
      profileId: p.id,
      name: p.display_name,
      emoji: p.avatar_emoji,
      avatarUrl: p.avatar_url,
      sharingWithMe: { mode: share.mode, expiresAt: share.expires_at },
      sharingWithThem: back ? { mode: back.mode, expiresAt: back.expires_at } : null,
      lat: ping.lat,
      lon: ping.lon,
      batteryPct: ping.battery_pct,
      motion: motionLabel(ping.status_label, atHome),
      statusEmoji: motionEmoji(ping.status_label, atHome),
      lastSeen: ping.created_at,
      address: await reverseAddress(ping.lat, ping.lon),
      distanceMiles,
      driveMinutes: distanceMiles != null ? milesToDriveMinutes(distanceMiles) : null,
      atHome,
    });
  }
  pins.sort((a, b) => (a.distanceMiles ?? 9999) - (b.distanceMiles ?? 9999));
  return pins;
}

/** Everyone the caller shares a squad with, plus the two-way share status. */
export async function listSharePeers(profileId: string): Promise<SharePeer[]> {
  await sweepExpiredShares();
  const db = await admin();
  const { data: mine } = await db
    .from("group_members")
    .select("group_id")
    .eq("profile_id", profileId);
  const groupIds = (mine ?? []).map((g) => g.group_id);
  if (!groupIds.length) return [];

  const { data: members } = await db
    .from("group_members")
    .select("profile_id")
    .in("group_id", groupIds);
  const peerIds = [...new Set((members ?? []).map((m) => m.profile_id))].filter(
    (id) => id !== profileId,
  );
  if (!peerIds.length) return [];

  const [profiles, outgoing, incoming] = await Promise.all([
    profilesById(peerIds),
    myOutgoingShares(profileId),
    activeOwnersFor(profileId),
  ]);
  const out = new Map(outgoing.map((s) => [s.viewer_profile_id, s]));
  const inc = new Map(incoming.map((s) => [s.owner_profile_id, s]));

  return peerIds
    .map((id) => profiles.get(id))
    .filter((p): p is ProfileLite => Boolean(p))
    .map((p) => {
      const o = out.get(p.id);
      const i = inc.get(p.id);
      return {
        profileId: p.id,
        name: p.display_name,
        emoji: p.avatar_emoji,
        avatarUrl: p.avatar_url,
        sharingWithThem: o ? { mode: o.mode, expiresAt: o.expires_at } : null,
        sharingWithMe: i ? { mode: i.mode, expiresAt: i.expires_at } : null,
      };
    })
    .sort((a, b) => Number(Boolean(b.sharingWithThem)) - Number(Boolean(a.sharingWithThem)));
}

/** A micro-notification: "want to hang out?" — only to people I can see. */
export async function nudgeFriend(fromProfileId: string, toProfileId: string) {
  const allowed = (await activeOwnersFor(fromProfileId)).some(
    (s) => s.owner_profile_id === toProfileId,
  );
  const reverse = (await myOutgoingShares(fromProfileId)).some(
    (s) => s.viewer_profile_id === toProfileId,
  );
  if (!allowed && !reverse) throw new Error("You can only nudge friends you share location with");

  const db = await admin();
  const { data: me } = await db
    .from("profiles")
    .select("display_name")
    .eq("id", fromProfileId)
    .maybeSingle();
  await db.from("notifications").insert({
    profile_id: toProfileId,
    type: "nudge",
    title: `${realName(me?.display_name) ?? "A friend"} nudged you 📍`,
    body: "They're nearby — want to hang out?",
  });
  return { ok: true as const };
}

/** Guardian links imply an indefinite share so safety radar never gaps. */
export async function ensureGuardianShare(teenProfileId: string, guardianProfileId: string) {
  const db = await admin();
  await db.from("location_shares").upsert(
    {
      owner_profile_id: teenProfileId,
      viewer_profile_id: guardianProfileId,
      mode: "indefinite" as ShareMode,
      expires_at: null,
    },
    { onConflict: "owner_profile_id,viewer_profile_id" },
  );
}
