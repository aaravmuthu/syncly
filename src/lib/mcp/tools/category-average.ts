import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "category_average",
  title: "Weighted category average",
  description:
    "Compute a course average from weighted assignment categories (e.g. Summative 60%, Formative 40%).",
  inputSchema: {
    categories: z
      .array(
        z.object({
          name: z.string().describe("Category name."),
          average: z.number().describe("Category average, 0-100."),
          weightPercent: z.number().describe("Category weight in percent."),
        }),
      )
      .describe("The weighted grading categories for one course."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ categories }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const totalWeight = categories.reduce((s, c) => s + c.weightPercent, 0);
    if (totalWeight <= 0) {
      return {
        content: [{ type: "text", text: "Total category weight must be greater than 0." }],
        isError: true,
      };
    }
    const avg =
      categories.reduce((s, c) => s + c.average * c.weightPercent, 0) / totalWeight;
    const rounded = Math.round(avg * 100) / 100;
    return {
      content: [{ type: "text", text: `Weighted course average: ${rounded}` }],
      structuredContent: { average: rounded, totalWeight },
    };
  },
});
