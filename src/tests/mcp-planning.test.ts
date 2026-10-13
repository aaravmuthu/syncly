import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
const mocks = vi.hoisted(() => ({ insert: vi.fn() }));
vi.mock("@lovable.dev/mcp-js", () => ({ defineTool: (definition: unknown) => definition }));
vi.mock("@/lib/mcp/supabase", () => ({
  supabaseForUser: () => ({
    from: () => {
      const query = {
        insert: (row: unknown) => {
          mocks.insert(row);
          return query;
        },
        select: () => query,
        single: async () => ({
          data: { id: "plan", title: "Dinner", status: "collecting" },
          error: null,
        }),
        then: (resolve: (result: unknown) => unknown) =>
          Promise.resolve({ error: null }).then(resolve),
      };
      return query;
    },
  }),
  myProfileId: async () => "host",
  errorResult: (message: string) => ({ isError: true, content: [{ type: "text", text: message }] }),
  textResult: (text: string, structuredContent: unknown) => ({
    content: [{ type: "text", text }],
    structuredContent,
  }),
}));
import createPlan from "@/lib/mcp/tools/create-plan";
const tool = createPlan as unknown as {
  inputSchema: z.ZodRawShape;
  handler: (
    input: Record<string, unknown>,
    context: { isAuthenticated: () => boolean },
  ) => Promise<{ isError?: boolean }>;
};
const schema = z.object(tool.inputSchema);
const base = {
  circleId: "10000000-0000-4000-8000-000000000001",
  title: "Dinner",
  category: "dinner",
};
beforeEach(() => mocks.insert.mockClear());
describe("MCP creates plans the regular planner can use", () => {
  it.each([
    ["food", "dinner"],
    ["outdoors", "hangout"],
    ["other", "custom"],
    ["movie", "movie"],
  ])("maps %s to %s and persists the host's timezone", async (category, expected) => {
    const input = schema.parse({ ...base, category, timeZone: "America/Chicago" });
    await tool.handler(input, { isAuthenticated: () => true });
    expect(mocks.insert.mock.calls[0][0]).toMatchObject({
      category: expected,
      time_zone: "America/Chicago",
    });
    expect(mocks.insert.mock.calls[1][0]).toMatchObject({ profile_id: "host", attending: true });
  });
  it("keeps old clients usable with a UTC default", () => {
    expect(schema.parse(base).timeZone).toBe("UTC");
  });
  it("rejects empty names, invalid instants, and unknown timezones", () => {
    for (const patch of [{ title: "   " }, { windowStart: "18:00" }, { timeZone: "Mars/Olympus" }])
      expect(schema.safeParse({ ...base, ...patch }).success).toBe(false);
  });
  it("rejects reversed windows before writing anything", async () => {
    const input = schema.parse({
      ...base,
      windowStart: "2030-10-12T23:00:00Z",
      windowEnd: "2030-10-12T21:00:00Z",
    });
    expect((await tool.handler(input, { isAuthenticated: () => true })).isError).toBe(true);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
