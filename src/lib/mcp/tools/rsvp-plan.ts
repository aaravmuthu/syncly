import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, myProfileId, supabaseForUser, textResult } from "../supabase";

export default defineTool({
  name: "rsvp_plan",
  title: "RSVP to a plan",
  description: "Set whether the signed-in member is attending a Syncly plan.",
  inputSchema: {
    planId: z.string().uuid().describe("The plan to respond to."),
    attending: z.boolean().describe("True if going, false if not."),
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  handler: async ({ planId, attending }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const me = await myProfileId(supabase);

    const { data: existing } = await supabase
      .from("plan_participants")
      .select("id")
      .eq("plan_id", planId)
      .eq("profile_id", me)
      .maybeSingle();

    const { error } = existing
      ? await supabase
          .from("plan_participants")
          .update({ attending, responded: true })
          .eq("id", existing.id)
      : await supabase
          .from("plan_participants")
          .insert({ plan_id: planId, profile_id: me, attending, responded: true });
    if (error) return errorResult(error.message);

    return textResult(attending ? "Marked you as going." : "Marked you as not going.", {
      planId,
      attending,
    });
  },
});
