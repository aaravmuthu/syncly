import { describe, expect, it, vi } from "vitest";
import {
  EXPORT_TABLES,
  exportOwnedRows,
  exportPrivateAccountRows,
} from "@/lib/quorum/account-data.server";
import { removeAccountUploads } from "@/lib/quorum/account-storage.server";

describe("account data portability", () => {
  it("scopes privileged plan and approval exports to the caller and excludes approval tokens", async () => {
    const calls: [string, string, string][] = [];
    const selections: [string, string][] = [];
    const db = {
      from: (table: string) => {
        const query = {
          select: (columns: string) => {
            selections.push([table, columns]);
            return query;
          },
          eq: (column: string, id: string) => {
            calls.push([table, column, id]);
            return query;
          },
          order: () => query,
          range: async () => ({ data: [], error: null }),
          then: (resolve: (result: { data: never[]; error: null }) => unknown) =>
            resolve({ data: [], error: null }),
        };
        return query;
      },
    };
    await exportPrivateAccountRows(db as never, "caller-profile");
    expect(calls).toEqual([
      ["family_plans", "profile_id", "caller-profile"],
      ["parent_approvals", "profile_id", "caller-profile"],
    ]);
    expect(selections.find(([table]) => table === "parent_approvals")?.[1]).not.toContain("token");
  });
  it("scopes every table to the caller and reads beyond the first page", async () => {
    const pages: [string, number, number][] = [];
    const ownership: [string, string, string][] = [];
    const db = {
      from: (table: string) => {
        const query = {
          select: () => query,
          eq: (column: string, id: string) => {
            ownership.push([table, column, id]);
            return query;
          },
          order: () => query,
          range: async (start: number, end: number) => {
            pages.push([table, start, end]);
            return {
              data:
                table === "location_pings"
                  ? Array.from({ length: start === 0 ? 500 : 2 }, (_, i) => ({ id: start + i }))
                  : [],
              error: null,
            };
          },
        };
        return query;
      },
    };
    const result = await exportOwnedRows(db as never, "caller-profile");
    expect(result.location_pings).toHaveLength(502);
    expect(pages).toContainEqual(["location_pings", 500, 999]);
    for (const [table, column] of Object.entries(EXPORT_TABLES)) {
      expect(ownership).toContainEqual([table, column, "caller-profile"]);
    }
    expect(ownership.every(([, , id]) => id === "caller-profile")).toBe(true);
  });
  it("does not return an apparently complete export after a database failure", async () => {
    const query = {
      select: () => query,
      eq: () => query,
      order: () => query,
      range: async () => ({ data: null, error: { message: "denied" } }),
    };
    await expect(exportOwnedRows({ from: () => query } as never, "me")).rejects.toThrow(
      "Could not export",
    );
  });
});

describe("account upload deletion", () => {
  it("collects all pages before removing files and stays in the caller's folders", async () => {
    let removed = false;
    const list = vi.fn(async (folder: string, { offset }: { offset: number }) => {
      expect(removed).toBe(false);
      expect(["user-id", "user-id/chat", "user-id/voice"]).toContain(folder);
      return {
        data: Array.from({ length: offset === 0 ? 100 : 1 }, (_, i) => ({
          id: "file",
          name: `${offset + i}.png`,
        })),
        error: null,
      };
    });
    const paths: string[] = [];
    const remove = vi.fn(async (batch: string[]) => {
      removed = true;
      paths.push(...batch);
      return { error: null };
    });
    await removeAccountUploads({ storage: { from: () => ({ list, remove }) } } as never, "user-id");
    expect(paths).toHaveLength(303);
    expect(new Set(paths).size).toBe(303);
    expect(paths.every((path) => path.startsWith("user-id/"))).toBe(true);
  });
  it("reports a storage error rather than silently claiming deletion succeeded", async () => {
    const bucket = { list: async () => ({ data: [], error: new Error("unavailable") }) };
    await expect(
      removeAccountUploads({ storage: { from: () => bucket } } as never, "me"),
    ).rejects.toThrow("Could not read");
  });
});
