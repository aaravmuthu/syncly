import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PlanCategory } from "./types";

export type MemberPin = {
  profileId: string;
  name: string;
  emoji: string | null;
  avatarUrl: string | null;
  zip: string | null;
  lat: number | null;
  lon: number | null;
  curfew: string | null;
};

export type PlanDefaults = {
  me: {
    profileId: string | null;
    name: string;
    zip: string | null;
    homeAddress: string | null;
    homeLat: number | null;
    homeLon: number | null;
    curfew: string | null;
    budgetPreference: string | null;
    radiusMiles: number;
    dietary: string[];
    categories: string[];
  };

  members: MemberPin[];
  fairPoint: { lat: number; lon: number; label: string; zip: string; memberCount: number } | null;
  summary: string;
};

/** Everything the Create Plan screen needs to open pre-filled. */
export const getPlanDefaults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { groupId: string }) => d)
  .handler(async ({ data, context }): Promise<PlanDefaults> => {
    const { supabase } = context;
    const { data: myId } = await supabase.rpc("my_profile_id");
    // RLS: this only returns rows for groups the caller belongs to.
    const { data: membership } = await supabase
      .from("group_members")
      .select("id")
      .eq("group_id", data.groupId)
      .limit(1);
    if (!membership?.length) throw new Error("Forbidden");

    const { data: mine } = await supabase
      .from("profiles")
      .select(
        "id, display_name, zip_code, home_area, home_address, home_lat, home_lon, curfew_time, budget_preference, preferred_categories",
      )
      .eq("id", myId ?? "")
      .maybeSingle();

    const { loadMemberBases, fairPointFor } = await import("./fairpoint.server");
    const bases = await loadMemberBases(data.groupId);
    const fp = await fairPointFor(bases, (mine?.zip_code as string | null) ?? null);

    const curfew = ((mine?.curfew_time as string | null) ?? null)?.slice(0, 5) ?? null;
    const budget = (mine?.budget_preference as string | null) ?? null;
    const zip = (mine?.zip_code as string | null) ?? null;
    const homeAddress = (mine?.home_address as string | null) ?? null;

    const summaryBits = [
      curfew ? `${to12(curfew)} curfew` : null,
      fp?.label ? `${fp.label} area` : zip ? `${zip} area` : null,
      budget ? `${budget[0]!.toUpperCase()}${budget.slice(1)} budget` : null,
    ].filter(Boolean);

    return {
      me: {
        profileId: (myId as string | null) ?? null,
        name: (mine?.display_name as string) ?? "You",
        zip,
        homeAddress,
        homeLat: (mine?.home_lat as number | null) ?? null,
        homeLon: (mine?.home_lon as number | null) ?? null,
        curfew,
        budgetPreference: budget,
        radiusMiles: 10,
        dietary: [],
        categories: ((mine?.preferred_categories as string[] | null) ?? []).slice(0, 4),
      },

      members: bases.map((m) => ({
        profileId: m.profileId,
        name: m.name,
        emoji: m.emoji,
        avatarUrl: m.avatarUrl,
        zip: m.zip,
        lat: m.lat,
        lon: m.lon,
        curfew: m.curfew,
      })),
      fairPoint: fp
        ? { lat: fp.lat, lon: fp.lon, label: fp.label, zip: fp.zip, memberCount: fp.memberCount }
        : null,
      summary: summaryBits.length ? `Using your saved defaults (${summaryBits.join(" • ")})` : "",
    };
  });

