import { describe, expect, it } from "vitest";
import { canViewFriendLocation, expiryFor, ghostUntilFor } from "@/lib/quorum/sharing";
import { buildTransportPlan, scoreOption } from "@/lib/quorum/engine";
import { constraintPayload } from "@/lib/quorum/schemas";
import type { OptionSeed } from "@/lib/quorum/types";

describe("location deadlines use the owner's calendar", () => {
  it("ends sharing at Central midnight even when UTC is already the next day", () => {
    const now = new Date("2026-10-13T02:00:00Z");
    expect(expiryFor("end_of_day", now, "America/Chicago")).toBe("2026-10-13T04:59:59.999Z");
    expect(ghostUntilFor("tomorrow", now, "America/Chicago")).toBe("2026-10-13T11:00:00.000Z");
  });
  it.each([
    ["2026-03-07T20:00:00Z", "2026-03-08T11:00:00.000Z"],
    ["2026-10-31T20:00:00Z", "2026-11-01T12:00:00.000Z"],
  ])("resumes at 6AM across a DST change from %s", (now, expected) => {
    expect(ghostUntilFor("tomorrow", new Date(now), "America/Chicago")).toBe(expected);
  });
  it("handles positive UTC offsets and month rollover", () => {
    const now = new Date("2026-12-31T22:00:00Z");
    expect(expiryFor("end_of_day", now, "Asia/Tokyo")).toBe("2027-01-01T14:59:59.999Z");
    expect(ghostUntilFor("tomorrow", now, "Asia/Tokyo")).toBe("2027-01-01T21:00:00.000Z");
  });
  it("keeps elapsed-hour choices independent of DST and the calendar", () => {
    const now = new Date("2026-03-08T07:30:00Z");
    expect(expiryFor("hour", now, "America/Chicago")).toBe("2026-03-08T08:30:00.000Z");
    expect(ghostUntilFor("hour", now, "America/Chicago")).toBe("2026-03-08T08:30:00.000Z");
    expect(expiryFor("indefinite", now, "America/Chicago")).toBeNull();
  });
});

describe("friend visibility", () => {
  const profile = {
    location_sharing_enabled: true,
    location_pause_indefinite: false,
    location_paused_until: null,
  };
  const now = Date.parse("2026-10-12T12:00:00Z");
  it("requires streaming consent even with an existing share and old ping", () => {
    expect(
      canViewFriendLocation(
        { ...profile, location_sharing_enabled: false },
        { expires_at: null },
        now,
      ),
    ).toBe(false);
    expect(canViewFriendLocation(profile, { expires_at: null }, now)).toBe(true);
  });
  it("honors indefinite/timed Ghost Mode, individual hiding, and share expiry", () => {
    expect(
      canViewFriendLocation(
        { ...profile, location_pause_indefinite: true },
        { expires_at: null },
        now,
      ),
    ).toBe(false);
    expect(
      canViewFriendLocation(
        { ...profile, location_paused_until: "2026-10-12T13:00:00Z" },
        { expires_at: null },
        now,
      ),
    ).toBe(false);
    expect(canViewFriendLocation(profile, { expires_at: null, hidden: true }, now)).toBe(false);
    expect(canViewFriendLocation(profile, { expires_at: "2026-10-12T12:00:00Z" }, now)).toBe(false);
    expect(canViewFriendLocation(profile, { expires_at: "invalid" }, now)).toBe(false);
  });
});

describe("seat capacity matches physical ride assignments", () => {
  const option: OptionSeed = {
    key: "outing",
    title: "Outing",
    subtitle: "",
    category: ["hangout"],
    costMin: 0,
    costMax: 0,
    travelMinutes: 10,
    start: "18:00",
    end: "19:00",
    location: "Cafe",
    tags: [],
    dietaryFriendly: [],
    style: "casual",
    requiresDriving: true,
  };
  const members = [
    { profileId: "driver1", name: "driver1", constraints: { canDrive: true, seats: 1.5 } },
    { profileId: "driver2", name: "driver2", constraints: { canDrive: true, seats: 0.5 } },
    { profileId: "rider1", name: "rider1", constraints: { needsRide: true } },
    { profileId: "rider2", name: "rider2", constraints: { needsRide: true } },
  ];
  it("rejects fractional input and treats legacy fractions conservatively", () => {
    expect(constraintPayload.safeParse({ seats: 1.5 }).success).toBe(false);
    expect(scoreOption(option, members).feasible).toBe(false);
    expect(buildTransportPlan(option, members).unseated).toEqual(["rider2"]);
  });
  it("still seats everyone when real capacity is sufficient", () => {
    const enough = members.map((m) =>
      m.profileId === "driver1" ? { ...m, constraints: { canDrive: true, seats: 2 } } : m,
    );
    expect(scoreOption(option, enough).feasible).toBe(true);
    expect(buildTransportPlan(option, enough).unseated).toEqual([]);
    expect(constraintPayload.parse({ seats: "" }).seats).toBeNull();
  });
});
