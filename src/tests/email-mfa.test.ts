import { describe, expect, it } from "vitest";
import { hasIndependentPrimary } from "@/lib/email-mfa-policy";
import { codeDigest } from "@/lib/email-mfa-crypto.server";

describe("email second-factor isolation", () => {
  it("requires an independent password or OAuth first factor", () => {
    for (const methods of [
      null,
      undefined,
      "password",
      [],
      ["otp"],
      [{ method: "otp" }],
      [{ method: "mfa/phone" }],
      [{}],
    ])
      expect(hasIndependentPrimary(methods)).toBe(false);
    for (const methods of [
      ["password"],
      ["oauth"],
      [{ method: "password", timestamp: 1 }],
      [{ method: "oauth" }, { method: "mfa/phone" }],
    ])
      expect(hasIndependentPrimary(methods)).toBe(true);
  });
  it("binds an emailed code to the user, session, challenge and operation", () => {
    const original = codeDigest(
      "secret-1",
      "user-1",
      "session-1",
      "challenge-1",
      "verify",
      "123456",
    );
    expect(codeDigest("secret-1", "user-1", "session-1", "challenge-1", "verify", "123456")).toBe(
      original,
    );
    for (const altered of [
      codeDigest("secret-2", "user-1", "session-1", "challenge-1", "verify", "123456"),
      codeDigest("secret-1", "user-2", "session-1", "challenge-1", "verify", "123456"),
      codeDigest("secret-1", "user-1", "session-2", "challenge-1", "verify", "123456"),
      codeDigest("secret-1", "user-1", "session-1", "challenge-2", "verify", "123456"),
      codeDigest("secret-1", "user-1", "session-1", "challenge-1", "disable", "123456"),
      codeDigest("secret-1", "user-1", "session-1", "challenge-1", "verify", "654321"),
    ])
      expect(altered).not.toBe(original);
    expect(original).not.toContain("123456");
  });
});