function to12(hhmm: string) {
  const [h, m] = hhmm.split(":");
  const hour = Number(h);
  const suffix = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${m ?? "00"} ${suffix}`;
}

export type FairVenue = {
  key: string;
  title: string;
  subtitle: string;
  cuisine: string | null;
  kind: "food" | "activity";
  costMin: number;
  costMax: number;
  priceLevel: string;
  address: string | null;
  lat: number | null;
  lon: number | null;
  start: string;
  end: string;
  fairMiles: number | null;
  drives: { profileId: string; name: string; miles: number; minutes: number }[];
  curfewWarnings: { name: string; curfew: string; wrapsAt: string }[];
};

/** Fair-Point clustered venue discovery with per-member drive times. */
export const previewFairPointVenues = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      groupId: string;
      category: PlanCategory;
      vibe?: string | null;
      radiusMiles?: number | null;
      zipOverride?: string | null;
      maxSpend?: number | null;
      endTime?: string | null;
    }) => d,
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{
      origin: { lat: number; lon: number; label: string } | null;
      venues: FairVenue[];
    }> => {
      const { supabase } = context;
      const { data: membership } = await supabase
        .from("group_members")
        .select("id")
        .eq("group_id", data.groupId)
        .limit(1);
      if (!membership?.length) throw new Error("Forbidden");

      const { loadMemberBases, fairPointFor, drivesTo, curfewWarnings } =
        await import("./fairpoint.server");
      const bases = await loadMemberBases(data.groupId);
      const origin = await fairPointFor(bases, data.zipOverride ?? null);
      if (!origin) return { origin: null, venues: [] };

      const { searchVenuesGeoapify } = await import("./places.server");
      const { queryVenuesNear, haversineMiles, priceLevelFor } = await import("./location");
      const query = {
        origin,
        category: data.category,
        vibe: data.vibe ?? null,
        maxRadiusMiles: data.radiusMiles ?? 12,
        maxBudget: data.maxSpend ?? null,
        limit: 8,
      };
      const live = await searchVenuesGeoapify(query);
      const seeds = live.length ? live : queryVenuesNear(query);

      return {
        origin: { lat: origin.lat, lon: origin.lon, label: origin.label },
        venues: seeds.slice(0, 8).map((v) => {
          const drives = drivesTo(bases, { lat: v.lat ?? null, lon: v.lon ?? null });
          const end = data.endTime ?? v.end;
          return {
            key: v.key,
            title: v.title,
            subtitle: v.subtitle,
            cuisine: v.cuisine ?? null,
            kind: v.kind ?? "activity",
            costMin: v.costMin,
            costMax: v.costMax,
            priceLevel: v.priceLevel ?? priceLevelFor(v.costMax),
            address: v.address ?? null,
            lat: v.lat ?? null,
            lon: v.lon ?? null,
            start: v.start,
            end,
            fairMiles:
              v.lat != null && v.lon != null
                ? Math.round(haversineMiles(origin, { lat: v.lat, lon: v.lon }) * 10) / 10
                : null,
            drives,
            curfewWarnings: curfewWarnings(bases, end, drives),
          };
        }),
      };
    },
  );

/**
 * One-click AI plan: parses the prompt, creates the plan for the whole group,
 * seeds Fair-Point venue options, and returns the shareable join code.
 */
export const launchAiPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      groupId: string;
      prompt: string;
      useDefaults?: boolean;
      estCostMin?: number | null;
      estCostMax?: number | null;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const prompt = data.prompt.trim();
    if (!prompt) throw new Error("Describe the plan first");
    const { data: me } = await supabase.rpc("my_profile_id");
    if (!me) throw new Error("Profile missing");
    const { data: members } = await supabase
      .from("group_members")
      .select("profile_id")
      .eq("group_id", data.groupId);
    if (!members?.length) throw new Error("Forbidden");

    const { parseMagicPrompt } = await import("./ai.server");
    const draft = await parseMagicPrompt(prompt, new Date().toISOString().slice(0, 10));

    const { data: mine } = await supabase
      .from("profiles")
      .select("zip_code, curfew_time")
      .eq("id", me)
      .maybeSingle();

    const { loadMemberBases, fairPointFor, drivesTo, curfewWarnings } =
      await import("./fairpoint.server");
    const bases = await loadMemberBases(data.groupId);
    const origin = await fairPointFor(
      bases,
      draft.targetCityOrZip ?? (mine?.zip_code as string | null),
    );

    const startTime = draft.time ?? "18:30";
    const windowStart = draft.date ? `${draft.date}T${startTime}:00` : null;
    const endMins = hhmmToMin(startTime) + 150;
    const endTime = minToHHMM(endMins);
    const windowEnd = draft.date ? `${draft.date}T${endTime}:00` : null;

    const { data: plan, error } = await supabase
      .from("plans")
      .insert({
        group_id: data.groupId,
        created_by: me,
        title: draft.title.slice(0, 80),
        category: draft.category,
        window_start: windowStart,
        window_end: windowEnd,
        location_area: origin?.zip ?? draft.targetCityOrZip ?? null,
        search_radius_miles: draft.searchRadiusMiles ?? 12,
        est_cost_min: data.estCostMin ?? null,
        est_cost_max: data.estCostMax ?? null,
        status: "collecting",
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    await supabase
      .from("plan_participants")
      .insert(members.map((m) => ({ plan_id: plan.id, profile_id: m.profile_id })));

    let seeded = 0;
    if (origin) {
      const { searchVenuesGeoapify } = await import("./places.server");
      const { queryVenuesNear } = await import("./location");
      const query = {
        origin,
        category: draft.category,
        maxRadiusMiles: draft.searchRadiusMiles ?? 12,
        maxBudget: draft.maxSpendPerPerson,
        limit: 3,
      };
      const live = await searchVenuesGeoapify(query);
      const seeds = (live.length ? live : queryVenuesNear(query)).slice(0, 3);
      if (seeds.length) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("recommendations").insert(
          seeds.map((v, i) => {
            const drives = drivesTo(bases, { lat: v.lat ?? null, lon: v.lon ?? null });
            const warns = curfewWarnings(bases, endTime, drives);
            return {
              plan_id: plan.id,
              rank: i + 1,
              title: v.title,
              subtitle: v.subtitle,
              category: draft.category,
              cost_min: v.costMin,
              cost_max: v.costMax,
              travel_minutes: v.travelMinutes,
              suggested_start: startTime,
              suggested_end: endTime,
              location_name: v.location,
              lat: v.lat ?? null,
              lon: v.lon ?? null,
              address: v.address ?? null,
              tags: v.tags,
              score: 88 - i * 4,
              feasible: warns.length === 0,
              breakdown: {
                hardFailures: warns.length,
                budgetFit: 80,
                scheduleFit: warns.length ? 55 : 90,
                travelFit: 85,
                preferenceFit: 80,
                dietaryFit: 90,
                transportFit: 80,
                fairness: 85,
                reasons: [`Clustered around the group's fair point (${origin.label})`],
                cautions: warns.map(
                  (w) => `Wraps at ${w.wrapsAt}, past ${w.name}'s ${w.curfew} curfew`,
                ),
                venue: {
                  ...(v.address ? { address: v.address } : {}),
                  ...(v.distanceMiles != null ? { distanceMiles: v.distanceMiles } : {}),
                  ...(v.priceLevel ? { priceLevel: v.priceLevel } : {}),
                  ...(v.cuisine ? { cuisine: v.cuisine } : {}),
                  kind: v.kind ?? "activity",
                  ...(v.lat != null ? { lat: v.lat } : {}),
                  ...(v.lon != null ? { lon: v.lon } : {}),
                },
              } as never,
            };
          }),
        );
        seeded = seeds.length;
        await supabase.from("plans").update({ status: "voting" }).eq("id", plan.id);
      }
    }

    await supabase.from("activity_events").insert({
      group_id: data.groupId,
      plan_id: plan.id,
      actor_profile_id: me,
      type: "plan_created",
      message: `${plan.title} was launched with AI — options are ready`,
    });
    const { notifyGroupMembers } = await import("./notify.server");
    await notifyGroupMembers(data.groupId, {
      type: "plan_created",
      title: `New plan: ${plan.title}`,
      body: seeded
        ? "Vote on the fair-point options."
        : "Answer privately — nobody sees your answers.",
      exclude: me as string,
    });

    const { data: group } = await supabase
      .from("groups")
      .select("invite_code")
      .eq("id", data.groupId)
      .maybeSingle();

    return {
      planId: plan.id as string,
      title: plan.title as string,
      category: plan.category as string,
      date: draft.date,
      startTime,
      endTime,
      costPerPerson: draft.maxSpendPerPerson,
      areaLabel: origin?.label ?? null,
      optionCount: seeded,
      inviteCode: (group?.invite_code as string) ?? null,
    };
  });

function hhmmToMin(v: string) {
  const [h, m] = v.split(":");
  return Number(h) * 60 + Number(m ?? 0);
}
function minToHHMM(v: number) {
  const m = ((v % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
