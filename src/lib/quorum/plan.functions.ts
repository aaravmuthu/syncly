import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as v from "./schemas";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ConstraintPayload } from "./types";
import { dbError, UPLOAD_FAILED } from "@/lib/db-error";

/* ------------------------------------------------------------------ */
/* Profile                                                             */
/* ------------------------------------------------------------------ */

const REAL_NAME = (n: unknown) =>
  typeof n === "string" && n.trim() !== "" && n.trim() !== "New member";

export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    // The profile's contact/location columns are not readable by the user
    // role (co-members must never see them), so the caller's own full row is
    // read through the trusted server client, always scoped to their user id.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileError) throw dbError(profileError, "getMe");
    let profile = data;
    if (profile) {
      // A profile that already carries a real display name is set up — never
      // send that person back through onboarding.
      if (!profile.onboarded && REAL_NAME(profile.display_name)) {
        const { data: fixed } = await supabaseAdmin
          .from("profiles")
          .update({ onboarded: true })
          .eq("user_id", userId)
          .select("*")
          .maybeSingle();
        profile = fixed ?? { ...profile, onboarded: true };
      }
    } else {
      const { data: created, error } = await supabaseAdmin
        .from("profiles")
        .upsert({ user_id: userId, display_name: "New member" }, { onConflict: "user_id" })
        .select("*")
        .single();
      if (error) throw dbError(error, "getMe");
      profile = created;
    }

    // Whether Family Hub is available at all -- the source of truth for this
    // is an actual guardian_links row, not the self-reported account_type
    // (which only decides the *onboarding* path, per the routing model).
    const { data: linkRow } = await supabaseAdmin
      .from("guardian_links")
      .select("id")
      .eq("guardian_profile_id", profile.id)
      .limit(1);

    return { ...profile, hasLinkedTeens: Boolean(linkRow?.length) };
  });

export const saveProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  // Settings forms hold loosely-typed values; the schema is the real gate.
  .inputValidator((d: Record<string, unknown>) => v.profilePatch.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
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
      "account_type",
      "phone",
      "share_contact_with_parents",
      "location_sharing_enabled",
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
      "phone",
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
    // Own-row reads/writes go through the trusted server client because the
    // private contact/location columns are not readable by the user role.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (Object.keys(patch).length === 0) {
      const { data: current } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .single();
      return current;
    }
    // Upsert so a first-time save creates the row instead of silently matching
    // zero rows.
    const { data: row, error } = await supabaseAdmin
      .from("profiles")
      .upsert({ ...patch, user_id: userId } as never, { onConflict: "user_id" })
      .select("*")
      .single();

    if (error) throw dbError(error, "saveProfile");
    return row;
  });

