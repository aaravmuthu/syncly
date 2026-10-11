import { describe, expect, it } from "vitest";
import {
  applyPlanningWindow,
  itineraryCandidates,
  itineraryHoursFit,
  scoreWholeItinerary,
} from "@/lib/quorum/planning-candidates";
import { buildTransportPlan, scoreOption } from "@/lib/quorum/engine";
import { isOpenDuring } from "@/lib/quorum/hardfilter";
import { itinerarySchema, type Itinerary, type ItineraryVenue } from "@/lib/quorum/itinerary";
import type { MemberBase } from "@/lib/quorum/fairpoint.server";
import { curfewWarnings } from "@/lib/quorum/fairpoint.server";
import { recentAiHistory } from "@/lib/quorum/ai-chat";
import { verifyItineraryVenues } from "@/lib/quorum/itinerary-verification.server";

const venue: ItineraryVenue = {
  key: "dinner",
  title: "Dinner",
  address: null,
  lat: 33,
  lon: -96,
  costMin: 12,
  costMax: 15,
  rating: null,
  openHours: "24/7",
  dietaryFriendly: ["vegetarian"],
};
const outing: Itinerary = {
  version: 1,
  title: "Friday",
  vibe: "",
  date: "2026-10-16",
  start: "18:00",
  budgetPerPerson: 30,
  areaLabel: null,
  zip: "75034",
  anchor: 1,
  invite: "",
  weather: null,
  stops: [
    {
      id: "food",
      kind: "restaurant",
      label: "Dinner",
      why: "",
      minutes: 60,
      options: [venue],
      pick: 0,
    },
    {
      id: "game",
      kind: "bowling",
      label: "Bowling",
      why: "",
      minutes: 90,
      options: [
        { ...venue, key: "bowling", title: "Bowling", costMin: 14, costMax: 18 },
        { ...venue, key: "arcade", title: "Another bowling venue", costMin: 8, costMax: 10 },
      ],
      pick: 0,
    },
  ],
};
const base: MemberBase = {
  profileId: "member",
  name: "Member",
  emoji: null,
  avatarUrl: null,
  zip: "75034",
  lat: 33,
  lon: -96,
  curfew: null,
  budgetPreference: null,
};
const candidates = () => itineraryCandidates(outing, { window_start: null, window_end: null });

