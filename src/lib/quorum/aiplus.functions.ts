import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ConciergeTurn, GuardianAiSummary, SquadDigest, VibeRank } from "./aiplus.server";

export type { ConciergeTurn, GuardianAiSummary, SquadDigest, VibeRank };

/* ------------------------------------------------------------------ */
/* 1. Plan concierge chat                                              */
/* ------------------------------------------------------------------ */

export type ConciergeAnswer = { answer: string };

/**
 * Answers a free-text question about one plan. Only group-safe aggregates are
 * sent to the model — never an individual member's private constraint answers.
 */
export const askPlanConcierge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { planId: string; question: string; history?: ConciergeTurn[] }) => d)
  .handler(async ({ data, context }): Promise<ConciergeAnswer> => {
    const question = data.question.trim();
    if (!question) throw new Error("Ask a question first");

    const { supabase } = context;
    const { data: allowed } = await supabase.rpc("can_see_plan", { _plan_id: data.planId });
    if (!allowed) throw new Error("Forbidden");

    const [{ data: plan }, { data: recs }, { data: parts }, { data: votes }] = await Promise.all([
      supabase
        .from("plans")
        .select(
          "id, title, category, status, window_start, window_end, est_cost_min, est_cost_max, notes, groups(name)",
        )
        .eq("id", data.planId)
        .maybeSingle(),
      supabase
        .from("recommendations")
        .select("id, title, subtitle, cost_min, cost_max, travel_minutes, address, tags, score, rank")
        .eq("plan_id", data.planId)
        .order("rank"),
      supabase
        .from("plan_participants")
        .select("profile_id, responded, attending")
        .eq("plan_id", data.planId),
      supabase.from("votes").select("recommendation_id").eq("plan_id", data.planId),
    ]);
    if (!plan) throw new Error("Plan not found");

    const voteCounts: Record<string, number> = {};
    for (const v of votes ?? []) {
      const id = (v as { recommendation_id: string | null }).recommendation_id;
      if (id) voteCounts[id] = (voteCounts[id] ?? 0) + 1;
    }

    const facts = {
      title: plan.title,
      group: (plan.groups as unknown as { name?: string } | null)?.name ?? null,
      category: plan.category,
      status: plan.status,
      window_start: plan.window_start,
      window_end: plan.window_end,
      est_cost_per_person: [plan.est_cost_min, plan.est_cost_max],
      notes: plan.notes,
      members: {
        total: (parts ?? []).length,
        answered: (parts ?? []).filter((p) => p.responded).length,
        going: (parts ?? []).filter((p) => p.attending === true).length,
      },
      options: (recs ?? []).map((r) => ({
        title: r.title,
        subtitle: r.subtitle,
        cost: [r.cost_min, r.cost_max],
        travel_minutes: r.travel_minutes,
        address: r.address,
        tags: r.tags,
        match_score: r.score,
        votes: voteCounts[r.id as string] ?? 0,
      })),
    };

    const { conciergeReply } = await import("./aiplus.server");
    const answer = await conciergeReply(facts, data.history ?? [], question);
    return { answer };
  });

/* ------------------------------------------------------------------ */
/* 2. Smart squad digest                                               */
/* ------------------------------------------------------------------ */

/** AI recap of the caller's week plus one "next best plan" nudge. */
export const getSquadDigest = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SquadDigest> => {
    const { supabase } = context;
    const { data: myId } = await supabase.rpc("my_profile_id");
    const { data: plans } = await supabase
      .from("plans")
      .select("id, title, status, window_start, groups(name)")
      .order("created_at", { ascending: false })
      .limit(25);
    const list = plans ?? [];
    const ids = list.map((p) => p.id as string);

    const [{ data: parts }, { data: votes }] = await Promise.all([
      ids.length
        ? supabase
            .from("plan_participants")
            .select("plan_id, profile_id, responded")
            .in("plan_id", ids)
        : Promise.resolve({ data: [] as { plan_id: string; profile_id: string; responded: boolean }[] }),
      ids.length
        ? supabase.from("votes").select("plan_id, profile_id").in("plan_id", ids)
        : Promise.resolve({ data: [] as { plan_id: string; profile_id: string }[] }),
    ]);

    const groupOf = (p: (typeof list)[number]) =>
      (p.groups as unknown as { name?: string } | null)?.name ?? "your squad";
    const now = Date.now();
    const facts = {
      needsYou: list
        .filter((p) => {
          const mine = (parts ?? []).find(
            (r) => r.plan_id === p.id && r.profile_id === (myId as string),
          );
          const voted = (votes ?? []).some(
            (v) => v.plan_id === p.id && v.profile_id === (myId as string),
          );
          return (
            (p.status === "collecting" && !mine?.responded) || (p.status === "voting" && !voted)
          );
        })
        .slice(0, 4)
        .map((p) => ({ title: p.title as string, group: groupOf(p), status: p.status as string })),
      upcoming: list
        .filter(
          (p) =>
            p.status === "finalized" &&
            p.window_start &&
            new Date(p.window_start as string).getTime() > now,
        )
        .slice(0, 4)
        .map((p) => ({
          title: p.title as string,
          group: groupOf(p),
          when: (p.window_start as string | null) ?? null,
        })),
      recentlyDone: list
        .filter(
          (p) =>
            p.status === "finalized" &&
            p.window_start &&
            new Date(p.window_start as string).getTime() <= now,
        )
        .slice(0, 3)
        .map((p) => ({ title: p.title as string, group: groupOf(p) })),
      stalled: list
        .filter((p) => p.status === "collecting")
        .slice(0, 3)
        .map((p) => {
          const rows = (parts ?? []).filter((r) => r.plan_id === p.id);
          return {
            title: p.title as string,
            group: groupOf(p),
            responded: rows.filter((r) => r.responded).length,
            total: rows.length,
          };
        }),
    };

    const { writeSquadDigest } = await import("./aiplus.server");
    return writeSquadDigest(facts);
  });

