import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

type Policy = {
  policyname: string;
  cmd: string;
  qual: string;
  with_check: string;
  roles: string;
};

function policies(schema: string, table: string): Policy[] {
  const sql = `select coalesce(json_agg(json_build_object(
      'policyname', policyname,
      'cmd', cmd,
      'qual', coalesce(qual, ''),
      'with_check', coalesce(with_check, ''),
      'roles', array_to_string(roles, ',')
    )), '[]'::json)::text
    from pg_policies where schemaname = '${schema}' and tablename = '${table}';`;
  const out = execFileSync("psql", ["-At", "-c", sql], { encoding: "utf8" });
  return JSON.parse(out.trim()) as Policy[];
}

const byCmd = (list: Policy[], cmd: string) => list.filter((p) => p.cmd === cmd);
const norm = (s: string) => s.replace(/\s+/g, " ").toLowerCase();

describe("avatars storage object policies (avatars_no_delete_check_used_select_only)", () => {
  const list = policies("storage", "objects").filter((p) =>
    norm(`${p.policyname} ${p.qual} ${p.with_check}`).includes("avatars"),
  );

  it("keeps a SELECT policy scoped to the owner's own folder", () => {
    const selects = byCmd(list, "SELECT");
    expect(selects.length).toBeGreaterThan(0);
    for (const p of selects) {
      const q = norm(p.qual);
      expect(q).toContain("storage.foldername(name))[1]");
      expect(q).toContain("auth.uid()");
    }
  });

  it("scopes every write policy (insert/update/delete) to the user's own folder", () => {
    for (const cmd of ["INSERT", "UPDATE", "DELETE"]) {
      const rows = byCmd(list, cmd);
      expect(rows.length, `${cmd} policy missing`).toBe(1);
      const expr = norm(`${rows[0]!.qual} ${rows[0]!.with_check}`);
      expect(expr).toContain("storage.foldername(name))[1]");
      expect(expr).toContain("auth.uid()");
    }
    expect(byCmd(list, "ALL")).toEqual([]);
  });
});

describe("group_messages policies (group_messages_no_update_delete_policy)", () => {
  const list = policies("public", "group_messages");

  it("allows UPDATE only for the sender inside their group, and blocks system messages", () => {
    const updates = byCmd(list, "UPDATE");
    expect(updates.length).toBe(1);
    const [u] = updates;
    expect(norm(u!.qual)).toContain("sender_id = my_profile_id()");
    expect(norm(u!.qual)).toContain("is_group_member(group_id)");
    expect(norm(u!.with_check)).toContain("sender_id = my_profile_id()");
    expect(norm(u!.with_check)).toContain("system_type is null");
  });

  it("allows DELETE only for the sender inside their group", () => {
    const deletes = byCmd(list, "DELETE");
    expect(deletes.length).toBe(1);
    expect(norm(deletes[0]!.qual)).toContain("sender_id = my_profile_id()");
    expect(norm(deletes[0]!.qual)).toContain("is_group_member(group_id)");
  });

  it("never grants blanket write access via an ALL policy", () => {
    expect(byCmd(list, "ALL")).toEqual([]);
  });
});

describe("group_preferences policies (group_preferences_missing_delete_insert_owner_alignment)", () => {
  const list = policies("public", "group_preferences");

  it("requires circle admin for INSERT, UPDATE and DELETE alike", () => {
    for (const cmd of ["INSERT", "UPDATE", "DELETE"]) {
      const rows = byCmd(list, cmd);
      expect(rows.length, `${cmd} policy missing`).toBe(1);
      const expr = norm(`${rows[0]!.qual} ${rows[0]!.with_check}`);
      expect(expr, `${cmd} not admin-scoped`).toContain("is_group_admin(group_id)");
    }
  });

  it("keeps UPDATE guarded by both USING and WITH CHECK", () => {
    const [u] = byCmd(list, "UPDATE");
    expect(norm(u!.qual)).toContain("is_group_admin(group_id)");
    expect(norm(u!.with_check)).toContain("is_group_admin(group_id)");
  });

  it("limits SELECT to group members and has no ALL policy", () => {
    expect(norm(byCmd(list, "SELECT")[0]!.qual)).toContain("is_group_member(group_id)");
    expect(byCmd(list, "ALL")).toEqual([]);
  });
});
