import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { optionsForCategory } from "./catalog";
import { buildTransportPlan, rankOptions, type MemberInput } from "./engine";
import type { ConstraintPayload, PlanCategory } from "./types";

/* ------------------------------------------------------------------ */
/* Profile                                                             */
/* ------------------------------------------------------------------ */

const REAL_NAME = (n: unknown) =>
  typeof n === "string" && n.trim() !== "" && n.trim() !== "New member";

export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (data) {
      // A profile that already carries a real display name is set up — never
      // send that person back through onboarding.
      if (!data.onboarded && REAL_NAME(data.display_name)) {
        const { data: fixed } = await supabase
          .from("profiles")
          .update({ onboarded: true })
          .eq("user_id", userId)
          .select("*")
          .maybeSingle();
        return fixed ?? { ...data, onboarded: true };
      }
      return data;
    }
    const { data: created, error } = await supabase
      .from("profiles")
      .upsert({ user_id: userId, display_name: "New member" }, { onConflict: "user_id" })
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
      "avatar_url",
      "bio",
      "school",
      "grad_year",
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
      "zip_code",
      "theme_preference",
      "home_address",
      "home_lat",
      "home_lon",
    ] as const;
    const nullable = new Set([
      "curfew_time",
      "zip_code",
      "home_area",
      "home_address",
      "home_lat",
      "home_lon",
      "budget_preference",
      "age",
      "avatar_url",
      "bio",
      "school",
      "grad_year",
    ]);
    const patch: Record<string, unknown> = {};
    for (const k of allowed) {
      if (!(k in data)) continue;
      let v = data[k];
      // Empty inputs must clear the column, not fail the write with "".
      if (typeof v === "string" && v.trim() === "" && nullable.has(k)) v = null;
      if ((k === "age" || k === "grad_year") && v != null && v !== "") {
        const n = Number(v);
        v = Number.isFinite(n) ? Math.trunc(n) : null;
      }
      if (k === "home_lat" || k === "home_lon") {
        const n = Number(v);
        v = v == null || v === "" || !Number.isFinite(n) ? null : n;
      }
      if (k === "bio" && typeof v === "string") v = v.slice(0, 160);
      patch[k] = v;
    }
    if (REAL_NAME(patch["display_name"])) patch["onboarded"] = true;
    if (Object.keys(patch).length === 0) {
      const { data: current } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .single();
      return current;
    }
    // Upsert so a first-time save creates the row instead of silently matching
    // zero rows.
    const { data: row, error } = await supabase
      .from("profiles")
      .upsert({ ...patch, user_id: userId } as never, { onConflict: "user_id" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

/** Uploads an avatar image (data URL) and returns a long-lived signed URL. */
export const uploadAvatar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { dataUrl: string; ext: string }) => d)
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    const match = /^data:([^;]+);base64,(.+)$/.exec(data.dataUrl);
    if (!match) throw new Error("Unsupported image");
    const contentType = match[1];
    if (!/^image\/(png|jpeg|jpg|gif|webp)$/.test(contentType)) {
      throw new Error("Use a PNG, JPG, GIF, or WebP image");
    }
    const bytes = Buffer.from(match[2], "base64");
    if (bytes.byteLength > 5 * 1024 * 1024) throw new Error("Image must be under 5 MB");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const path = `${userId}/${Date.now()}.${data.ext.replace(/[^a-z0-9]/gi, "").slice(0, 5) || "png"}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("avatars")
      .upload(path, bytes, { contentType, upsert: true });
    if (upErr) throw new Error(upErr.message);
    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("avatars")
      .createSignedUrl(path, 60 * 60 * 24 * 3650);
    if (signErr || !signed) throw new Error(signErr?.message ?? "Could not read image back");

    const { error } = await supabase
      .from("profiles")
      .update({ avatar_url: signed.signedUrl })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { avatar_url: signed.signedUrl };
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
      ...((m.groups ?? {}) as Record<string, unknown>),
      role: m.role,
    })) as unknown as (Record<string, unknown> & { id: string })[];
    const ids = groups.map((g) => g.id);
    if (!ids.length) return [];
    const { data: counts } = await supabase
      .from("group_members")
      .select("group_id, profile_id")
      .in("group_id", ids);
    return groups.map((g) => ({
      ...g,
      member_count: (counts ?? []).filter((c) => c.group_id === g.id).length,
    }));
  });

export const createGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { name: string; emoji?: string; kind?: "permanent" | "temporary"; purpose?: string }) => d,
  )
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
    await supabase
      .from("group_members")
      .insert({ group_id: group.id, profile_id: me, role: "owner" });
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
      .upsert(
        { group_id: group.id, profile_id: me, role: "member" },
        { onConflict: "group_id,profile_id" },
      );
    await supabaseAdmin.from("activity_events").insert({
      group_id: group.id,
      actor_profile_id: me,
      type: "member_joined",
      message: "A new member joined the group",
    });
    const { notifyGroupMembers } = await import("./notify.server");
    await notifyGroupMembers(group.id, {
      type: "member_joined",
      title: `Someone joined ${group.name}`,
      exclude: me as string,
    });
    return group;
  });

export const getGroup = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { groupId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: me } = await supabase.rpc("my_profile_id");
    const { data: group, error } = await supabase
      .from("groups")
      .select("*")
      .eq("id", data.groupId)
      .single();
    if (error) throw new Error(error.message);
    const { data: members } = await supabase
      .from("group_members")
      .select(
        "role, profile_id, profiles(id, display_name, avatar_emoji, avatar_url, bio, school, grad_year)",
      )
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
    return {
      group,
      members: members ?? [],
      plans: plans ?? [],
      activity: activity ?? [],
      myProfileId: (me as string | null) ?? null,
    };
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

/**
 * Dashboard digest: every plan the caller can see, enriched with the response
 * progress of its participants, whether the caller still owes an action, and
 * the selected venue (with coordinates) once the plan is finalized.
 */
export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: myId } = await supabase.rpc("my_profile_id");
    const { data: plans } = await supabase
      .from("plans")
      .select("*, groups(id, name, emoji)")
      .order("created_at", { ascending: false })
      .limit(40);
    const list = plans ?? [];
    if (list.length === 0) return { myProfileId: myId ?? null, plans: [] };

    const ids = list.map((p) => p.id as string);
    const [{ data: parts }, { data: votes }, { data: recs }, { data: conflicts }] =
      await Promise.all([
        supabase
          .from("plan_participants")
          .select(
            "plan_id, profile_id, responded, attending, profiles(display_name, avatar_emoji, avatar_url)",
          )
          .in("plan_id", ids),
        supabase.from("votes").select("plan_id, profile_id").in("plan_id", ids),
        supabase
          .from("recommendations")
          .select(
            "id, plan_id, title, subtitle, location_name, address, lat, lon, suggested_start, suggested_end, cost_min, cost_max, tags, rank",
          )
          .in("plan_id", ids)
          .order("rank"),
        supabase
          .from("plan_conflicts")
          .select("id, plan_id, kind, detail")
          .in("plan_id", ids)
          .eq("resolved", false),
      ]);

    return {
      myProfileId: (myId as string | null) ?? null,
      plans: list.map((p) => {
        const mine = (parts ?? []).filter((r) => r.plan_id === p.id);
        const planVotes = (votes ?? []).filter((v) => v.plan_id === p.id);
        const selected = (recs ?? []).find((r) => r.id === p.selected_recommendation_id) ?? null;
        const meRow = mine.find((r) => r.profile_id === myId);
        const planConflicts = (conflicts ?? []).filter((c) => c.plan_id === p.id);
        const planRecs = (recs ?? []).filter((r) => r.plan_id === p.id);
        const alternatives = planRecs.filter((r) =>
          ((r.tags as string[] | null) ?? []).includes("alternative"),
        );
        const original = planRecs.find(
          (r) => !((r.tags as string[] | null) ?? []).includes("alternative"),
        );
        return {
          ...p,
          participants: mine.map((r) => {
            const pr = r.profiles as unknown as Record<string, unknown> | null;
            return {
              profile_id: r.profile_id as string,
              responded: Boolean(r.responded),
              name: (pr?.["display_name"] as string) ?? "Member",
              emoji: (pr?.["avatar_emoji"] as string) ?? null,
              avatar_url: (pr?.["avatar_url"] as string) ?? null,
            };
          }),
          responded_count: mine.filter((r) => r.responded).length,
          participant_count: mine.length,
          vote_count: planVotes.length,
          i_responded: Boolean(meRow?.responded),
          i_voted: planVotes.some((v) => v.profile_id === myId),
          selected_recommendation: selected,
          conflicts: planConflicts.map((c) => ({
            id: c.id as string,
            kind: c.kind as string,
            detail: (c.detail as string | null) ?? null,
          })),
          alternatives: alternatives.map((r) => ({
            id: r.id as string,
            title: r.title as string,
            subtitle: (r.subtitle as string | null) ?? null,
            cost_min: r.cost_min as number | null,
            cost_max: r.cost_max as number | null,
            suggested_start: (r.suggested_start as string | null) ?? null,
            tags: ((r.tags as string[] | null) ?? []) as string[],
          })),
          original_option: original
            ? { id: original.id as string, title: original.title as string }
            : null,
        };
      }),
    };
  });

/** Group-visible feed only: RLS keeps it to groups the caller belongs to. */
export const listActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("activity_events")
      .select(
        "id, type, message, created_at, plan_id, group_id, actor:profiles!activity_events_actor_profile_id_fkey(display_name, avatar_url, avatar_emoji)",
      )
      .not("group_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(40);
    return (data ?? []).map((row) => {
      const actorRaw = (row as { actor?: unknown }).actor;
      const actor = (Array.isArray(actorRaw) ? actorRaw[0] : actorRaw) as
        | { display_name: string | null; avatar_url: string | null; avatar_emoji: string | null }
        | null
        | undefined;
      return {
        id: row.id,
        type: row.type,
        message: row.message,
        created_at: row.created_at,
        plan_id: row.plan_id,
        group_id: row.group_id,
        actorName: actor?.display_name ?? null,
        actorAvatarUrl: actor?.avatar_url ?? null,
        actorEmoji: actor?.avatar_emoji ?? null,
      };
    });
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
      zipCode?: string | null;
      foodVibe?: string | null;
      radiusMiles?: number | null;
      estCostMin?: number | null;
      estCostMax?: number | null;
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
        location_area: data.zipCode?.trim() || data.locationArea || null,
        food_vibe: data.foodVibe || null,
        search_radius_miles: data.radiusMiles ?? null,
        est_cost_min: data.estCostMin ?? null,
        est_cost_max: data.estCostMax ?? null,
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
    const { notifyGroupMembers } = await import("./notify.server");
    await notifyGroupMembers(data.groupId, {
      type: "plan_created",
      title: `New plan: ${plan.title}`,
      body: "Answer privately — nobody sees what you put in.",
      exclude: me as string,
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
      .select("*, profiles(id, display_name, avatar_emoji, avatar_url, bio, school, grad_year)")
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
      // Never ship the parent token to plan viewers — it is a bearer credential
      // that lets the holder answer the approval. Only status is needed here.
      .select("id, profile_id, status, condition_text, expires_at")
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

    const { data: roster } = await supabase
      .from("plan_participants")
      .select("responded, attending")
      .eq("plan_id", data.planId);
    const going = (roster ?? []).filter((r) => r.attending !== false);
    if (going.length && going.every((r) => r.responded)) {
      const { notifyPlanParticipants } = await import("./notify.server");
      await notifyPlanParticipants(data.planId, {
        type: "all_answered",
        title: "Everyone has answered",
        body: "Compatible options can be generated now.",
      });
    }
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Recommendation generation                                           */
/* ------------------------------------------------------------------ */

export const generateRecommendations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { planId: string; shuffle?: number }) => d)
  .handler(async ({ data, context }) => {
    // Authorize as the user first — only a plan participant may run this.
    const { data: allowed } = await context.supabase.rpc("can_see_plan", { _plan_id: data.planId });
    if (!allowed) throw new Error("Forbidden");
    // Private answers are read with elevated access ONLY inside the engine,
    // aggregated there, and never returned per person.
    const { regenerateRecommendations } = await import("./recommend.server");
    return regenerateRecommendations(data.planId, data.shuffle ?? 0);
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
    const { notifyPlanParticipants } = await import("./notify.server");
    await notifyPlanParticipants(data.planId, {
      type: "vote_cast",
      title: "A vote was cast",
      body: "Someone in the group picked an option.",
      exclude: me as string,
    });
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
    const { data: plan } = await supabase
      .from("plans")
      .select("group_id, title")
      .eq("id", data.planId)
      .maybeSingle();
    const { notifyPlanParticipants } = await import("./notify.server");
    await notifyPlanParticipants(data.planId, {
      type: "plan_finalized",
      title: `${plan?.title ?? "The plan"} is locked in`,
      body: "Check the plan hub for time, place, cost and rides.",
    });
    if (plan?.group_id) {
      const { refreshGroupMemory } = await import("./memory.server");
      await refreshGroupMemory(plan.group_id);
    }
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
