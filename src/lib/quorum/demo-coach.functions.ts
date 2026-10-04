import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { DEMO_POOL } from "./demo-group";

const TITLES = new Set(DEMO_POOL.map((o) => o.title));
const title = z.string().refine((t) => TITLES.has(t), "Unknown option");

/**
 * One friendly sentence for the demo's what-if coach. Public on purpose (the
 * demo needs no account), so the input is closed: situation and move kind are
 * enums, amounts are bounded numbers, and titles must be real demo options.
 * Returns null whenever the AI is unavailable or limited; the client then
 * shows its own deterministic line.
 */
export const demoCoachLine = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      situation: z.enum(["stuck", "stretch", "solid"]),
      topTitle: title.nullable(),
      headcount: z.number().int().min(1).max(12),
      move: z
        .object({
          kind: z.enum(["curfew", "spend", "travel"]),
          amount: z.number().int().min(1).max(120),
          targetTitle: title,
          who: z.enum(["you", "friend", "someone"]),
        })
        .nullable(),
      you: z
        .object({
          budget: z.number().int().min(0).max(1000).nullable(),
          curfew: z
            .string()
            .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
            .nullable(),
        })
        .nullable(),
    }),
  )
  .handler(async ({ data }): Promise<{ line: string | null }> => {
    const { coachLine, visitorId } = await import("./demo-coach.server");
    return { line: await coachLine(data, await visitorId()) };
  });
