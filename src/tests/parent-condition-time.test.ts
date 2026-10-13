import { describe, expect, it } from "vitest";
import { parseHomeBy, scoreOption } from "@/lib/quorum/engine";
import type { OptionSeed } from "@/lib/quorum/types";
describe("only recognizable curfews become home-by deadlines", () => {
  it.each([
    "Must be with 2 adults",
    "Spend no more than $20",
    "Call me every 30 minutes",
    "Stay with 3 friends",
  ])("does not invent a curfew from %s", (condition) => {
    expect(parseHomeBy(condition)).toBeNull();
  });
  it.each([
    ["Must be home by 10:00 PM", 1320],
    ["Return before 22:30", 1350],
    ["Curfew: 9 pm", 1260],
    ["10pm curfew", 1320],
    ["10pm", 1320],
    ["Home by 00:30", 30],
    ["With 2 adults; be home by 9:30 pm", 1290],
  ])("reads %s as %i minutes", (condition, minutes) =>
    expect(parseHomeBy(condition)).toBe(minutes),
  );
  it.each([
    "Home by 25:00",
    "Curfew: 10:99 pm",
    "Home by 19:00 am",
    "Home by 10:9",
    "Home by 10:999",
    "10:9pm curfew",
  ])("does not normalize invalid time %s", (condition) =>
    expect(parseHomeBy(condition)).toBeNull(),
  );
  it("keeps unrelated rules from inventing schedule failures while honoring real curfews", () => {
    const option: OptionSeed = {
      key: "dinner",
      title: "Dinner",
      subtitle: "",
      category: ["dinner"],
      costMin: 10,
      costMax: 15,
      travelMinutes: 10,
      start: "18:00",
      end: "20:00",
      location: "Cafe",
      tags: [],
      dietaryFriendly: [],
      style: "casual",
      requiresDriving: false,
    };
    expect(
      scoreOption(option, [
        { profileId: "member", constraints: { parentConditions: ["Must be with 2 adults"] } },
      ]).feasible,
    ).toBe(true);
    expect(
      scoreOption(option, [
        { profileId: "member", constraints: { parentConditions: ["Must be home by 8pm"] } },
      ]).feasible,
    ).toBe(false);
  });
});
