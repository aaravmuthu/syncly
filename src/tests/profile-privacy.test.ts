import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

type Db = {
  exec(sql: string): Promise<unknown>;
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  close(): Promise<void>;
};
let db: Db;
const owner = "10000000-0000-4000-8000-000000000001";
const peer = "10000000-0000-4000-8000-000000000002";
const outsider = "10000000-0000-4000-8000-000000000003";
const guardian = "10000000-0000-4000-8000-000000000004";
const session = "20000000-0000-4000-8000-000000000001";
const group = "30000000-0000-4000-8000-000000000001";
const safeColumns = "id,display_name,avatar_emoji,avatar_url,bio,school,grad_year";
const privateColumns = [
  "user_id", "phone", "age", "zip_code", "home_address", "home_area", "home_lat", "home_lon",
  "curfew_time", "budget_preference", "parent_approval_required", "sync_code", "sync_code_expires_at",
  "location_sharing_enabled", "independence_level", "preferred_categories",
];
async function admin() { await db.exec("reset role"); }
async function asUser(id = owner, aal = "aal1", sessionId = session) {
  await db.exec("reset role; set role authenticated");
  await db.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify({ sub: id, aal, session_id: sessionId }),
  ]);
}
async function migration(name: string) {
  return readFile(new URL(`../../supabase/migrations/${name}.sql`, import.meta.url), "utf8");
}
beforeAll(async () => {
  const moduleName = process.env.SYNCLY_PGLITE_MODULE ?? "@electric-sql/pglite";
  const { PGlite } = await import(moduleName);
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create table auth.mfa_factors(user_id uuid,factor_type text,status text);
    create function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
    grant usage on schema auth,storage to anon,authenticated,service_role;
    create table storage.objects(id uuid primary key);
    alter table storage.objects enable row level security;
  `);
  for (const name of [
    "20260820000000_initial_schema", "20260820000100_rls_policies",
    "20260820000200_rls_policies_2", "20260820000300_profiles_group_visibility",
    "20260924000000_guardian_pairing_hardening",
    "20260928000000_approval_source_and_profile_guards",
    "20261009010000_require_verified_mfa",
  ]) await db.exec(await migration(name));
  // Reproduce both broad Supabase-style grants and independent legacy column
  // grants. These are deliberately permissive privileges, not replacement RLS.
  await db.exec(`
    grant select,insert,update on all tables in schema public to authenticated;
    grant select on public.profiles to public;
    grant select(home_address) on public.profiles to authenticated,anon,public;
    grant all on all tables in schema public to service_role;
  `);
  for (const id of [owner, peer, outsider, guardian]) {
    await db.query("insert into auth.users values($1,$2,now())", [id, `${id}@example.com`]);
    await db.query(`insert into public.profiles(id,user_id,display_name,home_address,phone,home_lat,home_lon,curfew_time,budget_preference)
      values($1,$1,$2,'Private fixture address','555-0100',40,-90,'22:00','tight')`, [id, `Member ${id.slice(-1)}`]);
  }
  await db.query("insert into public.groups(id,name,created_by) values($1,'Fixture squad',$2)", [group, owner]);
  for (const id of [owner, peer]) await db.query("insert into public.group_members(group_id,profile_id) values($1,$2)", [group,id]);
  await db.query("insert into public.guardian_links(guardian_profile_id,teen_profile_id) values($1,$2)", [guardian,peer]);
}, 30000);
afterAll(async () => { await db?.close(); });

describe.sequential("profile column privacy on isolated PostgreSQL", () => {
  it("reproduces the previous group-peer disclosure, then applies the fix", async () => {
    await asUser();
    expect((await db.query("select home_address from public.profiles where id=$1", [peer])).rows)
      .toEqual([{home_address: "Private fixture address"}]);
    await admin();
    await db.exec(await migration("20261013000000_profile_column_privacy"));
    await asUser();
  });
  it("preserves the existing seven-field roster projection and excludes outsiders", async () => {
    const rows = (await db.query<{id: string}>(`select ${safeColumns} from public.profiles order by id`)).rows;
    expect(rows.map(r => r.id)).toEqual([owner,peer]);
    await asUser(outsider);
    expect((await db.query(`select ${safeColumns} from public.profiles where id=$1`,[peer])).rows).toEqual([]);
    await asUser();
  });
  it.each(privateColumns)("denies peer column %s even with a valid group-member JWT", async column => {
    await expect(db.query(`select ${column} from public.profiles where id=$1`,[peer])).rejects.toThrow(/permission denied/);
  });
  it("denies wildcard reads and private WHERE/ORDER expressions", async () => {
    await expect(db.query("select * from public.profiles")).rejects.toThrow(/permission denied/);
    await expect(db.query("select id from public.profiles where budget_preference='tight'")).rejects.toThrow(/permission denied/);
    await expect(db.query("select id from public.profiles order by home_lat")).rejects.toThrow(/permission denied/);
  });
  it("returns only the signed caller's full profile through an input-free RPC", async () => {
    const rows = (await db.query<{id:string;home_address:string}>("select * from public.my_profile()")).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(owner);
    expect(rows[0]?.home_address).toBe("Private fixture address");
    await expect(db.query("select * from public.my_profile($1)",[peer])).rejects.toThrow(/does not exist/);
    expect((await db.query("select * from public.my_profile() where id=$1",[peer])).rows).toEqual([]);
  });
  it("keeps self writes and safe embedded joins working without exposing user_id", async () => {
    await db.query("update public.profiles set location_sharing_enabled=false where id=$1",[owner]);
    expect((await db.query("select location_sharing_enabled from public.my_profile()")).rows)
      .toEqual([{location_sharing_enabled:false}]);
    expect((await db.query(`select p.id,p.display_name from public.group_members gm
      join public.profiles p on p.id=gm.profile_id where gm.group_id=$1`,[group])).rows).toHaveLength(2);
    expect((await db.query("update public.profiles set display_name='Hijacked' where id=$1 returning id",[peer])).rows).toEqual([]);
  });
  it("keeps linked guardian roster visibility and trusted guardian access", async () => {
    await asUser(guardian);
    expect((await db.query("select id from public.profiles where id=$1",[peer])).rows).toEqual([{id:peer}]);
    await expect(db.query("select home_address from public.profiles where id=$1",[peer])).rejects.toThrow(/permission denied/);
    expect((await db.query<{id:string}>("select id from public.my_profile()")).rows).toEqual([{id:guardian}]);
    await db.exec("reset role; set role service_role");
    expect((await db.query("select home_address from public.profiles where id=$1",[peer])).rows).toHaveLength(1);
    await asUser();
  });
  it("denies anonymous profile and RPC access", async () => {
    await db.exec("reset role; set role anon");
    await expect(db.query("select id from public.profiles")).rejects.toThrow(/permission denied/);
    await expect(db.query("select * from public.my_profile()")).rejects.toThrow(/permission denied/);
    await asUser();
  });
  it("enforces native MFA on both roster and full own RPC", async () => {
    await admin(); await db.query("insert into auth.mfa_factors values($1,'phone','verified')",[owner]);
    await asUser();
    expect((await db.query("select id from public.profiles")).rows).toEqual([]);
    expect((await db.query("select * from public.my_profile()")).rows).toEqual([]);
    await asUser(owner,"aal2");
    expect((await db.query("select id from public.profiles")).rows).toHaveLength(2);
    expect((await db.query("select * from public.my_profile()")).rows).toHaveLength(1);
    await admin(); await db.query("delete from auth.mfa_factors where user_id=$1",[owner]);
  });
  it("enforces email session verification independently of AAL2", async () => {
    await admin(); await db.query("insert into public.account_security values($1,true)",[owner]);
    await asUser(owner,"aal2");
    expect((await db.query("select * from public.my_profile()")).rows).toEqual([]);
    await admin();
    await db.query("insert into public.email_mfa_sessions values($1,$2,$3,now())",[owner,session,`${owner}@example.com`]);
    await asUser(owner,"aal2");
    expect((await db.query("select * from public.my_profile()")).rows).toHaveLength(1);
    await asUser(owner,"aal2",outsider);
    expect((await db.query("select id from public.profiles")).rows).toEqual([]);
    expect((await db.query("select * from public.my_profile()")).rows).toEqual([]);
    await admin(); await db.query("delete from public.account_security where user_id=$1",[owner]);
  });
  it("defaults newly added columns to private and safely reapplies the migration", async () => {
    await admin(); await db.exec("alter table public.profiles add column future_private_note text");
    await asUser();
    await expect(db.query("select future_private_note from public.profiles")).rejects.toThrow(/permission denied/);
    await admin(); await db.exec(await migration("20261013000000_profile_column_privacy"));
    await asUser();
    expect((await db.query(`select ${safeColumns} from public.profiles`)).rows).toHaveLength(2);
    await expect(db.query("select home_address from public.profiles")).rejects.toThrow(/permission denied/);
  });
});
