import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { googleCalendarUrl, icsFile } from "@/lib/quorum/calendar";
import { applyVenueRequirements, isOpenDuring } from "@/lib/quorum/hardfilter";
import { scoreOption } from "@/lib/quorum/engine";
import type { OptionSeed } from "@/lib/quorum/types";

const option: OptionSeed = {
  key: "cafe",
  title: "Cafe",
  subtitle: "Coffee",
  category: ["dinner"],
  costMin: 5,
  costMax: 10,
  travelMinutes: 10,
  start: "18:00",
  end: "20:00",
  location: "Downtown",
  tags: [],
  dietaryFriendly: [],
  style: "casual",
  requiresDriving: false,
};

describe("venue hard filters survive storage and lock-in", () => {
  it.each(["distanceOk", "curfewOk", "hoursOk"] as const)(
    "a failing %s gate makes an otherwise compatible option infeasible",
    (gate) => {
      const scored = scoreOption(option, [{ profileId: "member", constraints: { maxSpend: 20 } }]);
      expect(scored.feasible).toBe(true);
      const checked = applyVenueRequirements(scored, {
        distanceOk: true,
        curfewOk: true,
        hoursOk: true,
        [gate]: false,
      });
      expect(checked.feasible).toBe(false);
      expect(checked.breakdown.hardFailures).toBeGreaterThan(0);
      expect(checked.breakdown.reasons).toEqual([]);
      expect(checked.breakdown.cautions.join(" ")).not.toContain("member's 10");
    },
  );
  it("never upgrades an option that already fails a private spending limit", () => {
    const scored = scoreOption(option, [{ profileId: "member", constraints: { maxSpend: 0 } }]);
    expect(
      applyVenueRequirements(scored, { distanceOk: true, curfewOk: true, hoursOk: true }).feasible,
    ).toBe(false);
  });
  it("checks the whole overnight outing instead of only its start", () => {
    expect(isOpenDuring("18:00-23:00", "22:00", "01:00", "dinner")).toBe(false);
    expect(isOpenDuring("18:00-02:00", "22:00", "01:00", "dinner")).toBe(true);
    expect(isOpenDuring("18:00-02:00", "00:30", "01:30", "dinner")).toBe(true);
  });
});

describe("calendar exports", () => {
  beforeAll(() => vi.stubEnv("TZ", "America/Chicago"));
  afterAll(() => vi.unstubAllEnvs());
  const event = {
    title: "Hangout",
    description: "Bring friends",
    location: "Cafe",
    date: "2026-10-04",
    start: "00:00",
    end: "01:00",
  };
  it("keeps date-only input on the local calendar day and preserves midnight", () => {
    const dates = new URL(googleCalendarUrl(event)).searchParams.get("dates");
    expect(dates).toBe("20261004T050000Z/20261004T060000Z");
  });
  it("keeps the supplied end time on overnight outings", () => {
    const dates = new URL(
      googleCalendarUrl({ ...event, start: "23:30", end: "01:00" }),
    ).searchParams.get("dates");
    expect(dates).toBe("20261005T043000Z/20261005T060000Z");
  });
  it("escapes every newline form instead of creating extra ICS properties", () => {
    const ics = icsFile({ ...event, title: "Cafe\r\nATTENDEE:someone\rLOCATION:elsewhere" });
    expect(ics).toContain("SUMMARY:Cafe\\nATTENDEE:someone\\nLOCATION:elsewhere");
    expect(ics).not.toContain("\r\nATTENDEE:");
  });
  it("folds long Unicode lines without splitting characters", () => {
    const title = "🎉".repeat(50);
    const ics = icsFile({ ...event, title });
    for (const line of ics.split("\r\n"))
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(ics.replace(/\r\n /g, "")).toContain(`SUMMARY:${title}`);
  });
});
