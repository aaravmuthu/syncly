// Server-only. Computes the group's shared "Fair-Point" (geographic midpoint of
// every member's saved home ZIP) and per-member drive estimates to a venue.
import { haversineMiles, milesToDriveMinutes, normalizeZip, type ZipLocation } from "./location";
import { geocodeZipServer } from "./location.server";

export type MemberBase = {
  profileId: string;
  name: string;
  emoji: string | null;
  avatarUrl: string | null;
  zip: string | null;
  lat: number | null;
  lon: number | null;
  /** "22:00" when the member saved a curfew. */
  curfew: string | null;
  budgetPreference: string | null;
};

export type FairPoint = ZipLocation & { memberCount: number };

/** Loads every group member with their geocoded home base. */
export async function loadMemberBases(groupId: string): Promise<MemberBase[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rows } = await supabaseAdmin
    .from("group_members")
    .select(
      "profile_id, profiles(id, display_name, avatar_emoji, avatar_url, zip_code, home_area, home_lat, home_lon, curfew_time, budget_preference)",
    )
    .eq("group_id", groupId);

  const members: MemberBase[] = [];
  for (const row of rows ?? []) {
    const p = (row.profiles ?? {}) as Record<string, unknown>;
    const zip =
      normalizeZip(p["zip_code"] as string | null) ??
      normalizeZip(
        String(p["home_area"] ?? "")
          .replace(/\D/g, "")
          .slice(0, 5),
      );
    // An exact saved home address beats the ZIP centroid.
    const exactLat = typeof p["home_lat"] === "number" ? (p["home_lat"] as number) : null;
    const exactLon = typeof p["home_lon"] === "number" ? (p["home_lon"] as number) : null;
    const geo =
      exactLat != null && exactLon != null
        ? { lat: exactLat, lon: exactLon }
        : zip
          ? await geocodeZipServer(zip)
          : null;
    members.push({
      profileId: row.profile_id as string,
      name: (p["display_name"] as string) ?? "Member",
      emoji: (p["avatar_emoji"] as string) ?? null,
      avatarUrl: (p["avatar_url"] as string) ?? null,
      zip,
      lat: geo?.lat ?? null,
      lon: geo?.lon ?? null,
      curfew: ((p["curfew_time"] as string) ?? null)?.slice(0, 5) ?? null,
      budgetPreference: (p["budget_preference"] as string) ?? null,
    });
  }
  return members;
}

/**
 * Geographic midpoint of every member with a known home base, computed on the
 * unit sphere so it stays correct across longitudes.
 */
export function midpointOf(
  points: { lat: number; lon: number }[],
): { lat: number; lon: number } | null {
  if (!points.length) return null;
  let x = 0;
  let y = 0;
  let z = 0;
  for (const p of points) {
    const lat = (p.lat * Math.PI) / 180;
    const lon = (p.lon * Math.PI) / 180;
    x += Math.cos(lat) * Math.cos(lon);
    y += Math.cos(lat) * Math.sin(lon);
    z += Math.sin(lat);
  }
  x /= points.length;
  y /= points.length;
  z /= points.length;
  const lon = Math.atan2(y, x);
  const lat = Math.atan2(z, Math.sqrt(x * x + y * y));
  return { lat: (lat * 180) / Math.PI, lon: (lon * 180) / Math.PI };
}

/** Resolves the Fair-Point for a group, falling back to a ZIP override. */
export async function fairPointFor(
  members: MemberBase[],
  fallbackZip?: string | null,
): Promise<FairPoint | null> {
  const located = members.filter((m) => m.lat != null && m.lon != null) as (MemberBase & {
    lat: number;
    lon: number;
  })[];
  const mid = midpointOf(located.map((m) => ({ lat: m.lat, lon: m.lon })));
  if (mid) {
    const { reverseZipServer } = await import("./places.server");
    const zip = (await reverseZipServer(mid.lat, mid.lon)) ?? located[0]?.zip ?? "";
    const named = zip ? await geocodeZipServer(zip) : null;
    return {
      zip: zip || (located[0]?.zip ?? ""),
      lat: mid.lat,
      lon: mid.lon,
      label: named?.label ?? "Group midpoint",
      memberCount: located.length,
    };
  }
  const zip = normalizeZip(fallbackZip);
  const geo = zip ? await geocodeZipServer(zip) : null;
  return geo ? { ...geo, memberCount: 0 } : null;
}

export type MemberDrive = {
  profileId: string;
  name: string;
  miles: number;
  minutes: number;
};

/** Distance + drive time from every located member's home to a venue. */
export function drivesTo(
  members: MemberBase[],
  venue: { lat?: number | null; lon?: number | null },
): MemberDrive[] {
  if (venue.lat == null || venue.lon == null) return [];
  return members
    .filter((m) => m.lat != null && m.lon != null)
    .map((m) => {
      const miles =
        Math.round(
          haversineMiles({ lat: m.lat!, lon: m.lon! }, { lat: venue.lat!, lon: venue.lon! }) * 10,
        ) / 10;
      return { profileId: m.profileId, name: m.name, miles, minutes: milesToDriveMinutes(miles) };
    })
    .sort((a, b) => a.minutes - b.minutes);
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":");
  return Number(h) * 60 + Number(m ?? 0);
};

const fmt = (mins: number) => {
  const m = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m % 60).padStart(2, "0")} ${suffix}`;
};

export type CurfewWarning = { name: string; curfew: string; wrapsAt: string };

/**
 * Compares a venue's wrap-up time (end time + that member's drive home) against
 * every member's saved curfew.
 */
export function curfewWarnings(
  members: MemberBase[],
  endTime: string | null | undefined,
  drives: MemberDrive[],
): CurfewWarning[] {
  if (!endTime) return [];
  const end = toMin(endTime);
  const out: CurfewWarning[] = [];
  for (const m of members) {
    if (!m.curfew) continue;
    const drive = drives.find((d) => d.profileId === m.profileId)?.minutes ?? 0;
    const home = end + drive;
    if (home > toMin(m.curfew)) {
      out.push({ name: m.name, curfew: fmt(toMin(m.curfew)), wrapsAt: fmt(home) });
    }
  }
  return out;
}

export { fmt as formatClock };