describe("complete outing feasibility", () => {
  it("replaces browser-supplied prices and dietary claims with provider facts", async () => {
    const altered = { ...outing, stops: [outing.stops[0]], anchor: 0 };
    altered.stops = altered.stops.map((stop) => ({
      ...stop,
      options: stop.options.map((v) => ({
        ...v,
        costMin: 0,
        costMax: 0,
        dietaryFriendly: ["nut-free"],
      })),
    }));
    const source = {
      ...candidates()[0].option,
      key: venue.key,
      title: venue.title,
      costMin: 12,
      costMax: 15,
      lat: venue.lat,
      lon: venue.lon,
      dietaryFriendly: ["vegetarian"],
      openHours: "10:00-22:00",
    };
    const verified = await verifyItineraryVenues(altered, async () => [source]);
    expect(verified.stops[0].options[0].costMax).toBe(15);
    expect(verified.stops[0].options[0].dietaryFriendly).toEqual(["vegetarian"]);
  });
  it("refuses to launch an unknown venue rather than trusting its browser metadata", async () => {
    await expect(verifyItineraryVenues(outing, async () => [])).rejects.toThrow(
      "could not be verified",
    );
  });
  it("uses each driver's own route when assigning seats", () => {
    const c = candidates()[0];
    const rides = buildTransportPlan({ ...c.option, travelMinutes: 100 }, [
      {
        profileId: "driver",
        name: "Driver",
        travelMinutes: 10,
        constraints: { canDrive: true, seats: 1, maxTravelMinutes: 15 },
      },
      { profileId: "rider", name: "Rider", constraints: { needsRide: true } },
    ]);
    expect(rides.unseated).toEqual([]);
    expect(rides.cars[0].passengers).toEqual(["Rider"]);
  });
  it("rejects two individually affordable stops whose combined cost exceeds the cap", () => {
    const c = candidates()[0];
    expect(c.option.costMin).toBe(26);
    expect(c.option.costMax).toBe(33);
    expect(
      scoreWholeItinerary(
        c.option,
        c.itinerary,
        [{ profileId: "member", constraints: { maxSpend: 25 } }],
        [base],
        12,
      ).feasible,
    ).toBe(false);
    const cheaper = candidates()[1];
    expect(
      scoreWholeItinerary(
        cheaper.option,
        cheaper.itinerary,
        [{ profileId: "member", constraints: { maxSpend: 25 } }],
        [base],
        12,
      ).feasible,
    ).toBe(true);
  });
  it("rejects a late second stop even when dinner alone fits", () => {
    const c = candidates()[0];
    expect(
      scoreWholeItinerary(
        c.option,
        c.itinerary,
        [{ profileId: "member", constraints: { latestEnd: "19:30" } }],
        [base],
        12,
      ).feasible,
    ).toBe(false);
  });
  it("requires every food stop to meet dietary needs", () => {
    const it = {
      ...outing,
      stops: [
        ...outing.stops,
        {
          ...outing.stops[0],
          id: "dessert",
          kind: "dessert" as const,
          options: [{ ...venue, dietaryFriendly: [] }],
        },
      ],
    };
    const c = itineraryCandidates(it, { window_start: null, window_end: null })[0];
    expect(
      scoreWholeItinerary(
        c.option,
        c.itinerary,
        [{ profileId: "member", constraints: { dietary: ["vegetarian"] } }],
        [base],
        12,
      ).feasible,
    ).toBe(false);
  });
  it("checks seats for the whole route", () => {
    const c = candidates()[0];
    expect(
      scoreWholeItinerary(
        c.option,
        c.itinerary,
        [{ profileId: "member", constraints: { needsRide: true } }],
        [base],
        12,
      ).feasible,
    ).toBe(false);
  });
  it("checks the trip home from the last stop", () => {
    const far = {
      ...outing,
      stops: outing.stops.map((s, i) =>
        i === 1 ? { ...s, options: s.options.map((v) => ({ ...v, lon: -96.25 })) } : s,
      ),
    };
    const c = itineraryCandidates(far, { window_start: null, window_end: null })[0];
    expect(
      scoreWholeItinerary(
        c.option,
        c.itinerary,
        [{ profileId: "member", constraints: { requiredReturnTime: "20:40" } }],
        [base],
        100,
      ).feasible,
    ).toBe(false);
  });
  it("keeps the unvoted stop and stores the selected anchor", () => {
    const c = candidates()[1];
    expect(c.itinerary.stops[0].options[0].key).toBe("dinner");
    expect(c.itinerary.stops[1].pick).toBe(1);
    expect(c.option.title).toBe("Another bowling venue");
  });
  it("does not validate a closing-hours failure in the later stop", () => {
    const c = candidates()[0];
    c.itinerary = {
      ...c.itinerary,
      stops: c.itinerary.stops.map((s, i) =>
        i === 1 ? { ...s, options: s.options.map((v) => ({ ...v, openHours: "10:00-19:00" })) } : s,
      ),
    };
    expect(itineraryHoursFit(c.itinerary)).toBe(false);
  });
  it("rejects impossible clocks in persisted itineraries", () => {
    expect(itinerarySchema.safeParse({ ...outing, start: "29:99" }).success).toBe(false);
  });
});
describe("scheduled windows", () => {
  it("checks saved profile curfews across midnight", () => {
    expect(curfewWarnings([{ ...base, curfew: "23:00" }], "01:00", [], "23:00", 120)).toHaveLength(
      1,
    );
    expect(curfewWarnings([{ ...base, curfew: "02:00" }], "01:00", [], "23:00", 120)).toHaveLength(
      0,
    );
  });
  it("uses the plan wall clock instead of venue default times", () => {
    const c = candidates()[0];
    const o = applyPlanningWindow(c.option, {
      window_start: "2026-10-16T17:00:00Z",
      window_end: "2026-10-16T19:00:00Z",
      time_zone: "America/Chicago",
    });
    expect(o.start).toBe("12:00");
    expect(o.end).toBe("14:00");
    expect(o.durationMinutes).toBe(120);
  });
  it("rejects an outing that ends after midnight against an evening curfew", () => {
    const c = candidates()[0];
    expect(
      scoreOption({ ...c.option, start: "23:00", end: "01:00", durationMinutes: 120 }, [
        { profileId: "member", constraints: { requiredReturnTime: "23:30" } },
      ]).feasible,
    ).toBe(false);
  });
  it("accepts an explicit early-morning return deadline for an overnight outing", () => {
    const c = candidates()[0];
    expect(
      scoreOption({ ...c.option, start: "23:00", end: "01:00", durationMinutes: 120 }, [
        { profileId: "member", constraints: { requiredReturnTime: "02:00" } },
      ]).feasible,
    ).toBe(true);
  });
  it("does not borrow Monday opening hours for a Sunday outing", () => {
    expect(
      isOpenDuring(
        "Mo-Fr 10:00-22:00; Sa 12:00-20:00; Su off",
        "18:00",
        "19:00",
        "dinner",
        "2026-10-11",
      ),
    ).toBe(false);
    expect(
      isOpenDuring("Mo-Fr 10:00-22:00; Su off", "18:00", "19:00", "dinner", "2026-10-12"),
    ).toBe(true);
  });
});
it("keeps long AI conversations within server validation limits and strips action data", () => {
  const turns = Array.from({ length: 60 }, (_, i) => ({
    role: i % 2 ? ("assistant" as const) : ("user" as const),
    content: `message ${i}`,
    action: { type: "cast_vote" },
  }));
  expect(recentAiHistory(turns)).toHaveLength(8);
  expect(recentAiHistory(turns)[0]).toEqual({ role: "user", content: "message 52" });
});
