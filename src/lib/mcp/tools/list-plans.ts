import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, myProfileId, supabaseForUser, textResult } from "../supabase";

export default defineTool({
  name: "list_plans",
  title: "List my plans",
  description:
    "List Quorum plans visible to the signed-in member, newest first. Optionally filter by circle id or plan status.",
  inputSchema: {
    circleId: z.string().uuid().optional().describe("Only return plans in this circle."),
    status: z
      .enum(["draft", "collecting", "recommending", "voting", "finalized", "cancelled", "completed"])
      .optional()
      .describe("Only return plans with this status."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ circleId, status }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const supabase = supabaseForUser(ctx);
    await myProfileId(supabase);
    let query = supabase
      .from("plans")
      .select("id, title, category, status, window_start, window_end, location_area, group_id, groups(name, emoji)")
      .order("created_at", { ascending: false })
      .limit(25);
    if (circleId) query = query.eq("group_id", circleId);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) return errorResult(error.message);
    const plans = (data ?? []).map((p) => {
      const g = p.groups as unknown as { name: string; emoji: string } | null;
      return {
        id: p.id,
        title: p.title,
        category: p.category,
        status: p.status,
        circle: g?.name ?? null,
        windowStart: p.window_start,
        windowEnd: p.window_end,
        locationArea: p.location_area,
      };
    });
    if (!plans.length) return textResult("No plans match that filter.", { plans });
    return textResult(
      plans
        .map(
          (p) =>
            `${p.title} — ${p.status}${p.circle ? ` in ${p.circle}` : ""}${p.windowStart ? ` · ${p.windowStart}` : ""} (id: ${p.id})`,
        )
        .join("\n"),
      { plans },
    );
  },
});
