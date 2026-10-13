import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, myProfileId, supabaseForUser, textResult } from "../supabase";
import { dbError } from "@/lib/db-error";
import { planCategory, reqText, timeZone } from "@/lib/quorum/schemas";

const legacyCategories = {
  food: "dinner",
  outdoors: "hangout",
  entertainment: "hangout",
  study: "hangout",
  other: "custom",
} as const;

export default defineTool({
  name: "create_plan",
  title: "Create a plan",
  description:
    "Create a new Syncly plan in one of the signed-in member's circles and mark them as the attending host.",
  inputSchema: {
    circleId: z.string().uuid().describe("The circle the plan belongs to."),
    title: reqText(120).describe("Short plan title, e.g. 'Friday dinner'."),
    category: z
      .union([planCategory, z.enum(["food", "outdoors", "entertainment", "study", "other"])])
      .describe("Plan category. Prefer the app's categories such as dinner, movie, or hangout."),
    timeZone: timeZone.default("UTC").describe("Host's IANA timezone, e.g. America/Chicago."),
    windowStart: z
      .string()
      .datetime({ offset: true })
      .optional()
      .describe("ISO timestamp for the start of the plan window."),
    windowEnd: z
      .string()
      .datetime({ offset: true })
      .optional()
      .describe("ISO timestamp for the end of the plan window."),
    locationArea: z.string().max(200).optional().describe("Rough area, e.g. 'Frisco, TX'."),
    notes: z.string().max(2000).optional().describe("Anything the group should know."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    if (
      input.windowStart &&
      input.windowEnd &&
      Date.parse(input.windowEnd) <= Date.parse(input.windowStart)
    )
      return errorResult("The plan must end after it starts.");
    const supabase = supabaseForUser(ctx);
    const me = await myProfileId(supabase);

    const { data: plan, error } = await supabase
      .from("plans")
      .insert({
        group_id: input.circleId,
        created_by: me,
        title: input.title,
        category:
          input.category in legacyCategories
            ? legacyCategories[input.category as keyof typeof legacyCategories]
            : input.category,
        time_zone: input.timeZone,
        window_start: input.windowStart ?? null,
        window_end: input.windowEnd ?? null,
        location_area: input.locationArea ?? null,
        notes: input.notes ?? null,
        status: "collecting",
      })
      .select("id, title, status")
      .single();
    if (error) return errorResult(dbError(error, "mcp:create-plan").message);

    await supabase
      .from("plan_participants")
      .insert({ plan_id: plan.id, profile_id: me, responded: true, attending: true });

    return textResult(`Created "${plan.title}" (id: ${plan.id}). You're marked as attending.`, {
      plan,
    });
  },
});
