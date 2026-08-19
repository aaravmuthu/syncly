import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, myProfileId, supabaseForUser, textResult } from "../supabase";

export default defineTool({
  name: "create_plan",
  title: "Create a plan",
  description:
    "Create a new Syncly plan in one of the signed-in member's circles and mark them as the attending host.",
  inputSchema: {
    circleId: z.string().uuid().describe("The circle the plan belongs to."),
    title: z.string().trim().describe("Short plan title, e.g. 'Friday dinner'."),
    category: z
      .enum(["food", "outdoors", "entertainment", "sports", "study", "other"])
      .describe("Plan category."),
    windowStart: z.string().optional().describe("ISO timestamp for the start of the plan window."),
    windowEnd: z.string().optional().describe("ISO timestamp for the end of the plan window."),
    locationArea: z.string().optional().describe("Rough area, e.g. 'Frisco, TX'."),
    notes: z.string().optional().describe("Anything the group should know."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const me = await myProfileId(supabase);

    const { data: plan, error } = await supabase
      .from("plans")
      .insert({
        group_id: input.circleId,
        created_by: me,
        title: input.title,
        category: input.category,
        window_start: input.windowStart ?? null,
        window_end: input.windowEnd ?? null,
        location_area: input.locationArea ?? null,
        notes: input.notes ?? null,
        status: "collecting",
      })
      .select("id, title, status")
      .single();
    if (error) return errorResult(error.message);

    await supabase
      .from("plan_participants")
      .insert({ plan_id: plan.id, profile_id: me, responded: true, attending: true });

    return textResult(`Created "${plan.title}" (id: ${plan.id}). You're marked as attending.`, { plan });
  },
});
