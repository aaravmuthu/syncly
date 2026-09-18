import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** How many spots survive the group-midpoint shortlist (see browseSpots below). */
const GROUP_SHORTLIST_SIZE = 24;

export type BrowseSpot = {
  key: string;
  title: string;
  subtitle: string;
  address: string | null;
  cuisine: string | null;
  priceLevel: string;
  kind: "food" | "activity";
  costMin: number;
  costMax: number;
  lat: number;
  lon: number;
  miles: number;
  minutes: number;
  members: { profileId: string; name: string; miles: number; minutes: number }[];
};

export type BrowseSpotsResult = {
  origin: { lat: number; lon: number; label: string } | null;
  /** Average of every confirmed member's home coordinates, when a group is given. */
  midpoint: { lat: number; lon: number } | null;
  needsHome: boolean;
  spots: BrowseSpot[];
};

/**
 * Live nearby restaurants and activity spots with exact mile distances from the
 * signed-in member's saved home address (and every group member's, when a
 * group is supplied).
 */
export const browseSpots = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      categories?: string | null;
      query?: string | null;
      radiusMiles?: number | null;
      groupId?: string | null;
      kind?: "food" | "activity";
    }) => d,
  )
  .handler(async ({ data, context }): Promise<BrowseSpotsResult> => {
    const { supabase, userId } = context;
    // Private location columns are not readable by the user role — read the
    // caller's own row through the trusted server client, scoped to their id.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, home_address, home_lat, home_lon, zip_code, home_area")
      .eq("user_id", userId)
      .maybeSingle();
    void supabase;

    const { geocodeZipServer } = await import("./location.server");
    const { searchVenuesGeoapify } = await import("./places.server");
    const { haversineMiles, milesToDriveMinutes, normalizeZip } = await import("./location");

    let origin: { lat: number; lon: number; label: string } | null = null;
    if (typeof profile?.home_lat === "number" && typeof profile?.home_lon === "number") {
      origin = {
        lat: profile.home_lat,
        lon: profile.home_lon,
        label: profile.home_address ?? profile.zip_code ?? "Your home",
      };
    } else {
      const zip = normalizeZip(profile?.zip_code ?? null);
      const geo = zip ? await geocodeZipServer(zip) : null;
      if (geo) origin = { lat: geo.lat, lon: geo.lon, label: geo.label };
    }
    if (!origin) return { origin: null, midpoint: null, needsHome: true, spots: [] };

    const seeds = await searchVenuesGeoapify({
      origin: {
        lat: origin.lat,
        lon: origin.lon,
        label: origin.label,
        zip: profile?.zip_code ?? "",
      },
      category: data.kind === "activity" ? "hangout" : "dinner",
      categoriesOverride: data.categories ?? null,
      name: data.query ?? null,
      maxRadiusMiles: data.radiusMiles ?? 15,
      limit: 40,
    });

    let members: { profileId: string; name: string; lat: number | null; lon: number | null }[] = [];
    if (data.groupId) {
      const { loadMemberBases } = await import("./fairpoint.server");
      members = (await loadMemberBases(data.groupId)).map((m) => ({
        profileId: m.profileId,
        name: m.name,
        lat: m.lat,
        lon: m.lon,
      }));
    }

    const spots: BrowseSpot[] = seeds.map((s) => {
      const point = { lat: s.lat ?? origin!.lat, lon: s.lon ?? origin!.lon };
      const miles = Math.round(haversineMiles(origin!, point) * 10) / 10;
      return {
        key: s.key,
        title: s.title,
        subtitle: s.subtitle,
        address: s.address ?? null,
        cuisine: s.cuisine ?? null,
        priceLevel: s.priceLevel ?? "$$",
        kind: s.kind ?? (data.kind === "activity" ? "activity" : "food"),
        costMin: s.costMin,
        costMax: s.costMax,
        lat: point.lat,
        lon: point.lon,
        miles,
        minutes: milesToDriveMinutes(miles),
        members: members
          .filter((m) => m.lat != null && m.lon != null && m.profileId !== profile?.id)
          .map((m) => {
            const mi = Math.round(haversineMiles({ lat: m.lat!, lon: m.lon! }, point) * 10) / 10;
            return {
              profileId: m.profileId,
              name: m.name,
              miles: mi,
              minutes: milesToDriveMinutes(mi),
            };
          })
          .sort((a, b) => a.miles - b.miles)
          .slice(0, 4),
      };
    });

    // When the group is known, keep the spots of this kind nearest the
    // group's geographic midpoint (was a stricter top-3; widened so the
    // browser feels populated instead of nearly empty).
    const based = members.filter((m) => m.lat != null && m.lon != null);
    let midpoint: { lat: number; lon: number } | null = null;
    let shortlist = spots;
    if (based.length) {
      midpoint = {
        lat: based.reduce((a, m) => a + m.lat!, 0) / based.length,
        lon: based.reduce((a, m) => a + m.lon!, 0) / based.length,
      };
      const mid = midpoint;
      shortlist = [...spots]
        .sort(
          (a, b) =>
            haversineMiles(mid, { lat: a.lat, lon: a.lon }) -
            haversineMiles(mid, { lat: b.lat, lon: b.lon }),
        )
        .slice(0, GROUP_SHORTLIST_SIZE);
    }

    return { origin, midpoint, needsHome: false, spots: shortlist };
  });

