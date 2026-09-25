import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as v from "./schemas";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  ConciergeAction,
  ConciergeTurn,
  GuardianAiSummary,
  SquadDigest,
  SynclyPlanRef,
  VibeRank,
} from "./aiplus.server";

export type {
  ConciergeAction,
  ConciergeTurn,
  GuardianAiSummary,
  SquadDigest,
  SynclyPlanRef,
  VibeRank,
};

/**
 * Human relative-day label ("today", "this weekend", "in 3 days", "Sep 12")
 * computed server-side so the model reuses it verbatim instead of doing its
 * own (often wrong) date arithmetic from a raw ISO timestamp.
 */
function relativeDay(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const days = Math.round(
    (startOfDay(d).getTime() - startOfDay(new Date()).getTime()) / 86_400_000,
  );
  if (days < 0) return null;
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days <= 6) {
    const isWeekendDay = d.getDay() === 0 || d.getDay() === 6;
    return isWeekendDay && days >= 2 ? "this weekend" : `in ${days} days`;
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/* ------------------------------------------------------------------ */
/* 1. Plan concierge chat                                              */
/* ------------------------------------------------------------------ */

export type ConciergeAnswer = {
  answer: string;
  action?: ConciergeAction;
  isHost: boolean;
  groupId: string;
};

/**
 * Answers a free-text question about one plan. Only group-safe aggregates are
 * sent to the model — never an individual member's private constraint answers.
 */
export const askPlanConcierge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ planId: v.id, question: v.reqText(2000), history: v.conciergeHistory.optional() }),
  )
  .handler(async ({ data, context }): Promise<ConciergeAnswer> => {
    const question = data.question.trim();
    if (!question) throw new Error("Ask a question first");

    const { supabase } = context;
    const { data: allowed } = await supabase.rpc("can_see_plan", { _plan_id: data.planId });
    if (!allowed) throw new Error("Forbidden");

    const [{ data: plan }, { data: recs }, { data: parts }, { data: votes }, { data: isOwner }] =
      await Promise.all([
        supabase
          .from("plans")
          .select(
            "id, title, category, status, window_start, window_end, est_cost_min, est_cost_max, notes, group_id, groups(name)",
          )
          .eq("id", data.planId)
          .maybeSingle(),
        supabase
          .from("recommendations")
          .select(
            "id, title, subtitle, cost_min, cost_max, travel_minutes, address, tags, score, rank",
          )
          .eq("plan_id", data.planId)
          .order("rank"),
        supabase
          .from("plan_participants")
          .select("profile_id, responded, attending")
          .eq("plan_id", data.planId),
        supabase.from("votes").select("recommendation_id").eq("plan_id", data.planId),
        supabase.rpc("is_plan_owner", { _plan_id: data.planId }),
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
        id: r.id,
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
    const { answer, action } = await conciergeReply(facts, data.history ?? [], question);
    return {
      answer,
      ...(action ? { action } : {}),
      isHost: Boolean(isOwner),
      groupId: plan.group_id as string,
    };
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
        : Promise.resolve({
            data: [] as { plan_id: string; profile_id: string; responded: boolean }[],
          }),
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
          when: relativeDay((p.window_start as string | null) ?? null),
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
  .inputValidator(
    z.object({ query: v.text(500), kind: v.spotKind.optional(), radiusMiles: v.optAmount(500) }),
  )
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
      origin: {
        lat: origin.lat,
        lon: origin.lon,
        label: origin.label,
        zip: profile?.zip_code ?? "",
      },
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
        openHours: s.openHours ?? null,
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
        address: p.address,
        openHours: p.openHours,
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
  .inputValidator(z.object({ teenProfileId: v.optId }))
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
      return {
        summary: "No linked teens yet — share a sync code to get started.",
        watchouts: [],
        aiGenerated: false,
      };
    }

    // Delays/checkins have no plan_id — correlate by time proximity instead
    // of leaving the model to guess which plan (if any) a given event
    // belongs to. A generous 3h pad around the plan window covers early
    // arrivals and running-late check-ins without matching an unrelated plan.
    const PAD_MS = 3 * 60 * 60 * 1000;
    const relatedPlanTitle = (atIso: string): string | null => {
      const at = new Date(atIso).getTime();
      if (Number.isNaN(at)) return null;
      for (const p of teen.plans) {
        if (!p.window_start) continue;
        const start = new Date(p.window_start).getTime() - PAD_MS;
        const end = (p.window_end ? new Date(p.window_end).getTime() : start) + PAD_MS;
        if (at >= start && at <= end) return p.title;
      }
      return null;
    };

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
      delays: teen.delays.slice(0, 3).map((d) => ({
        reason: d.reason,
        minutes: d.minutes,
        relatedPlan: relatedPlanTitle(d.created_at),
      })),
      checkins: teen.checkins.slice(0, 3).map((c) => ({
        status: c.status,
        place: c.place_label,
        relatedPlan: relatedPlanTitle(c.created_at),
      })),
    };

    const { writeGuardianSummary } = await import("./aiplus.server");
    return writeGuardianSummary(facts);
  });

