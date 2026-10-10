import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as v from "./schemas";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { dbError } from "@/lib/db-error";
import { isValidTimeZone, zonedDateKey, zonedToInstant } from "./plan-time";
import {
  STOP_KIND_IDS,
  STOP_KINDS,
  costRange,
  itinerarySchema,
  timeline,
  type ItineraryDraft,
  type ItineraryVenue,
} from "./itinerary";

/**
 * The Magic AI plan builder runs as a few small calls instead of one big one,
 * so the client can show each real step as it lands: draft (the one AI call),
 * then one venue lookup per stop, then the forecast, then launch.
 */

export type ItineraryOrigin = { lat: number; lon: number; label: string; zip: string };

/**
 * Step 1: the AI drafts the night (stops, order, timing, invite line), then
 * the starting point is resolved: a place the request names, else the
 * group's Fair-Point, else the caller's own home ZIP.
 */
export const startItinerary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      prompt: v.reqText(2000),
      groupId: v.optId,
      timeZone: z.string().max(64).optional(),
    }),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{ draft: ItineraryDraft; origin: ItineraryOrigin | null; fairCount: number }> => {
      const { supabase } = context;
      const prompt = data.prompt.trim();
      if (!prompt) throw new Error("Describe the plan first");
      if (data.groupId) {
        // RLS: this only returns rows for groups the caller belongs to.
        const { data: membership } = await supabase
          .from("group_members")
          .select("id")
          .eq("group_id", data.groupId)
          .limit(1);
        if (!membership?.length) throw new Error("Forbidden");
      }

      const { assertAiQuota } = await import("@/lib/ai-quota.server");
      await assertAiQuota(context.userId, "itinerary_draft");
      const tz = data.timeZone && isValidTimeZone(data.timeZone) ? data.timeZone : "UTC";
      const { draftItinerary } = await import("./ai.server");
      const draft = await draftItinerary(prompt, zonedDateKey(new Date().toISOString(), tz));

      const { normalizeZip } = await import("./location");
      const { geocodeZipServer } = await import("./location.server");
      let origin: ItineraryOrigin | null = null;
      let fairCount = 0;

      if (draft.area) {
        let zip = normalizeZip(draft.area);
        if (!zip) {
          const { suggestPlacesServer, reverseZipServer } = await import("./places.server");
          const [hit] = await suggestPlacesServer(draft.area);
          if (hit) zip = normalizeZip(hit.zip) ?? (await reverseZipServer(hit.lat, hit.lon));
        }
        origin = zip ? await geocodeZipServer(zip) : null;
      }
      if (!origin && data.groupId) {
        const { loadMemberBases, fairPointFor } = await import("./fairpoint.server");
        const fair = await fairPointFor(await loadMemberBases(data.groupId));
        if (fair) {
          origin = { lat: fair.lat, lon: fair.lon, label: fair.label, zip: fair.zip };
          fairCount = fair.memberCount;
        }
      }
      if (!origin) {
        // The caller's own private location: read through the trusted client,
        // scoped to their own profile, and only ever returned to them.
        const { data: me } = await supabase.rpc("my_profile_id");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: mine } = await supabaseAdmin
          .from("profiles")
          .select("zip_code, home_lat, home_lon")
          .eq("id", me ?? "")
          .maybeSingle();
        const zip = normalizeZip(mine?.zip_code as string | null);
        const geo = zip ? await geocodeZipServer(zip) : null;
        if (geo) origin = geo;
      }
      return { draft, origin, fairCount };
    },
  );

/**
 * Step 2, once per stop: up to three real venues for that stop near `near`
 * (the starting point for the first stop, the previous stop's pick after).
 */
