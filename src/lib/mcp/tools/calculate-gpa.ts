import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { numericToPoints } from "@/lib/hac/gpa";

export default defineTool({
  name: "calculate_gpa",
  title: "Calculate GPA",
  description:
    "Calculate a GPA from a list of course averages using the AuraHAC scale. Set weighted to true for the weighted (5.0-style) scale.",
  inputSchema: {
    averages: z
      .array(z.number())
      .describe("Numeric course averages on a 0-100 scale, one per course."),
    weighted: z.boolean().describe("Use the weighted scale instead of the 4.0 scale."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ averages, weighted }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    if (averages.length === 0) {
      return { content: [{ type: "text", text: "Provide at least one average." }], isError: true };
    }
    const points = averages.map((a) => numericToPoints(a, weighted));
    const gpa = points.reduce((a, b) => a + b, 0) / points.length;
    const rounded = Math.round(gpa * 10000) / 10000;
    return {
      content: [
        {
          type: "text",
          text: `${weighted ? "Weighted" : "4.0"} GPA across ${averages.length} course(s): ${rounded}`,
        },
      ],
      structuredContent: { gpa: rounded, weighted, perCoursePoints: points },
    };
  },
});
