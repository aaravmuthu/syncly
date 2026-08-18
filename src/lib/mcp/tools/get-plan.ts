import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, myProfileId, supabaseForUser, textResult } from "../supabase";

export default defineTool({
  name: "get_plan",
  title: "Get plan details",
  description:
    "Get one Quorum plan: timing, status, who is attending, the shortlisted options with vote counts, and ride assignments.",
  inputSchema: { planId: z.string().uuid().describe("The plan id.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ planId }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const supabase = supabaseForUser(ctx);
    await myProfileId(supabase);

    const { data: plan, error } = await supabase
      .from("plans")
      .select(
        "id, title, category, status, window_start, window_end, location_area, notes, est_cost_min, est_cost_max, selected_recommendation_id, groups(name, emoji)",
      )
      .eq("id", planId)
      .maybeSingle();
    if (error) return errorResult(error.message);
    if (!plan) return errorResult("That plan does not exist or you cannot see it.");

    const [{ data: parts }, { data: recs }, { data: votes }, { data: cars }] = await Promise.all([
      supabase
        .from("plan_participants")
        .select("attending, responded, profiles(display_name, avatar_emoji)")
        .eq("plan_id", planId),
      supabase
        .from("recommendations")
        .select("id, title, location_name, cost_min, cost_max, travel_minutes, score, rank")
        .eq("plan_id", planId)
        .order("rank"),
      supabase.from("votes").select("recommendation_id").eq("plan_id", planId),
      supabase
        .from("transport_assignments")
        .select("car_label, driver_label, leg, eta_minutes")
        .eq("plan_id", planId),
    ]);

    const voteCount = new Map<string, number>();
    for (const v of votes ?? []) voteCount.set(v.recommendation_id, (voteCount.get(v.recommendation_id) ?? 0) + 1);

    const g = plan.groups as unknown as { name: string; emoji: string } | null;
    const roster = (parts ?? []).map((p) => {
      const pr = p.profiles as unknown as { display_name: string; avatar_emoji: string } | null;
      return { name: pr?.display_name ?? "Member", attending: p.attending, responded: p.responded };
    });
    const options = (recs ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      locationName: r.location_name,
      costMin: r.cost_min,
      costMax: r.cost_max,
      travelMinutes: r.travel_minutes,
      score: r.score,
      votes: voteCount.get(r.id) ?? 0,
      selected: r.id === plan.selected_recommendation_id,
    }));

    const lines = [
      `${plan.title} — ${plan.status}${g ? ` in ${g.emoji} ${g.name}` : ""}`,
      plan.window_start ? `When: ${plan.window_start}${plan.window_end ? ` → ${plan.window_end}` : ""}` : null,
      plan.location_area ? `Area: ${plan.location_area}` : null,
      roster.length
        ? `Going: ${roster.filter((r) => r.attending).map((r) => r.name).join(", ") || "nobody yet"}`
        : null,
      options.length
        ? `Options:\n${options.map((o) => `  • ${o.title}${o.locationName ? ` (${o.locationName})` : ""} — ${o.votes} vote(s)${o.selected ? " · picked" : ""}`).join("\n")}`
        : null,
      (cars ?? []).length
        ? `Rides:\n${(cars ?? []).map((c) => `  • ${c.car_label} ${c.driver_label ? `driven by ${c.driver_label}` : ""} (${c.leg})`).join("\n")}`
        : null,
    ].filter(Boolean);

    return textResult(lines.join("\n"), { plan: { ...plan, roster, options, cars: cars ?? [] } });
  },
});
