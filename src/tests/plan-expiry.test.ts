import { describe, expect, it } from "vitest";
import {
  PLAN_END_GRACE_MS,
  isPlanOver,
  planOverCutoff,
  zonedToInstant,
} from "@/lib/quorum/plan-time";

const CHICAGO = "America/Chicago";
const at = (iso: string) => new Date(iso).getTime();

describe("plan time as an instant", () => {
  it("stores 6:30pm Chicago (CDT) as 23:30Z, not 18:30Z", () => {
    expect(zonedToInstant("2026-09-28", "18:30", CHICAGO)).toBe("2026-09-28T23:30:00.000Z");
  });

  it("honours standard time (CST, UTC-6) too", () => {
    expect(zonedToInstant("2026-12-05", "18:30", CHICAGO)).toBe("2026-12-06T00:30:00.000Z");
  });

  it("handles the day DST starts", () => {
    expect(zonedToInstant("2026-03-08", "18:30", CHICAGO)).toBe("2026-03-08T23:30:00.000Z");
  });
});

describe("isPlanOver for a 6:30pm-9pm Chicago plan", () => {
  const plan = {
    windowStart: zonedToInstant("2026-09-28", "18:30", CHICAGO),
    windowEnd: zonedToInstant("2026-09-28", "21:00", CHICAGO),
  };

  it("is not over at 3pm local, before it starts", () => {
    expect(isPlanOver(plan, at("2026-09-28T20:00:00Z"))).toBe(false); // 3:00pm CDT
  });

  it("is not over mid-hangout or just after it ends", () => {
    expect(isPlanOver(plan, at("2026-09-29T00:00:00Z"))).toBe(false); // 7:00pm CDT
    expect(isPlanOver(plan, at("2026-09-29T03:00:00Z"))).toBe(false); // 10:00pm CDT
  });

  it("is over only after the grace window past the end", () => {
    const end = at("2026-09-29T02:00:00Z"); // 9:00pm CDT
    expect(isPlanOver(plan, end + PLAN_END_GRACE_MS - 1)).toBe(false);
    expect(isPlanOver(plan, end + PLAN_END_GRACE_MS + 1)).toBe(true);
  });

  it("falls back to the start when no end was set", () => {
    const noEnd = { windowStart: plan.windowStart, windowEnd: null };
    const start = at(plan.windowStart);
    expect(isPlanOver(noEnd, start + PLAN_END_GRACE_MS - 1)).toBe(false);
    expect(isPlanOver(noEnd, start + PLAN_END_GRACE_MS + 1)).toBe(true);
  });

  it("never ends a plan with no times", () => {
    expect(isPlanOver({ windowStart: null, windowEnd: null }, Date.now())).toBe(false);
  });

  it("uses the same cutoff for the sweep query", () => {
    const now = at("2026-09-29T06:00:01Z");
    expect(planOverCutoff(now)).toBe("2026-09-29T02:00:01.000Z");
  });
});