/* ------------------------------------------------------------------ */
/* 3. AI vibe search                                                   */
/* ------------------------------------------------------------------ */

export type VibeSearchSpot = {
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
  reason: string;
};

export type VibeSearchResult = {
  needsHome: boolean;
  originLabel: string | null;
  aiGenerated: boolean;
  spots: VibeSearchSpot[];
};

/**
 * Natural-language venue search: "quiet patio, cheap, walkable". Pulls live
 * venues around the caller's home, then lets AI rank them against the vibe.
 */
export const vibeSearchSpots = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { query: string; kind?: "food" | "activity"; radiusMiles?: number | null }) => d)
  .handler(async ({ data, context }): Promise<VibeSearchResult> => {
    const query = data.query.trim();
    if (!query) throw new Error("Describe the vibe first");
    void context;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("home_address, home_lat, home_lon, zip_code")
      .eq("user_id", userId)
      .maybeSingle();

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
    if (!origin) return { needsHome: true, originLabel: null, aiGenerated: false, spots: [] };

    const seeds = await searchVenuesGeoapify({
      origin: { lat: origin.lat, lon: origin.lon, label: origin.label, zip: profile?.zip_code ?? "" },
      category: data.kind === "activity" ? "hangout" : "dinner",
      maxRadiusMiles: data.radiusMiles ?? 12,
      limit: 20,
    });

    const pool = seeds.map((s) => {
      const point = { lat: s.lat ?? origin!.lat, lon: s.lon ?? origin!.lon };
      const miles = Math.round(haversineMiles(origin!, point) * 10) / 10;
      return {
        key: s.key,
        title: s.title,
        subtitle: s.subtitle,
        address: s.address ?? null,
        cuisine: s.cuisine ?? null,
        priceLevel: s.priceLevel ?? "$$",
        kind: (s.kind ?? (data.kind === "activity" ? "activity" : "food")) as "food" | "activity",
        costMin: s.costMin,
        costMax: s.costMax,
        lat: point.lat,
        lon: point.lon,
        miles,
        minutes: milesToDriveMinutes(miles),
      };
    });

    const { rankByVibe } = await import("./aiplus.server");
    const { ranks, aiGenerated } = await rankByVibe(
      query,
      pool.map((p) => ({
        key: p.key,
        title: p.title,
        subtitle: p.subtitle,
        cuisine: p.cuisine,
        priceLevel: p.priceLevel,
        costMin: p.costMin,
        costMax: p.costMax,
        miles: p.miles,
      })),
    );

    const byKey = new Map(pool.map((p) => [p.key, p]));
    const spots: VibeSearchSpot[] = [];
    for (const r of ranks) {
      const hit = byKey.get(r.key);
      if (hit) spots.push({ ...hit, reason: r.reason });
    }
    return { needsHome: false, originLabel: origin.label, aiGenerated, spots };
  });

/* ------------------------------------------------------------------ */
/* 4. Guardian AI summary                                              */
/* ------------------------------------------------------------------ */

/** Plain-language summary of one linked teen's plans, rides and check-ins. */
export const getGuardianAiSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { teenProfileId?: string | null }) => d)
  .handler(async ({ data, context }): Promise<GuardianAiSummary> => {
    const { supabase } = context;
    const { data: myId } = await supabase.rpc("my_profile_id");
    if (!myId) throw new Error("Profile not found");

    const { buildGuardianDashboard } = await import("./guardian.server");
    const dash = await buildGuardianDashboard(myId as string);
    const teen = data.teenProfileId
      ? dash.teens.find((t) => t.id === data.teenProfileId)
      : dash.teens[0];
    if (!teen) {
      return { summary: "No linked teens yet — share a sync code to get started.", watchouts: [], aiGenerated: false };
    }

    const facts = {
      teen: teen.name,
      status: teen.status.label,
      curfew: teen.curfew,
      sharing: teen.sharing,
      plans: teen.plans.slice(0, 5).map((p) => ({
        title: p.title,
        when: p.window_start,
        venue: p.venue,
        supervised: p.adult_supervised,
        approval: p.approval?.status ?? null,
        rides: p.rides.slice(0, 3).map((r) => ({
          car: r.car_label,
          driver: r.driver_name,
          departed: Boolean(r.departed_at),
        })),
      })),
      delays: teen.delays.slice(0, 3).map((d) => ({ reason: d.reason, minutes: d.minutes })),
      checkins: teen.checkins
        .slice(0, 3)
        .map((c) => ({ status: c.status, place: c.place_label })),
    };

    const { writeGuardianSummary } = await import("./aiplus.server");
    return writeGuardianSummary(facts);
  });
