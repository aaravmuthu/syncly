import { afterEach, describe, expect, it, vi } from "vitest";
import { aiModel } from "@/lib/ai-gateway.server";

afterEach(() => vi.unstubAllEnvs());
describe("AI data processing gate", () => {
  it("blocks model creation even with configured keys until processing terms are approved", () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    for (const value of [undefined, "false", "TRUE", "1"]) {
      vi.stubEnv("AI_DATA_PROCESSING_APPROVED", value);
      expect(() => aiModel("magic_plan_draft")).toThrow("provider data-processing terms");
    }
  });
});
