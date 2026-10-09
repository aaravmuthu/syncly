import { describe, expect, it } from "vitest";
import { localSupabaseEnv } from "../lib/supabase-dev-env";

describe("local Supabase server configuration", () => {
  it("supports projects configured only for the browser", () => {
    expect(
      localSupabaseEnv(
        {
          VITE_SUPABASE_URL: "https://test.supabase.co",
          VITE_SUPABASE_PUBLISHABLE_KEY: "public-key",
        },
        {},
      ),
    ).toEqual({ SUPABASE_URL: "https://test.supabase.co", SUPABASE_PUBLISHABLE_KEY: "public-key" });
  });
  it("keeps explicit runtime bindings ahead of local files", () => {
    const env = localSupabaseEnv(
      { VITE_SB_URL: "file-url", VITE_SB_PUBLISHABLE_KEY: "file-key" },
      { SB_URL: "runtime-url", SB_PUBLISHABLE_KEY: "runtime-key" },
    );
    expect(env).toEqual({ SUPABASE_URL: "runtime-url", SUPABASE_PUBLISHABLE_KEY: "runtime-key" });
  });
  it("never substitutes an admin secret for a missing public key", () => {
    expect(
      localSupabaseEnv(
        {
          SUPABASE_SERVICE_ROLE_KEY: "admin-secret",
          VITE_SUPABASE_SERVICE_ROLE_KEY: "unsafe-secret",
        },
        {},
      ).SUPABASE_PUBLISHABLE_KEY,
    ).toBeUndefined();
  });
});