export const scoutItineraryStop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      kind: z.enum(STOP_KIND_IDS),
      near: z.object({
        lat: z.number().min(-90).max(90),
        lon: z.number().min(-180).max(180),
        label: v.optText(120),
        zip: v.optText(10),
      }),
      radiusMiles: v.optAmount(60),
      maxSpend: v.optAmount(10_000),
      exclude: z.array(z.string().max(200)).max(12).optional(),
    }),
  )
  .handler(async ({ data }): Promise<ItineraryVenue[]> => {
    const { searchVenuesGeoapify } = await import("./places.server");
    const def = STOP_KINDS[data.kind];
    const skip = new Set(data.exclude ?? []);
    const search = (radius: number) =>
      searchVenuesGeoapify({
        origin: {
          lat: data.near.lat,
          lon: data.near.lon,
          label: data.near.label ?? "Nearby",
          zip: data.near.zip ?? "",
        },
        category: def.planCategory,
        categoriesOverride: def.categories,
        maxRadiusMiles: radius,
        maxBudget: data.maxSpend ?? null,
        limit: 14,
      });
    // Close by first; widen once before giving up on a rarer kind of place.
    const radius = data.radiusMiles ?? 8;
    let seeds = await search(radius);
    if (seeds.length < 3) seeds = await search(Math.min(radius * 2.5, 40));

    const seen = new Set<string>();
    const venues: ItineraryVenue[] = [];
    for (const s of seeds) {
      const name = s.title.toLowerCase().trim();
      if (s.lat == null || s.lon == null || skip.has(s.key) || seen.has(name)) continue;
      seen.add(name);
      venues.push({
        key: s.key.slice(0, 200),
        title: s.title.slice(0, 120),
        address: s.address?.slice(0, 240) ?? null,
        lat: s.lat,
        lon: s.lon,
        costMin: s.costMin,
        costMax: s.costMax,
        rating: s.rating != null ? Math.min(Math.max(s.rating, 0), 5) : null,
      });
      if (venues.length === 3) break;
    }
    return venues;
  });

/** Step 3: the day's forecast at the first stop. */
export const itineraryForecast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      lat: z.number().min(-90).max(90),
      lon: z.number().min(-180).max(180),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
  )
  .handler(async ({ data }) => {
    const { fetchForecast } = await import("./weather.server");
    const f = await fetchForecast(data.lat, data.lon, data.date);
    if (!f) return null;
    return {
      emoji: f.emoji,
      line: `${f.label} · ${Math.round(f.tempMaxF)}°/${Math.round(f.tempMinF)}° · ${f.precipProbability}% rain`,
      outdoorRisk: f.alert,
    };
  });

/**
 * Step 4: launches the itinerary as a plan for the whole group. No AI here --
 * the host already reviewed every stop. The anchor stop sets the plan's
 * category, so private answers and the fairness vote work on it as on any
 * plan; the full itinerary rides along for everyone to see.
 */
export const launchItinerary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      groupId: v.id,
      timeZone: z.string().max(64).optional(),
      itinerary: itinerarySchema,
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const it = data.itinerary;
    if (it.anchor >= it.stops.length) throw new Error("Pick which stop the group votes on");
    if (it.stops.some((s) => s.pick >= Math.max(s.options.length, 1))) {
      throw new Error("Every stop needs a pick");
    }
    const { data: me } = await supabase.rpc("my_profile_id");
    if (!me) throw new Error("Profile missing");
    const { data: members } = await supabase
      .from("group_members")
      .select("profile_id")
      .eq("group_id", data.groupId);
    if (!members?.length) throw new Error("Forbidden");

    const tz = data.timeZone && isValidTimeZone(data.timeZone) ? data.timeZone : "UTC";
    const { totalMinutes } = timeline(it);
    const windowStart = it.date ? zonedToInstant(it.date, it.start, tz) : null;
    const windowEnd = windowStart
      ? new Date(new Date(windowStart).getTime() + totalMinutes * 60_000).toISOString()
      : null;
    const cost = costRange(it);
    const anchor = it.stops[it.anchor]!;

    const { data: plan, error } = await supabase
      .from("plans")
      .insert({
        group_id: data.groupId,
        created_by: me,
        title: it.title,
        category: STOP_KINDS[anchor.kind].planCategory,
        window_start: windowStart,
        window_end: windowEnd,
        location_area: it.zip,
        search_radius_miles: 12,
        est_cost_min: cost.max ? cost.min : null,
        est_cost_max: cost.max ? cost.max : null,
        itinerary: it,
        status: "collecting",
      })
      .select("id, title")
      .single();
    if (error) throw dbError(error, "launchItinerary");

    const { error: participantError } = await supabase
      .from("plan_participants")
      .insert(members.map((m) => ({ plan_id: plan.id, profile_id: m.profile_id })));
    if (participantError) throw dbError(participantError, "launchItinerary");

    await supabase.from("activity_events").insert({
      group_id: data.groupId,
      plan_id: plan.id,
      actor_profile_id: me,
      type: "plan_created",
      message: `${plan.title} was planned with Sync — ${it.stops.length} stop${it.stops.length === 1 ? "" : "s"}, private answers are next`,
    });
    const { notifyGroupMembers } = await import("./notify.server");
    await notifyGroupMembers(data.groupId, {
      type: "plan_created",
      title: `New plan: ${plan.title}`,
      body: it.invite || "Answer privately — nobody sees your answers.",
      exclude: me as string,
    });

    return { planId: plan.id as string, title: plan.title as string };
  });
