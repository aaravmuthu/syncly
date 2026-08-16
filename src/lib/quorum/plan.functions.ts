import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { optionsForCategory } from "./catalog";
import { buildTransportPlan, rankOptions, type MemberInput } from "./engine";
import type { ConstraintPayload, PlanCategory } from "./types";

/* ------------------------------------------------------------------ */
/* Profile                                                             */
/* ------------------------------------------------------------------ */

export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle();
    if (data) return data;
    const { data: created, error } = await supabase
      .from("profiles")
      .insert({ user_id: userId, display_name: "New member" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return created;
  });

export const saveProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const allowed = [
      "display_name",
      "avatar_emoji",
      "age",
      "home_area",
      "budget_preference",
      "curfew_time",
      "independence_level",
      "needs_transportation",
      "parent_approval_required",
      "preferred_categories",
      "personalization_enabled",
      "parent_features_enabled",
      "transport_features_enabled",
      "notifications_enabled",
      "onboarded",
    ] as const;
    const patch: Record<string, unknown> = {};
    for (const k of allowed) if (k in data) patch[k] = data[k];
    const { data: row, error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("user_id", userId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

/* ------------------------------------------------------------------ */
/* Groups                                                              */
/* ------------------------------------------------------------------ */

export const listGroups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: me } = await supabase.rpc("my_profile_id");
    if (!me) return [];
    const { data: memberships } = await supabase
      .from("group_members")
      .select("group_id, role, groups(*)")
      .eq("profile_id", me);
    const groups = (memberships ?? []).map((m) => ({
      ...(m.groups as Record<string, unknown>),
      role: m.role,
    }));
    const ids = groups.map((g) => g["id"] as string);
    if (!ids.length) return [];
    const { data: counts } = await supabase
      .from("group_members")
      .select("group_id, profile_id")
      .in("group_id", ids);
    return groups.map((g) => ({
      ...g,
      member_count: (counts ?? []).filter((c) => c.group_id === g["id"]).length,
    }));
  });

export const createGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string; emoji?: string; kind?: "permanent" | "temporary"; purpose?: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: me } = await supabase.rpc("my_profile_id");
    if (!me) throw new Error("Profile missing");
    const { data: group, error } = await supabase
      .from("groups")
      .insert({
        name: data.name.trim(),
        emoji: data.emoji ?? "✨",
        kind: data.kind ?? "permanent",
        purpose: data.purpose ?? null,
        created_by: me,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await supabase.from("group_members").insert({ group_id: group.id, profile_id: me, role: "owner" });
    await supabase.from("activity_events").insert({
      group_id: group.id,
      actor_profile_id: me,
      type: "group_created",
      message: `${data.name} was created`,
    });
    return group;
  });

export const joinGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { code: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: me } = await supabase.rpc("my_profile_id");
    if (!me) throw new Error("Profile missing");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const code = data.code.trim().toUpperCase();
    const { data: group } = await supabaseAdmin
      .from("groups")
      .select("id, name, emoji")
      .eq("invite_code", code)
      .maybeSingle();
    if (!group) throw new Error("That invite code doesn't match a group");
    await supabaseAdmin
      .from("group_members")
      .upsert({ group_id: group.id, profile_id: me, role: "member" }, { onConflict: "group_id,profile_id" });
    await supabaseAdmin.from("activity_events").insert({
      group_id: group.id,
      actor_profile_id: me,
      type: "member_joined",
      message: "A new member joined the group",
    });
    return group;
  });

export const getGroup = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { groupId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: group, error } = await supabase
      .from("groups")
      .select("*")
      .eq("id", data.groupId)
      .single();
    if (error) throw new Error(error.message);
    const { data: members } = await supabase
      .from("group_members")
      .select("role, profile_id, profiles(id, display_name, avatar_emoji)")
      .eq("group_id", data.groupId);
    const { data: plans } = await supabase
      .from("plans")
      .select("*")
      .eq("group_id", data.groupId)
      .order("created_at", { ascending: false });
    const { data: activity } = await supabase
      .from("activity_events")
      .select("*")
      .eq("group_id", data.groupId)
      .order("created_at", { ascending: false })
      .limit(12);
    return { group, members: members ?? [], plans: plans ?? [], activity: activity ?? [] };
  });

