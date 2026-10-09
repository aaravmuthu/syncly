import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

type Policy = {
  policyname: string;
  cmd: string;
  qual: string;
  with_check: string;
  roles: string;
  permissive: string;
};

function policies(schema: string, table: string, includeRestrictive = false): Policy[] {
  const sql = `select coalesce(json_agg(json_build_object(
      'policyname', policyname,
      'cmd', cmd,
      'qual', coalesce(qual, ''),
      'with_check', coalesce(with_check, ''),
      'roles', array_to_string(roles, ','),
      'permissive', permissive
    )), '[]'::json)::text
    from pg_policies where schemaname = '${schema}' and tablename = '${table}';`;
  const out = execFileSync("psql", ["-At", "-c", sql], { encoding: "utf8" });
  const rows = JSON.parse(out.trim()) as Policy[];
  return includeRestrictive ? rows : rows.filter((p) => p.permissive === "PERMISSIVE");
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

describe("MFA database enforcement", () => {
  it("requires MFA through restrictive policies without granting access", () => {
    for (const [schema, table] of [
      ["public", "profiles"],
      ["public", "group_messages"],
      ["public", "location_pings"],
      ["storage", "objects"],
    ]) {
      const gate = policies(schema!, table!, true).find(
        (p) => p.policyname === "require_verified_mfa",
      );
      expect(gate, `${schema}.${table} MFA policy missing`).toBeDefined();
      expect(gate!.permissive).toBe("RESTRICTIVE");
      expect(gate!.cmd).toBe("ALL");
      expect(gate!.roles).toBe("authenticated");
      expect(norm(gate!.qual)).toContain("has_required_mfa()");
      expect(norm(gate!.with_check)).toContain("has_required_mfa()");
    }
  });
});

describe("email MFA private state", () => {
  it("keeps challenge and verification tables private to the service role", () => {
    const sql = `select bool_and(not has_table_privilege(role_name, 'public.' || table_name, 'SELECT,INSERT,UPDATE,DELETE'))
      from unnest(array['anon','authenticated']) role_name
      cross join unnest(array['account_security','email_mfa_sessions','email_mfa_challenges','email_mfa_send_limits']) table_name;`;
    expect(execFileSync("psql", ["-At", "-c", sql], { encoding: "utf8" }).trim()).toBe("t");
  });
  it("does not expose service verification RPCs to a first-factor client", () => {
    const sql = `select bool_and(not has_function_privilege(role_name, function_name, 'EXECUTE'))
      from unnest(array['anon','authenticated']) role_name
      cross join unnest(array['public.email_mfa_status(uuid,uuid)', 'public.reserve_email_mfa_challenge(uuid,uuid,uuid,text,text,text)', 'public.verify_email_mfa_challenge(uuid,uuid,uuid,text,text)']) function_name;`;
    expect(execFileSync("psql", ["-At", "-c", sql], { encoding: "utf8" }).trim()).toBe("t");
  });
});
