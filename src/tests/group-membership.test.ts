import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
let db: PGlite;
const owner = "10000000-0000-4000-8000-000000000001";
const next = "10000000-0000-4000-8000-000000000002";
const other = "10000000-0000-4000-8000-000000000003";
const group = "20000000-0000-4000-8000-000000000001";
const unrelated = "20000000-0000-4000-8000-000000000002";
const plan = "30000000-0000-4000-8000-000000000001";
const otherPlan = "30000000-0000-4000-8000-000000000002";
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create table groups(id uuid primary key, created_by uuid not null);
    create table group_members(group_id uuid references groups(id), profile_id uuid, role text not null, primary key(group_id,profile_id));
    create table plans(id uuid primary key, group_id uuid references groups(id));
    create table votes(plan_id uuid references plans(id), profile_id uuid);
    create table plan_constraints(plan_id uuid references plans(id), profile_id uuid);
    create table plan_participants(plan_id uuid references plans(id), profile_id uuid);`);
  await db.exec(
    await readFile(
      new URL(
        "../../supabase/migrations/20261012020000_atomic_group_membership.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec(`truncate groups cascade;
    insert into groups values('${group}','${owner}'),('${unrelated}','${owner}');
    insert into group_members values('${group}','${owner}','owner'),('${group}','${next}','member'),('${group}','${other}','member');
    insert into plans values('${plan}','${group}'),('${otherPlan}','${unrelated}');
    insert into votes values('${plan}','${owner}'),('${otherPlan}','${owner}');
    insert into plan_constraints select * from votes;
    insert into plan_participants select * from votes;`);
});
const change = (actor: string, target: string | null, leave = false) =>
  db.query("select change_group_membership($1,$2,$3,$4)", [group, actor, target, leave]);
const currentOwner = async () =>
  (await db.query<{ created_by: string }>("select created_by from groups where id=$1", [group]))
    .rows[0].created_by;
describe.sequential("atomic ownership and departure", () => {
  it.each([false, true])("rejects a transfer to yourself (leaving=%s)", async (leave) => {
    await expect(change(owner, owner, leave)).rejects.toThrow("another member");
    expect(await currentOwner()).toBe(owner);
    expect((await db.query("select * from group_members where role='owner'")).rows).toHaveLength(1);
  });
  it("rejects transfers by nonowners or to nonmembers", async () => {
    await expect(change(next, other)).rejects.toThrow("Only the group owner");
    await expect(change(owner, plan)).rejects.toThrow("not in this group");
    await expect(change(plan, next)).rejects.toThrow("not in this group");
    await expect(change(owner, null, true)).rejects.toThrow("Choose a new owner");
    expect(await currentOwner()).toBe(owner);
  });
  it("transfers both ownership records while keeping the previous owner a member", async () => {
    await change(owner, next);
    expect(await currentOwner()).toBe(next);
    expect(
      (
        await db.query<{ profile_id: string }>(
          "select profile_id from group_members where role='owner'",
        )
      ).rows.map((r) => r.profile_id),
    ).toEqual([next]);
    expect(
      (
        await db.query<{ role: string }>("select role from group_members where profile_id=$1", [
          owner,
        ])
      ).rows[0].role,
    ).toBe("member");
  });
  it("transfers and removes only the leaving member's participation in this group", async () => {
    await change(owner, next, true);
    expect(await currentOwner()).toBe(next);
    expect(
      (await db.query("select * from group_members where profile_id=$1", [owner])).rows,
    ).toEqual([]);
    for (const table of ["votes", "plan_constraints", "plan_participants"])
      expect(
        (await db.query<{ plan_id: string }>(`select plan_id from ${table}`)).rows.map(
          (r) => r.plan_id,
        ),
      ).toEqual([otherPlan]);
  });
  it("lets an ordinary member leave without changing ownership", async () => {
    const result = await change(next, null, true);
    expect(result.rows[0]).toEqual({ change_group_membership: false });
    expect(await currentOwner()).toBe(owner);
  });
  it("rolls back the transfer and all cleanup if a later deletion fails", async () => {
    await db.exec(`create function block_departure() returns trigger language plpgsql as $$ begin raise exception 'fixture failure'; end $$;
      create trigger block_departure before delete on plan_participants for each row execute function block_departure();`);
    try {
      await expect(change(owner, next, true)).rejects.toThrow("fixture failure");
      expect(await currentOwner()).toBe(owner);
      expect(
        (
          await db.query("select * from group_members where profile_id=$1 and role='owner'", [
            owner,
          ])
        ).rows,
      ).toHaveLength(1);
      for (const table of ["votes", "plan_constraints", "plan_participants"])
        expect(
          (await db.query(`select * from ${table} where plan_id=$1`, [plan])).rows,
        ).toHaveLength(1);
    } finally {
      await db.exec(
        "drop trigger block_departure on plan_participants; drop function block_departure()",
      );
    }
  });
  it("denies direct anonymous and authenticated RPC execution", async () => {
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      try {
        await expect(change(owner, next)).rejects.toThrow("permission denied");
      } finally {
        await db.exec("reset role");
      }
    }
  });
});
