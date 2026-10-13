import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rows: {} as Record<string, unknown>, from: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      mocks.from(table);
      const query = {
        select: () => query,
        or: () => query,
        eq: () => query,
        in: () => query,
        order: () => query,
        limit: () => query,
        maybeSingle: async () => ({ data: mocks.rows[table] ?? null, error: null }),
        then: (resolve: (result: unknown) => unknown) =>
          Promise.resolve({ data: mocks.rows[table] ?? [], error: null }).then(resolve),
      };
      return query;
    },
  },
}));
import { buildFriendProfile } from "@/lib/quorum/friend.server";
beforeEach(() => {
  mocks.from.mockClear();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
  mocks.rows = {
    profiles: {
      id: "target",
      display_name: "Friend",
      avatar_emoji: "",
      avatar_url: null,
      bio: null,
      school: null,
      grad_year: null,
      location_sharing_enabled: true,
      location_pause_indefinite: false,
      location_paused_until: null,
      home_lat: null,
      home_lon: null,
    },
    guardian_links: [],
    group_members: [{ group_id: "circle" }],
    groups: [{ id: "circle", name: "Circle", emoji: "" }],
    location_shares: [
      {
        owner_profile_id: "target",
        viewer_profile_id: "viewer",
        mode: "indefinite",
        expires_at: null,
        hidden: false,
      },
    ],
    contact_nicknames: [],
    plan_participants: [],
    location_pings: [
      {
        lat: 33,
        lon: -96,
        battery_pct: 80,
        status_label: "Walking",
        created_at: "2026-10-12T12:00:00Z",
      },
    ],
  };
});
afterEach(() => vi.unstubAllGlobals());
describe("friend profile location consent", () => {
  it("allows an explicit share and returns no private profile settings", async () => {
    const result = await buildFriendProfile("viewer", "target");
    expect(result.telemetry).toMatchObject({ lat: 33, lon: -96 });
    expect(result).not.toHaveProperty("location_sharing_enabled");
  });
  it.each(["location_pause_indefinite", "location_sharing_enabled"])(
    "honors %s before reading any pings",
    async (flag) => {
      mocks.rows.profiles = {
        ...(mocks.rows.profiles as object),
        [flag]: flag === "location_pause_indefinite",
      };
      expect((await buildFriendProfile("viewer", "target")).telemetry).toBeNull();
      expect(mocks.from).not.toHaveBeenCalledWith("location_pings");
    },
  );
  it("does not let a teen read a guardian's location through the reversed relationship", async () => {
    mocks.rows.guardian_links = [
      { id: "link", guardian_profile_id: "target", teen_profile_id: "viewer" },
    ];
    mocks.rows.location_shares = [];
    expect((await buildFriendProfile("viewer", "target")).telemetry).toBeNull();
    expect(mocks.from).not.toHaveBeenCalledWith("location_pings");
  });
  it("retains the linked guardian's safety access in the correct direction", async () => {
    mocks.rows.guardian_links = [
      { id: "link", guardian_profile_id: "viewer", teen_profile_id: "target" },
    ];
    mocks.rows.location_shares = [];
    mocks.rows.profiles = { ...(mocks.rows.profiles as object), location_pause_indefinite: true };
    expect((await buildFriendProfile("viewer", "target")).telemetry).toMatchObject({
      lat: 33,
      lon: -96,
    });
  });
});
