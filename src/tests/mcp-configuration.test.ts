import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolContext } from "@lovable.dev/mcp-js";
const mocks = vi.hoisted(() => ({ createClient: vi.fn(() => ({})) }));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));
import { supabaseForUser } from "@/lib/mcp/supabase";
const context = { getToken: () => "verified-user-token" } as ToolContext;
beforeEach(() => {
  mocks.createClient.mockClear();
  for (const name of [
    "SB_URL",
    "SUPABASE_URL",
    "VITE_SB_URL",
    "VITE_SUPABASE_URL",
    "SB_PUBLISHABLE_KEY",
    "SUPABASE_PUBLISHABLE_KEY",
    "VITE_SB_PUBLISHABLE_KEY",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_PUBLISHABLE_KEYS",
    "SUPABASE_ANON_KEY",
    "VITE_SUPABASE_ANON_KEY",
  ])
    vi.stubEnv(name, "");
});
afterEach(() => vi.unstubAllEnvs());
describe("MCP uses the same project bindings as the app", () => {
  it.each(["SB", "SUPABASE", "VITE_SB", "VITE_SUPABASE"])(
    "supports %s URL/key names and forwards the user token",
    (prefix) => {
      vi.stubEnv(`${prefix}_URL`, "https://fixture.supabase.co");
      vi.stubEnv(`${prefix}_PUBLISHABLE_KEY`, "sb_publishable_fixture");
      supabaseForUser(context);
      expect(mocks.createClient).toHaveBeenCalledWith(
        "https://fixture.supabase.co",
        "sb_publishable_fixture",
        {
          global: { headers: { Authorization: "Bearer verified-user-token" } },
          auth: { persistSession: false, autoRefreshToken: false },
        },
      );
    },
  );
  it("prefers deployed server bindings to build-time browser bindings", () => {
    vi.stubEnv("SB_URL", "https://server.supabase.co");
    vi.stubEnv("SB_PUBLISHABLE_KEY", "server-publishable");
    vi.stubEnv("VITE_SUPABASE_URL", "https://browser.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "browser-publishable");
    supabaseForUser(context);
    expect(mocks.createClient.mock.calls[0].slice(0, 2)).toEqual([
      "https://server.supabase.co",
      "server-publishable",
    ]);
  });
  it("does not construct a client without a verified token", () => {
    expect(() => supabaseForUser({ getToken: () => null } as unknown as ToolContext)).toThrow(
      "verified OAuth token",
    );
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});
