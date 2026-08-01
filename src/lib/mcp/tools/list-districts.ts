import { defineTool } from "@lovable.dev/mcp-js";
import { DISTRICTS } from "@/lib/hac/types";

export default defineTool({
  name: "list_districts",
  title: "List supported districts",
  description:
    "List the school districts AuraHAC can sync Home Access Center data from, with their portal URLs.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(DISTRICTS, null, 2) }],
      structuredContent: { districts: DISTRICTS },
    };
  },
});