/** Uploads an avatar image (data URL) and returns a long-lived signed URL. */
export const uploadAvatar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ dataUrl: v.dataUrl, ext: v.text(10) }))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    const { parseImageUpload } = await import("./upload-safety.server");
    const { bytes, contentType, ext } = parseImageUpload(data.dataUrl);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const path = `${userId}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("avatars")
      .upload(path, bytes, { contentType, upsert: true });
    if (upErr) throw dbError(upErr, "uploadAvatar", UPLOAD_FAILED);
    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("avatars")
      .createSignedUrl(path, 60 * 60 * 24 * 3650);
    if (signErr || !signed)
      throw signErr ? dbError(signErr, "uploadAvatar") : new Error("Could not read image back");

    const { error } = await supabase
      .from("profiles")
      .update({ avatar_url: signed.signedUrl })
      .eq("user_id", userId);
    if (error) throw dbError(error, "uploadAvatar");
    return { avatar_url: signed.signedUrl };
  });

/**
 * Permanently deletes the caller's auth user. Groups and plans they own are
 * handed to another member first (or removed if nobody else is in them); then
 * `profiles.user_id` cascades, and every key to profiles either cascades or
 * clears the author (migration 20261009020000).
 */
export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: prepError } = await supabaseAdmin.rpc("prepare_account_deletion", {
      _user_id: context.userId,
    });
    if (prepError) throw dbError(prepError, "deleteAccount");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (error) throw dbError(error, "deleteAccount");
    return { ok: true as const };
  });

/* ------------------------------------------------------------------ */
/* Groups                                                              */
/* ------------------------------------------------------------------ */

export const listGroups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { settlePastPlans } = await import("./plan-lifecycle.server");
    await settlePastPlans();
    const { supabase } = context;
    const { data: me, error: meError } = await supabase.rpc("my_profile_id");
    if (meError) throw dbError(meError, "listGroups");
    if (!me) return [];
    const { data: memberships, error: membershipError } = await supabase
      .from("group_members")
      .select("group_id, role, groups(*)")
      .eq("profile_id", me);
    if (membershipError) throw dbError(membershipError, "listGroups");
    const groups = (memberships ?? []).map((m) => ({
      ...((m.groups ?? {}) as Record<string, unknown>),
      role: m.role,
    })) as unknown as (Record<string, unknown> & { id: string })[];
    const ids = groups.map((g) => g.id);
    if (!ids.length) return [];

    const [{ data: members, error: membersError }, { data: plans, error: plansError }] =
      await Promise.all([
        supabase
          .from("group_members")
          .select("group_id, profile_id, profiles(display_name, avatar_emoji, avatar_url)")
          .in("group_id", ids),
        supabase
          .from("plans")
          .select("id, group_id, title, status, window_start, location_area, created_at")
          .in("group_id", ids)
          .order("created_at", { ascending: false }),
      ]);

    if (membersError || plansError) throw dbError((membersError ?? plansError)!, "listGroups");
    const LIVE = new Set(["collecting", "recommending", "voting"]);
    return groups.map((g) => {
      const mine = (members ?? []).filter((m) => m.group_id === g.id);
      const gPlans = (plans ?? []).filter((p) => p.group_id === g.id);
      const active = gPlans.find((p) => LIVE.has(String(p.status)));
      const done = gPlans.filter((p) => p.status === "completed" || p.status === "finalized");
      const spots = new Map<string, number>();
      for (const p of done) {
        const area = (p.location_area ?? "").trim();
        if (area) spots.set(area, (spots.get(area) ?? 0) + 1);
      }
      const topSpot = [...spots.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      return {
        ...g,
        member_count: mine.length,
        members: mine.slice(0, 5).map((m) => {
          const p = (m.profiles ?? {}) as Record<string, unknown>;
          return {
            profile_id: m.profile_id,
            display_name: (p["display_name"] as string) ?? "Member",
            avatar_emoji: (p["avatar_emoji"] as string) ?? "🙂",
            avatar_url: (p["avatar_url"] as string) ?? null,
          };
        }),
        active_plan: active ? { id: active.id, title: active.title, status: active.status } : null,
        hangouts_completed: done.length,
        top_spot: topSpot,
      };
    });
  });

export const createGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      name: v.reqText(80),
      emoji: v.emoji.optional(),
      kind: z.enum(["permanent", "temporary"]).optional(),
      purpose: v.text(300).optional(),
      avatarUrl: v.optHttpsUrl,
      coverTheme: v.text(40).optional(),
    }),
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
        avatar_url: data.avatarUrl ?? null,
        cover_theme: data.coverTheme ?? "obsidian_emerald",
        created_by: me,
        invite_code: (await import("./invite")).generateInviteCode(),
      })
      .select("*")
      .single();
    if (error) throw dbError(error, "createGroup");
    const { error: memberError } = await supabase
      .from("group_members")
      .insert({ group_id: group.id, profile_id: me, role: "owner" });
    if (memberError) throw dbError(memberError, "createGroup");
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
  .inputValidator(z.object({ code: v.token }))
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
    const { error: memberError } = await supabaseAdmin
      .from("group_members")
      .upsert(
        { group_id: group.id, profile_id: me, role: "member" },
        { onConflict: "group_id,profile_id" },
      );
    if (memberError) throw dbError(memberError, "joinGroup");
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
  .inputValidator(z.object({ groupId: v.id }))
  .handler(async ({ data, context }) => {
    const { settlePastPlans } = await import("./plan-lifecycle.server");
    await settlePastPlans();
    const { supabase } = context;
    const { data: me } = await supabase.rpc("my_profile_id");
    const { data: group, error } = await supabase
      .from("groups")
      .select("*")
      .eq("id", data.groupId)
      .single();
    if (error) throw dbError(error, "getGroup");
    const { data: members } = await supabase
      .from("group_members")
      .select(
        "role, profile_id, profiles(id, display_name, avatar_emoji, avatar_url, bio, school, grad_year)",
      )
      .eq("group_id", data.groupId);
    const { data: plans } = await supabase
      .from("plans")
      .select(
        "*, plan_participants(profile_id, responded, attending, profiles(display_name, avatar_emoji, avatar_url)), plan_conflicts(id, resolved)",
      )
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
    const { settlePastPlans } = await import("./plan-lifecycle.server");
    await settlePastPlans();
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
    const { settlePastPlans } = await import("./plan-lifecycle.server");
    await settlePastPlans();
    const { supabase } = context;
    const { data: myId, error: profileError } = await supabase.rpc("my_profile_id");
    const { data: plans, error: plansError } = await supabase
      .from("plans")
      .select("*, groups(id, name, emoji)")
      .order("created_at", { ascending: false })
      .limit(40);
    if (profileError || plansError) throw dbError((profileError ?? plansError)!, "getDashboard");
    const list = plans ?? [];
    if (list.length === 0) return { myProfileId: myId ?? null, plans: [] };

    const ids = list.map((p) => p.id as string);
    const [
      { data: parts, error: partsError },
      { data: votes, error: votesError },
      { data: recs, error: recsError },
      { data: conflicts, error: conflictsError },
      { data: rides, error: ridesError },
    ] = await Promise.all([
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
          "id, plan_id, title, subtitle, location_name, address, lat, lon, suggested_start, suggested_end, cost_min, cost_max, tags, rank, breakdown",
        )
        .in("plan_id", ids)
        .order("rank"),
      supabase
        .from("plan_conflicts")
        .select("id, plan_id, kind, detail")
        .in("plan_id", ids)
        .eq("resolved", false),
      supabase
        .from("transport_assignments")
        .select(
          "id, plan_id, car_label, driver_label, leg, passenger_profile_ids, driver_profile_id, vehicle_desc, vehicle_color, vehicle_plate, departed_at, eta_minutes, driver:profiles!transport_assignments_driver_profile_id_fkey(display_name)",
        )
        .in("plan_id", ids),
    ]);

    const readError = partsError ?? votesError ?? recsError ?? conflictsError ?? ridesError;
    if (readError) throw dbError(readError, "getDashboard");
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
        // Budget fit of the plan's current leading option (or the finalized
        // pick once locked in) — the % of the group this option's cost works
        // for, never which member it doesn't. See ScoreBreakdown.budgetFit.
        const budgetFitSource = selected ?? planRecs[0] ?? null;
        const budget_fit =
          (budgetFitSource?.breakdown as { budgetFit?: number } | null)?.budgetFit ?? null;
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
          i_attending: meRow?.attending == null ? null : Boolean(meRow.attending),
          i_voted: planVotes.some((v) => v.profile_id === myId),
          budget_fit,
          selected_recommendation: selected,
          conflicts: planConflicts.map((c) => ({
            id: c.id as string,
            kind: c.kind as string,
            detail: (c.detail as string | null) ?? null,
          })),
          rides: (rides ?? [])
            .filter((r) => r.plan_id === p.id)
            .map((r) => ({
              id: r.id as string,
              car_label: (r.car_label as string) ?? "Car",
              leg: (r.leg as string) ?? "there",
              seats_taken: ((r.passenger_profile_ids as string[] | null) ?? []).length,
              driver_name:
                ((r.driver as unknown as { display_name?: string } | null)?.display_name ??
                  (r.driver_label as string | null)) ||
                null,
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
    const { data, error } = await context.supabase
      .from("activity_events")
      .select(
        "id, type, message, created_at, plan_id, group_id, actor_profile_id, actor:profiles!activity_events_actor_profile_id_fkey(display_name, avatar_url, avatar_emoji)",
      )
      .not("group_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(40);
    if (error) throw dbError(error, "listActivity");
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
        actorId: (row as { actor_profile_id: string | null }).actor_profile_id,
        actorName: actor?.display_name ?? null,
        actorAvatarUrl: actor?.avatar_url ?? null,
        actorEmoji: actor?.avatar_emoji ?? null,
      };
    });
  });

export const createPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      groupId: v.id,
      title: v.reqText(120),
      category: v.planCategory,
      windowStart: v.optTimeish,
      windowEnd: v.optTimeish,
      locationArea: v.optText(200),
      zipCode: v.optText(10),
      foodVibe: v.optText(200),
      radiusMiles: v.optAmount(500),
      estCostMin: v.optAmount(100_000),
      estCostMax: v.optAmount(100_000),
      participantIds: z.array(v.id).max(100).optional(),
    }),
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
    if (error) throw dbError(error, "createPlan");

    const ids = new Set([me, ...(data.participantIds ?? [])]);
    await supabase.from("plan_participants").insert(
      [...ids].map((profile_id) => ({
        plan_id: plan.id,
        profile_id,
        // The host is automatically in — they organized it.
        responded: profile_id === me,
        attending: profile_id === me,
      })),
    );
    await supabase.from("activity_events").insert({
      group_id: data.groupId,
      plan_id: plan.id,
      actor_profile_id: me,
      type: "plan_created",
      message: `${plan.title} needs everyone's private answers`,
    });
    const { postSystemEvent } = await import("./chat.server");
    await postSystemEvent(data.groupId, plan.id, {
      type: "plan_created",
      content: `New plan launched: ${plan.title}`,
      meta: {
        title: plan.title,
        cost:
          plan.est_cost_min != null || plan.est_cost_max != null
            ? `💵 $${plan.est_cost_min ?? plan.est_cost_max}–$${plan.est_cost_max ?? plan.est_cost_min}/person`
            : undefined,
      },
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
  .inputValidator(z.object({ planId: v.id }))
  .handler(async ({ data, context }) => {
    const { settlePastPlans } = await import("./plan-lifecycle.server");
    await settlePastPlans();
    const { supabase } = context;
    const { data: me } = await supabase.rpc("my_profile_id");
    const { data: plan, error } = await supabase
      .from("plans")
      .select("*, groups(id, name, emoji)")
      .eq("id", data.planId)
      .single();
    if (error) throw dbError(error, "getPlan");

    const { data: participants, error: participantsError } = await supabase
      .from("plan_participants")
      .select("*, profiles(id, display_name, avatar_emoji, avatar_url, bio, school, grad_year)")
      .eq("plan_id", data.planId);
    const { data: recommendations, error: recommendationsError } = await supabase
      .from("recommendations")
      .select("*")
      .eq("plan_id", data.planId)
      .order("rank");
    const { data: votes, error: votesError } = await supabase
      .from("votes")
      .select("*")
      .eq("plan_id", data.planId);
    const { data: transport, error: transportError } = await supabase
      .from("transport_assignments")
      .select("*")
      .eq("plan_id", data.planId);
    const { data: approvals, error: approvalsError } = await supabase
      .from("parent_approvals")
      // Never ship the parent token to plan viewers — it is a bearer credential
      // that lets the holder answer the approval. Only status is needed here.
      .select("id, profile_id, status, expires_at, decided_via")
      .eq("plan_id", data.planId);

    // Approval status is group-visible. Condition text is private and read
    // with elevated access only for the caller's own approval rows.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ownApprovals, error: ownApprovalsError } = me
      ? await supabaseAdmin
          .from("parent_approvals")
          .select("id, condition_text")
          .eq("plan_id", data.planId)
          .eq("profile_id", me)
      : { data: [], error: null };

    // Only the caller's own private answers are ever returned.
    const { data: mine, error: mineError } = await supabase
      .from("plan_constraints")
      .select("payload")
      .eq("plan_id", data.planId)
      .eq("profile_id", me ?? "")
      .maybeSingle();

    const readError =
      participantsError ??
      recommendationsError ??
      votesError ??
      transportError ??
      approvalsError ??
      ownApprovalsError ??
      mineError;
    if (readError) throw dbError(readError, "getPlan");
    return {
      plan,
      meProfileId: me as string | null,
      participants: participants ?? [],
      recommendations: recommendations ?? [],
      votes: votes ?? [],
      transport: transport ?? [],
      approvals: (approvals ?? []).map((approval) => ({
        ...approval,
        condition_text: ownApprovals?.find((own) => own.id === approval.id)?.condition_text ?? null,
      })),
      myConstraints: (mine?.payload as ConstraintPayload | undefined) ?? null,
    };
  });

export const submitConstraints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ planId: v.id, payload: v.constraintPayload }))
  .handler(async ({ data, context }) => {
    const { assertPlanOpen } = await import("./plan-lifecycle.server");
    await assertPlanOpen(data.planId);
    const { supabase } = context;
    const { data: me } = await supabase.rpc("my_profile_id");
    if (!me) throw new Error("Profile missing");
    const { error } = await supabase
      .from("plan_constraints")
      .upsert(
        { plan_id: data.planId, profile_id: me, payload: data.payload as never },
        { onConflict: "plan_id,profile_id" },
      );
    if (error) throw dbError(error, "submitConstraints");
    const { error: participantError } = await supabase
      .from("plan_participants")
      .update({ responded: true, attending: true })
      .eq("plan_id", data.planId)
      .eq("profile_id", me);
    if (participantError) throw dbError(participantError, "submitConstraints");
    // A score is valid only for the answers used to compute it. Reopen the
    // plan and remove the previous choices before anyone can lock them in.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: invalidateError } = await supabaseAdmin
      .from("recommendations")
      .delete()
      .eq("plan_id", data.planId);
    if (invalidateError) throw dbError(invalidateError, "submitConstraints");
    const { error: reopenError } = await supabaseAdmin
      .from("plans")
      .update({ status: "collecting", selected_recommendation_id: null, compatibility_score: null })
      .eq("id", data.planId);
    if (reopenError) throw dbError(reopenError, "submitConstraints");
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
  .inputValidator(z.object({ planId: v.id, shuffle: v.amount(1_000_000).optional() }))
  .handler(async ({ data, context }) => {
    // Authorize as the user first — only a plan participant may run this.
    const { data: allowed } = await context.supabase.rpc("can_see_plan", { _plan_id: data.planId });
    if (!allowed) throw new Error("Forbidden");
    const { assertPlanOpen } = await import("./plan-lifecycle.server");
    await assertPlanOpen(data.planId);
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
  .inputValidator(z.object({ planId: v.id, recommendationId: v.id }))
  .handler(async ({ data, context }) => {
    const { assertPlanOpen } = await import("./plan-lifecycle.server");
    await assertPlanOpen(data.planId);
    const { supabase } = context;
    const { data: me } = await supabase.rpc("my_profile_id");
    if (!me) throw new Error("Profile missing");
    const { data: option, error: optionError } = await supabase
      .from("recommendations")
      .select("id, feasible")
      .eq("id", data.recommendationId)
      .eq("plan_id", data.planId)
      .maybeSingle();
    if (optionError) throw dbError(optionError, "castVote");
    if (!option?.feasible) throw new Error("Choose an available option that works for everyone");
    const { error } = await supabase
      .from("votes")
      .upsert(
        { plan_id: data.planId, profile_id: me, recommendation_id: data.recommendationId },
        { onConflict: "plan_id,profile_id" },
      );
    if (error) throw dbError(error, "castVote");
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
  .inputValidator(z.object({ planId: v.id, recommendationId: v.id }))
  .handler(async ({ data, context }) => {
    const { assertPlanOpen } = await import("./plan-lifecycle.server");
    await assertPlanOpen(data.planId);
    const { supabase } = context;
    const { data: allowed } = await supabase.rpc("can_see_plan", { _plan_id: data.planId });
    if (!allowed) throw new Error("Forbidden");
    // Plan status is server-managed (the user role can't write it), so the
    // lock-in goes through the service role once membership is confirmed.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: option } = await supabaseAdmin
      .from("recommendations")
      .select("id, feasible")
      .eq("id", data.recommendationId)
      .eq("plan_id", data.planId)
      .maybeSingle();
    if (!option) throw new Error("That option isn't on this plan");
    if (!option.feasible)
      throw new Error(
        "This option does not meet every member's requirements. Refresh the options before locking it in.",
      );
    const { error } = await supabaseAdmin
      .from("plans")
      .update({ status: "finalized", selected_recommendation_id: data.recommendationId })
      .eq("id", data.planId);
    if (error) throw dbError(error, "finalizePlan");
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
      const { data: rec } = await supabase
        .from("recommendations")
        .select("title, location_name, suggested_start")
        .eq("id", data.recommendationId)
        .maybeSingle();
      const where = rec?.location_name ?? rec?.title ?? "the chosen spot";
      const when = rec?.suggested_start ? ` at ${String(rec.suggested_start).slice(0, 5)}` : "";
      const { postSystemEvent } = await import("./chat.server");
      await postSystemEvent(plan.group_id, data.planId, {
        type: "plan_locked",
        content: `${plan.title ?? "The plan"} is locked in — ${where}${when}`,
      });
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
  .inputValidator(
    z.object({
      planId: v.id,
      parentName: v.text(100).optional(),
      parentEmail: z.union([z.string().trim().email().max(254), z.literal("")]).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: me } = await supabase.rpc("my_profile_id");
    if (!me) throw new Error("Profile missing");
    const { data: allowed } = await supabase.rpc("can_see_plan", { _plan_id: data.planId });
    if (!allowed) throw new Error("Forbidden");
    // The user role can't write parent_approvals (a teen could otherwise file
    // an already-"approved" row), so the pending request is created here.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { alertGuardians, guardianIdsFor } = await import("./guardian.server");
    // A linked guardian answers in the Family hub. Handing the teen a link as
    // well would let them open it and approve their own plan.
    const hasGuardian = (await guardianIdsFor(me)).length > 0;
    // The token is a bearer credential: it is generated here and handed back
    // exactly once. Clients can no longer read the token column at all.
    const token = crypto.randomUUID().replace(/-/g, "");
    const { data: inserted, error } = await supabaseAdmin
      .from("parent_approvals")
      .insert({
        plan_id: data.planId,
        profile_id: me,
        token,
        parent_name: data.parentName ?? null,
        parent_email: data.parentEmail ?? null,
        // Link expires in a week; approve.$token.tsx / getApprovalStatus reject reads past this.
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select("id")
      .single();
    if (error) throw dbError(error, "requestParentApproval");
    const row = hasGuardian
      ? { id: inserted.id, token: null, sentToGuardian: true }
      : { id: inserted.id, token, sentToGuardian: false };
    const { data: plan } = await supabase
      .from("plans")
      .select("title")
      .eq("id", data.planId)
      .maybeSingle();
    await alertGuardians(me, {
      type: "approval_requested",
      title: `Approval needed: ${plan?.title ?? "a new plan"}`,
      body: "Open the Family hub to see the venue, cost, rides and timing.",
      planId: data.planId,
      priority: "high",
    });
    return row;
  });

/**
 * Mints the signature for the "share parent summary link" flow
 * (/approve/<planId>.<sig>). Only a caller who can already see this plan
 * (a group member) can mint one -- the resulting link is what makes it safe
 * to hand to someone with no Syncly account, not the plan id by itself.
 */
export const getSummaryShareLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ planId: v.id }))
  .handler(async ({ data, context }) => {
    const { data: allowed } = await context.supabase.rpc("can_see_plan", { _plan_id: data.planId });
    if (!allowed) throw new Error("Forbidden");
    const { signPlanSummary } = await import("./summary-link.server");
    return { planId: data.planId, sig: signPlanSummary(data.planId) };
  });
