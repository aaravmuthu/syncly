import { afterEach, describe, expect, it, vi } from "vitest";
const generate = vi.hoisted(() => vi.fn());
vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("ai")>()),
  generateText: generate,
}));
vi.mock("@/lib/ai-gateway.server", () => ({
  aiModel: () => ({}),
  aiGenerationOptions: () => ({ maxOutputTokens: 2500 }),
  recordAiFailure: vi.fn(),
}));
import {
  draftItinerary,
  summarizeCompromises,
  heuristicCompromise,
  writeCompromise,
  type CompromiseFacts,
  type ConflictFacts,
} from "@/lib/quorum/ai.server";
import { generateVenueInsight } from "@/lib/quorum/reviews.server";
import type { Itinerary } from "@/lib/quorum/itinerary";
afterEach(() => generate.mockReset());
const currentItinerary: Itinerary = {
  version: 1,
  title: "Already cheaper",
  vibe: "Quiet",
  date: "2026-10-16",
  start: "18:00",
  budgetPerPerson: 20,
  areaLabel: "Frisco",
  zip: "75034",
  anchor: 0,
  weather: null,
  invite: "Join us",
  stops: [
    {
      id: "original",
      kind: "bowling",
      label: "Bowling",
      why: "",
      minutes: 60,
      pick: 0,
      options: [
        {
          key: "real",
          title: "Real place",
          lat: 33,
          lon: -96,
          address: null,
          costMin: 10,
          costMax: 15,
          rating: null,
        },
      ],
    },
  ],
};
const facts: ConflictFacts = {
  planTitle: "Test",
  category: "dinner",
  memberCount: 2,
  startTime: "18:00",
  endTime: "20:00",
  earliestCurfew: "20:17",
  curfewBreachCount: 0,
  tightestBudget: 17,
  topCostMin: 20,
  topCostMax: 30,
  voteSplit: [
    {
      id: "unsafe",
      title: "Popular but blocked",
      votes: 5,
      costMin: 20,
      costMax: 30,
      feasible: false,
    },
  ],
  weather: null,
  dietaryNeeds: ["unique-private-diet"],
  longestDriveMinutes: 20,
  travelLimitMinutes: 13,
};
describe("AI planning grounding", () => {
  it("passes the current accepted draft into every follow-up and preserves stable stop identities", async () => {
    generate.mockResolvedValue({
      output: {
        title: currentItinerary.title,
        vibe: currentItinerary.vibe,
        date: currentItinerary.date,
        start_time: "19:00",
        budget_per_person: 20,
        area: currentItinerary.zip,
        search_radius_miles: null,
        stops: [{ kind: "bowling", label: "Bowling", minutes: 60, why: "" }],
        anchor_index: 0,
        invite_message: currentItinerary.invite,
        rescout_stop_ids: [],
      },
    });
    const draft = await draftItinerary("Start an hour later", "2026-10-10", currentItinerary);
    const prompt = JSON.parse(generate.mock.calls[0][0].prompt);
    expect(prompt.current_itinerary).toEqual(currentItinerary);
    expect(draft.stops[0].id).toBe("original");
    expect(draft.budgetPerPerson).toBe(20);
    expect(draft.start).toBe("19:00");
  });
  it("keeps an accepted draft intact when an AI revision fails", async () => {
    generate.mockRejectedValue(new Error("offline"));
    const draft = await draftItinerary("Make it later", "2026-10-10", currentItinerary);
    expect(draft.start).toBe("18:00");
    expect(draft.date).toBe(currentItinerary.date);
    expect(draft.budgetPerPerson).toBe(20);
    expect(draft.aiGenerated).toBe(false);
  });
  it("does not expose exact private limits in explanation prompts or fallback text", async () => {
    generate.mockRejectedValue(new Error("offline"));
    const f = {
      id: "rec",
      title: "Dinner",
      score: 80,
      feasible: false,
      costMin: 20,
      costMax: 30,
      travelMinutes: 10,
      distanceMiles: 2,
      breakdown: { cautions: [] },
      tightestBudget: 17,
      tightestTravelMinutes: 13,
      blockedCount: 1,
      memberCount: 2,
      dietaryNeeds: ["unique-private-diet"],
    } as unknown as CompromiseFacts;
    const summaries = await summarizeCompromises([f]);
    const prompt = generate.mock.calls[0][0].prompt;
    expect(prompt).not.toContain("unique-private-diet");
    expect(prompt).not.toContain("tightest_budget_cap");
    expect(prompt).not.toContain("tightest_travel");
    expect(summaries.rec).not.toContain("$17");
  });
  it("never recommends the vote leader when no option is feasible", () => {
    expect(heuristicCompromise(facts).suggestedRecommendationId).toBeNull();
    expect(heuristicCompromise(facts).detail).not.toContain("$17");
  });
  it("ignores model attempts to change the already checked remedy", async () => {
    generate.mockResolvedValue({
      output: { headline: "Try earlier", detail: "Review your options", suggested_start: "29:99" },
    });
    expect((await writeCompromise(facts)).suggestedStart).toBeNull();
    expect(generate.mock.calls[0][0].prompt).not.toContain("20:17");
    expect(generate.mock.calls[0][0].prompt).not.toContain("unique-private-diet");
  });
  it("supplies checks to verify rather than fabricated venue evidence", async () => {
    const insight = await generateVenueInsight({ name: "Unknown restaurant", kind: "food" });
    expect(insight.checks.join(" ")).toContain("Confirm");
    expect(insight).not.toHaveProperty("reviews");
    expect(generate).not.toHaveBeenCalled();
  });
});
