import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, myProfileId, supabaseForUser, textResult } from "../supabase";

export default defineTool({
  name: "send_circle_message",
  title: "Send a circle message",
  description: "Post a message into a Syncly circle's squad chat as the signed-in member.",
  inputSchema: {
    circleId: z.string().uuid().describe("The circle to post in."),
    content: z.string().trim().describe("The message text."),
    planId: z.string().uuid().optional().describe("Attach the message to a specific plan thread."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ circleId, content, planId }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const me = await myProfileId(supabase);
    const { data, error } = await supabase
      .from("group_messages")
      .insert({ group_id: circleId, sender_id: me, content, plan_id: planId ?? null })
      .select("id, created_at")
      .single();
    if (error) return errorResult(error.message);
    return textResult("Message sent to the circle.", { message: data });
  },
});