/* ------------------------------------------------------------------ */
/* 5. Ask Syncly — site-wide assistant                                 */
/* ------------------------------------------------------------------ */

/** Resolved, client-facing action -- groupId is filled in server-side from an authoritative membership query, never taken from the model. */
export type SynclyAction = {
  type: "create_plan";
  groupId: string;
  groupName: string;
  prompt: string;
};

export type SynclyAnswer = { answer: string; planRef?: SynclyPlanRef; action?: SynclyAction };

const LIVE_STATUSES = new Set(["collecting", "recommending", "voting"]);

/**
 * Free-text question answered with a bird's-eye view across every group the
 * member is in — not scoped to one plan like the Plan Concierge. Same
 * group-safe-aggregates rule: never a member's private constraint answers.
 */
export const askSyncly = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ question: v.reqText(2000), history: v.conciergeHistory.optional() }))
  .handler(async ({ data, context }): Promise<SynclyAnswer> => {
    const question = data.question.trim();
    if (!question) throw new Error("Ask a question first");

    const { supabase } = context;
    const { data: myId } = await supabase.rpc("my_profile_id");
    const [{ data: plans }, { data: activity }, { data: myGroups }] = await Promise.all([
      supabase
        .from("plans")
        .select("id, title, status, window_start, groups(name)")
        .order("created_at", { ascending: false })
        .limit(25),
      supabase
        .from("activity_events")
        .select("message, created_at")
        .not("group_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(8),
      // Authoritative group list (with real ids) the caller actually belongs
      // to -- used both as the facts the model can name and, after a reply,
      // to resolve a proposed create_plan action's group name back to a real
      // id server-side. The model is never trusted with an id directly.
      // Filtered to the caller's own membership rows -- group_members' RLS
      // policy grants roster visibility (every member of a group you're in),
      // so an unfiltered select here would return one row per fellow member,
      // duplicating each group once per person in it.
      supabase
        .from("group_members")
        .select("groups(id, name)")
        .eq("profile_id", myId as string),
    ]);
    const list = plans ?? [];
    const ids = list.map((p) => p.id as string);
    const groupRoster = (myGroups ?? [])
      .map((g) => g.groups as unknown as { id?: string; name?: string } | null)
      .filter((g): g is { id: string; name: string } => Boolean(g?.id && g.name));

    const [{ data: parts }, { data: votes }] = await Promise.all([
      ids.length
        ? supabase
            .from("plan_participants")
            .select("plan_id, profile_id, responded")
            .in("plan_id", ids)
        : Promise.resolve({
            data: [] as { plan_id: string; profile_id: string; responded: boolean }[],
          }),
      ids.length
        ? supabase.from("votes").select("plan_id, profile_id").in("plan_id", ids)
        : Promise.resolve({ data: [] as { plan_id: string; profile_id: string }[] }),
    ]);

    const groupOf = (p: (typeof list)[number]) =>
      (p.groups as unknown as { name?: string } | null)?.name ?? "your squad";
    const now = Date.now();

    const activeByGroup = new Map<string, number>();
    for (const p of list) {
      if (LIVE_STATUSES.has(p.status as string)) {
        const g = groupOf(p);
        activeByGroup.set(g, (activeByGroup.get(g) ?? 0) + 1);
      }
    }

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
        .slice(0, 5)
        .map((p) => ({
          plan_id: p.id,
          title: p.title,
          group: groupOf(p),
          status: p.status,
        })),
      upcoming: list
        .filter(
          (p) =>
            p.status === "finalized" &&
            p.window_start &&
            new Date(p.window_start as string).getTime() > now,
        )
        .slice(0, 5)
        .map((p) => ({
          plan_id: p.id,
          title: p.title,
          group: groupOf(p),
          when: relativeDay((p.window_start as string | null) ?? null),
        })),
      // Every group the member is actually in, not just ones with an active
      // plan right now -- so "plan something with X" works for a quiet group too.
      groups: groupRoster.map((g) => ({
        name: g.name,
        activePlans: activeByGroup.get(g.name) ?? 0,
      })),
      recentActivity: (activity ?? []).map((a) => ({
        message: a.message,
        when: relativeDay(a.created_at as string),
      })),
    };

    const { synclyReply } = await import("./aiplus.server");
    const reply = await synclyReply(facts, data.history ?? [], question);

    let action: SynclyAction | undefined;
    if (reply.action?.type === "create_plan") {
      const wanted = reply.action.groupName.trim().toLowerCase();
      const match =
        groupRoster.find((g) => g.name.toLowerCase() === wanted) ??
        groupRoster.find(
          (g) => g.name.toLowerCase().includes(wanted) || wanted.includes(g.name.toLowerCase()),
        );
      // Drop the action entirely rather than propose one against a group the
      // model misnamed or that the caller isn't actually in -- the confirm
      // card would have nothing valid to act on otherwise.
      if (match) {
        action = {
          type: "create_plan",
          groupId: match.id,
          groupName: match.name,
          prompt: reply.action.prompt,
        };
      }
    }

    return {
      answer: reply.answer,
      ...(reply.planRef ? { planRef: reply.planRef } : {}),
      ...(action ? { action } : {}),
    };
  });
