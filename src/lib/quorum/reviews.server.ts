// Server-only. AI-generated dish highlights + community-style review snippets
// for a venue. Degrades to a deterministic fallback when AI is unavailable.
import { generateText, Output } from "ai";
import { z } from "zod";
import { aiModel } from "@/lib/ai-gateway.server";

export type VenueReview = { author: string; rating: number; text: string };
export type VenueInsight = {
  popularDishes: string[];
  vibes: string[];
  reviews: VenueReview[];
  aiGenerated: boolean;
};

const Schema = z.object({
  popular_dishes: z.array(z.string()),
  vibes: z.array(z.string()),
  reviews: z.array(z.object({ author: z.string(), rating: z.number(), text: z.string() })),
});

function fallback(input: { name: string; kind: string }): VenueInsight {
  const food = input.kind !== "activity";
  return {
    popularDishes: food
      ? ["House specialty plate", "Shareable appetizer", "Signature drink"]
      : ["Group session", "Weekend special", "Snack bar combo"],
    vibes: ["Casual", "Great for groups", "Easy parking"],
    reviews: [
      {
        author: "Alex M.",
        rating: 5,
        text: `Solid go-to spot — friendly staff and plenty of room for a group at ${input.name}.`,
      },
      {
        author: "Jordan T.",
        rating: 4.5,
        text: "Fast seating even on a weekend night, and prices are reasonable.",
      },
      {
        author: "Sam R.",
        rating: 4,
        text: "Gets busy at peak hours, but worth the short wait.",
      },
    ],
    aiGenerated: false,
  };
}

export async function generateVenueInsight(input: {
  name: string;
  address?: string | null;
  cuisine?: string | null;
  kind: string;
  priceLevel?: string | null;
}): Promise<VenueInsight> {
  try {
    const { output } = await generateText({
      model: aiModel("venue_insight"),
      output: Output.object({ schema: Schema }),
      prompt: [
        "You write short, realistic community-style highlights for a local venue in a group planning app.",
        "Give 2-4 popular menu items (or popular activities if it is not a restaurant), 3 short vibe tags,",
        "and exactly 3 reviews from different first-name + last-initial authors, ratings between 3.5 and 5.",
        "Each review is one or two sentences, casual and specific, under 160 characters.",
        "Never invent phone numbers, prices in dollars, or claims about awards.",
        'Reply with ONLY JSON: {"popular_dishes":[string],"vibes":[string],"reviews":[{"author":string,"rating":number,"text":string}]}',
        "",
        JSON.stringify({
          name: input.name,
          address: input.address ?? null,
          cuisine: input.cuisine ?? null,
          type: input.kind,
          price_level: input.priceLevel ?? null,
        }),
      ].join("\n"),
    });

    const parsed = output;
    if (!parsed?.reviews?.length) return fallback(input);
    return {
      popularDishes: parsed.popular_dishes.slice(0, 4),
      vibes: parsed.vibes.slice(0, 4),
      reviews: parsed.reviews.slice(0, 3).map((r) => ({
        author: r.author,
        rating: Math.min(5, Math.max(1, Math.round(r.rating * 2) / 2)),
        text: r.text,
      })),
      aiGenerated: true,
    };
  } catch {
    return fallback(input);
  }
}
