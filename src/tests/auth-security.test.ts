import { describe, expect, it, vi } from "vitest";
const assurance = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { mfa: { getAuthenticatorAssuranceLevel: assurance } } },
}));
import { normalizePhone, needsSecondFactor } from "@/lib/auth-security";

describe("authentication security", () => {
  it("accepts international numbers without guessing a country", () => {
    expect(normalizePhone(" +1 (415) 555-2671 ")).toBe("+14155552671");
    expect(normalizePhone("+44 7700 900123")).toBe("+447700900123");
    for (const number of ["4155552671", "+0123456789", "+123", "+1234567890123456", "+1abc5552671"])
      expect(() => normalizePhone(number)).toThrow();
  });
  it("requires a second factor for enrolled accounts at AAL1 only", async () => {
    assurance.mockResolvedValueOnce({
      data: { currentLevel: "aal1", nextLevel: "aal2" },
      error: null,
    });
    expect(await needsSecondFactor()).toBe(true);
    assurance.mockResolvedValueOnce({
      data: { currentLevel: "aal2", nextLevel: "aal2" },
      error: null,
    });
    expect(await needsSecondFactor()).toBe(false);
    assurance.mockResolvedValueOnce({
      data: { currentLevel: "aal1", nextLevel: "aal1" },
      error: null,
    });
    expect(await needsSecondFactor()).toBe(false);
  });
  it("does not bypass verification when assurance checking fails", async () => {
    assurance.mockResolvedValueOnce({ data: null, error: new Error("Unavailable") });
    await expect(needsSecondFactor()).rejects.toThrow("Unavailable");
  });
});
