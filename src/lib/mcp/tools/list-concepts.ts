import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { CONCEPTS, COURSES } from "@/lib/studygraph/curriculum";

export default defineTool({
  name: "list_concepts",
  title: "List knowledge-graph concepts",
  description:
    "List StudyGraph concepts for a course, including prerequisites, difficulty and exam importance.",
  inputSchema: {
    courseId: z
      .string()
      .describe(`Course id. One of: ${COURSES.map((c) => c.id).join(", ")}`),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ courseId }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const concepts = CONCEPTS.filter((c) => c.courseId === courseId).map((c) => ({
      id: c.id,
      name: c.name,
      unitId: c.unitId,
      difficulty: c.difficulty,
      importance: c.importance,
      estMinutes: c.estMinutes,
      prerequisites: c.prerequisites,
    }));
    if (!concepts.length) {
      return {
        content: [{ type: "text", text: `No concepts found for course "${courseId}".` }],
        isError: true,
      };
    }
    return {
      content: [
        {
          type: "text",
          text: concepts
            .map((c) => `${c.name} (${c.id}) — prereqs: ${c.prerequisites.join(", ") || "none"}`)
            .join("\n"),
        },
      ],
      structuredContent: { courseId, concepts },
    };
  },
});
