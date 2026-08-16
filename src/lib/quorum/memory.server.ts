// Server-only "group memory": aggregate, non-identifying patterns a group can
// reuse to pre-fill future plans. Never stores an individual's numbers.

export async function refreshGroupMemory(groupId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: plans } = await supabaseAdmin
    .from("plans")
    .select("id, category, location_area, selected_recommendation_id")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(40);
  if (!plans?.length) return;

  const tally = new Map<string, number>();
  for (const p of plans) tally.set(p.category, (tally.get(p.category) ?? 0) + 1);
  const favorite_activities = [...tally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category, count]) => ({ category, count }));

  const areas = new Map<string, number>();
  for (const p of plans) {
    const a = (p.location_area ?? "").trim();
    if (a) areas.set(a, (areas.get(a) ?? 0) + 1);
  }
  const common_locations = [...areas.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([area, count]) => ({ area, count }));

  const chosenIds = plans.map((p) => p.selected_recommendation_id).filter(Boolean) as string[];
  let avg_spend_min: number | null = null;
  let avg_spend_max: number | null = null;
  const favorite_places: { title: string; count: number }[] = [];
  if (chosenIds.length) {
    const { data: recs } = await supabaseAdmin
      .from("recommendations")
      .select("title, cost_min, cost_max, travel_minutes")
      .in("id", chosenIds);
    const mins = (recs ?? []).map((r) => Number(r.cost_min ?? 0));
    const maxes = (recs ?? []).map((r) => Number(r.cost_max ?? 0));
    if (mins.length) {
      avg_spend_min = Math.round(mins.reduce((a, b) => a + b, 0) / mins.length);
      avg_spend_max = Math.round(maxes.reduce((a, b) => a + b, 0) / maxes.length);
    }
    const places = new Map<string, number>();
    for (const r of recs ?? []) places.set(r.title, (places.get(r.title) ?? 0) + 1);
    favorite_places.push(
      ...[...places.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([title, count]) => ({ title, count })),
    );
  }

  const travelSource = plans.length;
  await supabaseAdmin.from("group_preferences").upsert(
    {
      group_id: groupId,
      favorite_activities: favorite_activities as never,
      favorite_places: favorite_places as never,
      common_locations: common_locations as never,
      avg_spend_min,
      avg_spend_max,
      typical_travel_minutes: travelSource ? 25 : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "group_id" },
  );
}
