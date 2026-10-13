import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rows: {} as Record<string, unknown>, insert: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      const query = {
        select: () => query,
        or: () => query,
        eq: () => query,
        in: () => query,
        gte: () => query,
        maybeSingle: async () => ({ data: mocks.rows[table] ?? null, error: null }),
        then: (resolve: (result: unknown) => unknown) =>
          Promise.resolve({ data: mocks.rows[table] ?? [], error: null }).then(resolve),
        insert: mocks.insert,
      };
      return query;
    },
  },
}));
import { broadcastDmSystemEvent } from "@/lib/quorum/dm.server";
beforeEach(() => {
  mocks.insert.mockReset().mockResolvedValue({ error: null });
  mocks.rows = {
    profiles: {
      location_sharing_enabled: true,
      location_pause_indefinite: false,
      location_paused_until: null,
    },
    direct_threads: ["friend", "stranger", "expired", "hidden", "guardian"].map((peer) => ({
      id: peer,
      a_profile_id: "owner",
      b_profile_id: peer,
    })),
    location_shares: [
      { viewer_profile_id: "friend", expires_at: null, hidden: false },
      { viewer_profile_id: "expired", expires_at: "2020-01-01T00:00:00Z", hidden: false },
      { viewer_profile_id: "hidden", expires_at: null, hidden: true },
    ],
    guardian_links: [{ guardian_profile_id: "guardian" }],
    direct_messages: [],
  };
});
describe("automatic location cards", () => {
  const event = { tag: "enroute" as const, content: "On the way", lat: 33, lon: -96 };
  it("sends coordinates only to a permitted friend and linked guardian", async () => {
    await broadcastDmSystemEvent("owner", event);
    expect(mocks.insert.mock.calls[0][0].map((r: { thread_id: string }) => r.thread_id)).toEqual([
      "friend",
      "guardian",
    ]);
  });
  it.each(["location_pause_indefinite", "location_sharing_enabled"])(
    "honors %s for friends while retaining guardian safety",
    async (flag) => {
      mocks.rows.profiles = {
        ...(mocks.rows.profiles as object),
        [flag]: flag === "location_pause_indefinite",
      };
      await broadcastDmSystemEvent("owner", event);
      expect(mocks.insert.mock.calls[0][0].map((r: { thread_id: string }) => r.thread_id)).toEqual([
        "guardian",
      ]);
    },
  );
  it("does not send a card when no peer is authorized", async () => {
    mocks.rows.guardian_links = [];
    mocks.rows.location_shares = [];
    await broadcastDmSystemEvent("owner", event);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
