import { createServerFn } from "@tanstack/react-start";

/**
 * Public, token-scoped. A parent sees exactly one plan's logistics — never the
 * group's members, private answers, or anything else about their child's account.
 */
export const getApproval = createServerFn({ method: "GET" })
  .inputValidator((d: { token: string }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("parent_approvals")
      .select("id, status, condition_text, expires_at, plan_id, profile_id")
      .eq("token", data.token)
      .maybeSingle();
    if (!row) return null;

    const { data: plan } = await supabaseAdmin
      .from("plans")
      .select("title, category, window_start, selected_recommendation_id")
      .eq("id", row.plan_id)
      .single();
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("display_name")
      .eq("id", row.profile_id)
      .single();

    let details: {
      title: string;
      location_name: string | null;
      suggested_start: string | null;
      suggested_end: string | null;
      cost_min: number | null;
      cost_max: number | null;
    } | null = null;
    if (plan?.selected_recommendation_id) {
      const { data: rec } = await supabaseAdmin
        .from("recommendations")
        .select("title, location_name, suggested_start, suggested_end, cost_min, cost_max")
        .eq("id", plan.selected_recommendation_id)
        .maybeSingle();
      details = rec ?? null;
    }
    const { data: cars } = await supabaseAdmin
      .from("transport_assignments")
      .select("car_label, driver_label")
      .eq("plan_id", row.plan_id);

    return {
      status: row.status,
      conditionText: row.condition_text,
      expiresAt: row.expires_at,
      childName: profile?.display_name ?? "Your child",
      planTitle: plan?.title ?? "A plan",
      category: plan?.category ?? "",
      date: plan?.window_start ?? null,
      details,
      cars: cars ?? [],
    };
  });

export const respondToApproval = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { token: string; decision: "approved" | "approved_with_condition" | "declined"; condition?: string }) => d,
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("parent_approvals")
      .select("id, expires_at, status, plan_id, profile_id")
      .eq("token", data.token)
      .maybeSingle();
    if (!row) throw new Error("This link is not valid");
    if (new Date(row.expires_at) < new Date()) throw new Error("This link has expired");

    const condition =
      data.decision === "approved_with_condition" ? (data.condition?.trim() || null) : null;

    const { error } = await supabaseAdmin
      .from("parent_approvals")
      .update({
        status: data.decision,
        condition_text: condition,
        responded_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (error) throw new Error(error.message);

    // A condition becomes a private constraint for that member, then the whole
    // group's options are recalculated against it.
    if (condition) {
      const { applyParentCondition, regenerateRecommendations } = await import("./recommend.server");
      await applyParentCondition(row.plan_id, row.profile_id, condition);
      try {
        await regenerateRecommendations(row.plan_id);
      } catch {
        /* recalculation is best-effort; the response itself is already saved */
      }
    }

    await supabaseAdmin.from("activity_events").insert({
      plan_id: row.plan_id,
      group_id: null,
      type: "parent_response",
      message:
        data.decision === "declined"
          ? "A permission request was declined"
          : condition
            ? "A permission request was approved with a condition"
            : "A permission request was approved",
    });

    return { ok: true };
  });
