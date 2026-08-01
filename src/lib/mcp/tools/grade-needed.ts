import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "grade_needed",
  title: "Grade needed on remaining work",
  description:
    "Given a current average, a target average, and how much of the grade the remaining work is worth, compute the score needed on that remaining work.",
  inputSchema: {
    currentAverage: z.number().describe("Current course average, 0-100."),
    targetAverage: z.number().describe("Desired final average, 0-100."),
    remainingWeightPercent: z
      .number()
      .describe("Percent of the final grade the remaining work is worth, 0-100."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ currentAverage, targetAverage, remainingWeightPercent }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const w = remainingWeightPercent / 100;
    if (w <= 0 || w > 1) {
      return {
        content: [{ type: "text", text: "remainingWeightPercent must be between 0 and 100." }],
        isError: true,
      };
    }
    const needed = (targetAverage - currentAverage * (1 - w)) / w;
    const rounded = Math.round(needed * 100) / 100;
    const feasible = rounded <= 100;
    return {
      content: [
        {
          type: "text",
          text: feasible
            ? `You need ${rounded}% on the remaining ${remainingWeightPercent}% to finish at ${targetAverage}%.`
            : `Not reachable: that would require ${rounded}% on the remaining work.`,
        },
      ],
      structuredContent: { needed: rounded, feasible },
    };
  },
});