/** Adds a browsed spot to a plan as a votable option (plan host only). */
export const addSpotToPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { planId: string; spot: BrowseSpot }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { spot, planId } = data;

    const { data: existing } = await supabase
      .from("recommendations")
      .select("id, rank, title")
      .eq("plan_id", planId)
      .order("rank", { ascending: false });
    if ((existing ?? []).some((r) => r.title === spot.title)) {
      return { ok: true, duplicate: true };
    }
    const nextRank = ((existing ?? [])[0]?.rank ?? 0) + 1;

    const { error } = await supabase.from("recommendations").insert({
      plan_id: planId,
      title: spot.title,
      subtitle: spot.subtitle,
      category: spot.kind === "food" ? "dinner" : "hangout",
      cost_min: spot.costMin,
      cost_max: spot.costMax,
      travel_minutes: spot.minutes,
      location_name: spot.address ?? spot.subtitle,
      address: spot.address,
      lat: spot.lat,
      lon: spot.lon,
      tags: [spot.cuisine, spot.priceLevel].filter(Boolean) as string[],
      score: 80,
      feasible: true,
      rank: nextRank,
      breakdown: {
        venue: {
          kind: spot.kind,
          cuisine: spot.cuisine,
          priceLevel: spot.priceLevel,
          milesFromHost: spot.miles,
        },
        source: "picked-by-host",
      },
    } as never);
    if (error) throw new Error(error.message);

    await supabase
      .from("plans")
      .update({ status: "voting" })
      .eq("id", planId)
      .eq("status", "collecting");
    return { ok: true, duplicate: false };
  });

export type SavedPlace = {
  key: string;
  title: string;
  subtitle: string | null;
  address: string | null;
  cuisine: string | null;
  priceLevel: string | null;
  kind: "food" | "activity";
  costMin: number;
  costMax: number;
  lat: number;
  lon: number;
  miles: number | null;
  minutes: number | null;
};

/** Bookmarks a browsed spot to the signed-in member's own saved list. */
export const saveSpot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { spot: BrowseSpot }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { spot } = data;
    const { data: me } = await supabase.rpc("my_profile_id");

    // saved_places has no UPDATE policy, so an upsert's ON CONFLICT DO UPDATE
    // path is blocked by RLS. Re-saving an existing bookmark deletes the old
    // row first, then inserts fresh — both policies exist.
    await supabase
      .from("saved_places")
      .delete()
      .eq("profile_id", me as string)
      .eq("key", spot.key);

    const { error } = await supabase.from("saved_places").insert(
      {
        profile_id: me as string,
        key: spot.key,
        title: spot.title,
        subtitle: spot.subtitle,
        address: spot.address,
        cuisine: spot.cuisine,
        price_level: spot.priceLevel,
        kind: spot.kind,
        cost_min: spot.costMin,
        cost_max: spot.costMax,
        lat: spot.lat,
        lon: spot.lon,
      } as never,
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Removes a spot from the signed-in member's saved list. */
export const unsaveSpot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { key: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: me } = await supabase.rpc("my_profile_id");

    const { error } = await supabase
      .from("saved_places")
      .delete()
      .eq("profile_id", me as string)
      .eq("key", data.key);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** The signed-in member's saved spots, nearest-home distance included when a home address is on file. */
export const listSavedSpots = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SavedPlace[]> => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("saved_places")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("home_lat, home_lon")
      .eq("user_id", userId)
      .maybeSingle();
    const { haversineMiles, milesToDriveMinutes } = await import("./location");
    const origin =
      typeof profile?.home_lat === "number" && typeof profile?.home_lon === "number"
        ? { lat: profile.home_lat, lon: profile.home_lon }
        : null;

    return (rows ?? []).map((r) => {
      const miles = origin
        ? Math.round(haversineMiles(origin, { lat: r.lat, lon: r.lon }) * 10) / 10
        : null;
      return {
        key: r.key,
        title: r.title,
        subtitle: r.subtitle,
        address: r.address,
        cuisine: r.cuisine,
        priceLevel: r.price_level,
        kind: r.kind as "food" | "activity",
        costMin: r.cost_min ?? 0,
        costMax: r.cost_max ?? 0,
        lat: r.lat,
        lon: r.lon,
        miles,
        minutes: miles != null ? milesToDriveMinutes(miles) : null,
      };
    });
  });
