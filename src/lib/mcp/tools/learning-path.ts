import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { CONCEPT_BY_ID } from "@/lib/studygraph/curriculum";

export default defineTool({
  name: "learning_path",
  title: "Prerequisite learning path",
  description:
    "Return the ordered prerequisite chain a student must learn before a target StudyGraph concept.",
  inputSchema: {
    conceptId: z.string().describe("Target concept id, e.g. 'buffers' or 'derivatives'."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ conceptId }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const target = CONCEPT_BY_ID.get(conceptId);
    if (!target) {
      return {
        content: [{ type: "text", text: `Unknown concept "${conceptId}".` }],
        isError: true,
      };
    }
    const order: string[] = [];
    const seen = new Set<string>();
    const visit = (id: string) => {
      if (seen.has(id)) return;
      seen.add(id);
      const concept = CONCEPT_BY_ID.get(id);
      if (!concept) return;
      concept.prerequisites.forEach(visit);
      order.push(id);
    };
    visit(conceptId);
    const named = order.map((id) => CONCEPT_BY_ID.get(id)!.name);
    const minutes = order.reduce((sum, id) => sum + (CONCEPT_BY_ID.get(id)?.estMinutes ?? 0), 0);
    return {
      content: [{ type: "text", text: `${named.join(" → ")} (~${minutes} min total)` }],
      structuredContent: { conceptId, path: order, estimatedMinutes: minutes },
    };
  },
});