/* ------------------------------------------------------------------ */
/* Plans                                                               */
/* ------------------------------------------------------------------ */

export const listPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data } = await supabase
      .from("plans")
      .select("*, groups(name, emoji)")
      .order("created_at", { ascending: false })
      .limit(30);
    return data ?? [];
  });

export const createPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      groupId: string;
      title: string;
      category: PlanCategory;
      windowStart?: string | null;
      windowEnd?: string | null;
      locationArea?: string | null;
      participantIds?: string[];
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: me } = await supabase.rpc("my_profile_id");
    if (!me) throw new Error("Profile missing");
    const { data: plan, error } = await supabase
      .from("plans")
      .insert({
        group_id: data.groupId,
        created_by: me,
        title: data.title.trim(),
        category: data.category,
        window_start: data.windowStart || null,
        window_end: data.windowEnd || null,
        location_area: data.locationArea || null,
        status: "collecting",
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    const ids = new Set([me, ...(data.participantIds ?? [])]);
    await supabase
      .from("plan_participants")
      .insert([...ids].map((profile_id) => ({ plan_id: plan.id, profile_id })));
    await supabase.from("activity_events").insert({
      group_id: data.groupId,
      plan_id: plan.id,
      actor_profile_id: me,
      type: "plan_created",
      message: `${plan.title} needs everyone's private answers`,
    });
    return plan;
  });

export const getPlan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { planId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: me } = await supabase.rpc("my_profile_id");
    const { data: plan, error } = await supabase
      .from("plans")
      .select("*, groups(id, name, emoji)")
      .eq("id", data.planId)
      .single();
    if (error) throw new Error(error.message);

    const { data: participants } = await supabase
      .from("plan_participants")
      .select("*, profiles(id, display_name, avatar_emoji)")
      .eq("plan_id", data.planId);
    const { data: recommendations } = await supabase
      .from("recommendations")
      .select("*")
      .eq("plan_id", data.planId)
      .order("rank");
    const { data: votes } = await supabase.from("votes").select("*").eq("plan_id", data.planId);
    const { data: transport } = await supabase
      .from("transport_assignments")
      .select("*")
      .eq("plan_id", data.planId);
    const { data: approvals } = await supabase
      .from("parent_approvals")
      .select("id, profile_id, status, condition_text, token, expires_at")
      .eq("plan_id", data.planId);

    // Only the caller's own private answers are ever returned.
    const { data: mine } = await supabase
      .from("plan_constraints")
      .select("payload")
      .eq("plan_id", data.planId)
      .eq("profile_id", me ?? "")
      .maybeSingle();

    return {
      plan,
      meProfileId: me as string | null,
      participants: participants ?? [],
      recommendations: recommendations ?? [],
      votes: votes ?? [],
      transport: transport ?? [],
      approvals: approvals ?? [],
      myConstraints: (mine?.payload as ConstraintPayload | undefined) ?? null,
    };
  });

export const submitConstraints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { planId: string; payload: ConstraintPayload }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: me } = await supabase.rpc("my_profile_id");
    if (!me) throw new Error("Profile missing");
    const { error } = await supabase
      .from("plan_constraints")
      .upsert(
        { plan_id: data.planId, profile_id: me, payload: data.payload as never },
        { onConflict: "plan_id,profile_id" },
      );
    if (error) throw new Error(error.message);
    await supabase
      .from("plan_participants")
      .update({ responded: true, attending: true })
      .eq("plan_id", data.planId)
      .eq("profile_id", me);
    await supabase.from("activity_events").insert({
      plan_id: data.planId,
      type: "constraints_submitted",
      message: "Someone submitted their private answers",
    });
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Recommendation generation                                           */
/* ------------------------------------------------------------------ */

