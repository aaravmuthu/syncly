import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  question: z.string().min(1).max(2000),
  context: z.string().max(4000).default(""),
});

export const askCoach = createServerFn({ method: "POST" })
  .inputValidator((data) => schema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) {
      return { text: "", error: "AI coach is not configured yet." };
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You are the StudyGraph coach: a precise, Socratic tutor working from a student's knowledge graph. Always reason about prerequisites first. Be concrete, use short paragraphs and worked steps, and never invent the student's data beyond the supplied context. When the student is stuck, name the likely prerequisite gap and give one concrete next action.",
          },
          {
            role: "user",
            content: data.context
              ? `Student knowledge-graph context:\n${data.context}\n\nQuestion: ${data.question}`
              : data.question,
          },
        ],
      }),
    });

    if (res.status === 429) return { text: "", error: "Rate limit reached — try again shortly." };
    if (res.status === 402)
      return { text: "", error: "AI credits exhausted. Add credits to continue." };
    if (!res.ok) {
      return { text: "", error: `Coach unavailable (${res.status}).` };
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return { text: json.choices?.[0]?.message?.content ?? "", error: null as string | null };
  });
