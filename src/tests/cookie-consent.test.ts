import { describe, expect, it } from "vitest";
import { parseConsent } from "@/lib/cookie-consent";

const now = Date.UTC(2026, 9, 9);
const saved = { version: 1, necessary: true, analytics: false, marketing: false, savedAt: now };
describe("cookie consent privacy defaults", () => {
  it("does not grant consent for missing, malformed or partially saved preferences", () => {
    for (const value of [
      null,
      "",
      "{",
      "{}",
      JSON.stringify({ ...saved, analytics: "true" }),
      JSON.stringify({ ...saved, marketing: undefined }),
      JSON.stringify({ ...saved, necessary: false }),
    ]) {
      expect(parseConsent(value, now)).toBeNull();
    }
  });
  it("keeps rejection distinct from acceptance and preserves independent choices", () => {
    expect(parseConsent(JSON.stringify(saved), now)).toEqual(saved);
    expect(parseConsent(JSON.stringify({ ...saved, analytics: true }), now)?.marketing).toBe(false);
    expect(parseConsent(JSON.stringify({ ...saved, marketing: true }), now)?.analytics).toBe(false);
  });
  it("requires renewed consent after expiry, version changes and invalid timestamps", () => {
    for (const patch of [
      { savedAt: now - 180 * 86400000 },
      { savedAt: now + 1 },
      { version: 2 },
      { savedAt: null },
    ]) {
      expect(parseConsent(JSON.stringify({ ...saved, ...patch }), now)).toBeNull();
    }
  });
});