export const generateRecommendations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { planId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // Authorize as the user first — only a plan participant may run this.
    const { data: allowed } = await supabase.rpc("can_see_plan", { _plan_id: data.planId });
    if (!allowed) throw new Error("Forbidden");

    // Private answers are read with elevated access ONLY inside this handler,
    // aggregated, and never returned per person.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: plan } = await supabaseAdmin
      .from("plans")
      .select("*")
      .eq("id", data.planId)
      .single();
    if (!plan) throw new Error("Plan not found");

    const { data: participants } = await supabaseAdmin
      .from("plan_participants")
      .select("profile_id, attending, profiles(display_name)")
      .eq("plan_id", data.planId);
    const { data: constraintRows } = await supabaseAdmin
      .from("plan_constraints")
      .select("profile_id, payload")
      .eq("plan_id", data.planId);

    const attending = (participants ?? []).filter((p) => p.attending !== false);
    const members: MemberInput[] = attending.map((p) => ({
      profileId: p.profile_id,
      constraints:
        ((constraintRows ?? []).find((c) => c.profile_id === p.profile_id)?.payload as ConstraintPayload) ?? {},
    }));

    const ranked = rankOptions(optionsForCategory(plan.category as PlanCategory), members).slice(0, 6);

    await supabaseAdmin.from("recommendations").delete().eq("plan_id", data.planId);
    const rows = ranked.map((r, i) => ({
      plan_id: data.planId,
      rank: i + 1,
      title: r.option.title,
      subtitle: r.option.subtitle,
      category: plan.category,
      cost_min: r.option.costMin,
      cost_max: r.option.costMax,
      travel_minutes: r.option.travelMinutes,
      suggested_start: r.option.start,
      suggested_end: r.option.end,
      location_name: r.option.location,
      tags: r.option.tags,
      score: r.score,
      feasible: r.feasible,
      breakdown: r.breakdown as never,
    }));
    const { data: inserted, error } = await supabaseAdmin
      .from("recommendations")
      .insert(rows)
      .select("*");
    if (error) throw new Error(error.message);

    const best = ranked[0];
    await supabaseAdmin
      .from("plans")
      .update({ status: "voting", compatibility_score: best?.score ?? null })
      .eq("id", data.planId);

    // Transport plan for the top option.
    if (best) {
      const named = attending.map((p) => ({
        profileId: p.profile_id,
        name: (p.profiles as { display_name?: string } | null)?.display_name ?? "Member",
        constraints:
          ((constraintRows ?? []).find((c) => c.profile_id === p.profile_id)?.payload as ConstraintPayload) ?? {},
      }));
      const tp = buildTransportPlan(best.option, named);
      await supabaseAdmin.from("transport_assignments").delete().eq("plan_id", data.planId);
      if (tp.cars.length) {
        await supabaseAdmin.from("transport_assignments").insert(
          tp.cars.map((c) => ({
            plan_id: data.planId,
            car_label: c.label,
            driver_label: c.driver,
            passenger_profile_ids: [],
            leg: "both",
          })),
        );
      }
    }

    await supabaseAdmin.from("activity_events").insert({
      plan_id: data.planId,
      group_id: plan.group_id,
      type: "recommendations_ready",
      message: "Compatible options are ready to review",
    });

    return { count: inserted?.length ?? 0 };
  });

/* ------------------------------------------------------------------ */
/* Voting + finalizing                                                 */
/* ------------------------------------------------------------------ */

export const castVote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { planId: string; recommendationId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: me } = await supabase.rpc("my_profile_id");
    if (!me) throw new Error("Profile missing");
    const { error } = await supabase
      .from("votes")
      .upsert(
        { plan_id: data.planId, profile_id: me, recommendation_id: data.recommendationId },
        { onConflict: "plan_id,profile_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const finalizePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { planId: string; recommendationId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("plans")
      .update({ status: "finalized", selected_recommendation_id: data.recommendationId })
      .eq("id", data.planId);
    if (error) throw new Error(error.message);
    await supabase.from("activity_events").insert({
      plan_id: data.planId,
      type: "plan_finalized",
      message: "The plan is locked in",
    });
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Parent approvals                                                    */
/* ------------------------------------------------------------------ */

export const requestParentApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { planId: string; parentName?: string; parentEmail?: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: me } = await supabase.rpc("my_profile_id");
    if (!me) throw new Error("Profile missing");
    const { data: row, error } = await supabase
      .from("parent_approvals")
      .insert({
        plan_id: data.planId,
        profile_id: me,
        parent_name: data.parentName ?? null,
        parent_email: data.parentEmail ?? null,
      })
      .select("id, token")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
