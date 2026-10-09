import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

type Db = {
  exec: (sql: string) => Promise<unknown>;
  query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
  close: () => Promise<void>;
};
let db: Db;
const user = "10000000-0000-4000-8000-000000000001";
const session = "20000000-0000-4000-8000-000000000001";
const secondSession = "20000000-0000-4000-8000-000000000002";
const email = "test@example.com";
let sequence = 0;
async function asUser(sessionId = session, aal = "aal1") {
  await db.exec("reset role; set role authenticated");
  await db.query("select set_config('request.jwt.claims', $1, false)", [
    JSON.stringify({ sub: user, session_id: sessionId, aal }),
  ]);
}
async function admin() {
  await db.exec("reset role");
}
async function allowed() {
  return (await db.query<{ ok: boolean }>("select public.has_required_mfa() as ok")).rows[0]!.ok;
}
async function reserve(purpose = "verify", sessionId = session) {
  await admin();
  const challenge = `30000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`;
  await db.query("select public.reserve_email_mfa_challenge($1,$2,$3,$4,$5,$6)", [
    user,
    sessionId,
    challenge,
    "test-digest",
    email,
    purpose,
  ]);
  return challenge;
}
async function verify(
  challenge: string,
  digest = "test-digest",
  sessionId = session,
  destination = email,
) {
  await admin();
  return (
    await db.query<{ result: { verified: boolean } }>(
      "select public.verify_email_mfa_challenge($1,$2,$3,$4,$5) as result",
      [user, sessionId, challenge, digest, destination],
    )
  ).rows[0]!.result;
}
async function advanceCooldown() {
  await admin();
  await db.query(
    "update public.email_mfa_send_limits set last_sent_at=now()-interval '61 seconds' where user_id=$1",
    [user],
  );
}

beforeAll(async () => {
  // The override allows a disposable test runtime; ordinary installs use the dev dependency.
  const moduleName = process.env.SYNCLY_PGLITE_MODULE ?? "@electric-sql/pglite";
  const { PGlite } = await import(moduleName);
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create table auth.mfa_factors(user_id uuid,factor_type text,status text);
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
    grant usage on schema auth, storage to anon,authenticated,service_role;
    create table public.profiles(id uuid primary key,user_id uuid not null);
    alter table public.profiles enable row level security;
    grant select,update on public.profiles to authenticated;
    create policy owner_access on public.profiles to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
    create table storage.objects(id uuid primary key,owner_id uuid not null);
    alter table storage.objects enable row level security;
    grant select,update on storage.objects to authenticated;
    create policy owner_access on storage.objects to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
    insert into auth.users values('${user}','${email}',now());
    insert into public.profiles values('${user}','${user}');
    insert into storage.objects values('${user}','${user}');
  `);
  await db.exec(
    await readFile(
      new URL("../../supabase/migrations/20261009010000_require_verified_mfa.sql", import.meta.url),
      "utf8",
    ),
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});

// These exercise the real migration on PostgreSQL. Auth claim helpers and the
// pre-existing owner policies are minimal fixtures, not hosted Supabase services.
describe.sequential("MFA migration on isolated PostgreSQL", () => {
  it("allows the existing owner policy before MFA enrollment", async () => {
    await asUser();
    expect(await allowed()).toBe(true);
    expect((await db.query("select * from public.profiles")).rows).toHaveLength(1);
  });
  it("requires AAL2 for a verified native factor, including private Storage", async () => {
    await admin();
    await db.query("insert into auth.mfa_factors values($1,'phone','verified')", [user]);
    await asUser();
    expect(await allowed()).toBe(false);
    expect((await db.query("select * from public.profiles")).rows).toHaveLength(0);
    expect((await db.query("select * from storage.objects")).rows).toHaveLength(0);
    expect(
      (await db.query("update public.profiles set user_id=user_id returning id")).rows,
    ).toHaveLength(0);
    await asUser(session, "aal2");
    expect(await allowed()).toBe(true);
    expect((await db.query("select * from public.profiles")).rows).toHaveLength(1);
    await admin();
    await db.query("delete from auth.mfa_factors where user_id=$1", [user]);
  });
  it("enrolls email only after successful verification and isolates new sessions", async () => {
    const challenge = await reserve("enroll");
    await asUser();
    expect(await allowed()).toBe(true);
    expect((await verify(challenge)).verified).toBe(true);
    await asUser();
    expect(await allowed()).toBe(true);
    await asUser(secondSession);
    expect(await allowed()).toBe(false);
    expect((await db.query("select * from public.profiles")).rows).toHaveLength(0);
  });
  it("blocks client access to security tables and privileged verification RPCs", async () => {
    await asUser();
    for (const table of [
      "account_security",
      "email_mfa_sessions",
      "email_mfa_challenges",
      "email_mfa_send_limits",
    ]) {
      await expect(db.query(`select * from public.${table}`)).rejects.toThrow(/permission denied/);
    }
    await expect(
      db.query("select public.email_mfa_status($1,$2)", [user, session]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.query("select public.verify_email_mfa_challenge($1,$2,$3,$4,$5)", [
        user,
        session,
        session,
        "test-digest",
        email,
      ]),
    ).rejects.toThrow(/permission denied/);
  });
  it("rate-limits sends across sessions", async () => {
    await expect(reserve("verify", secondSession)).rejects.toThrow(/Wait at least/);
  });
  it("rejects attempts to verify a different session or email", async () => {
    await advanceCooldown();
    const challenge = await reserve("verify", secondSession);
    expect((await verify(challenge, "test-digest", session)).verified).toBe(false);
    expect(
      (await verify(challenge, "test-digest", secondSession, "other@example.com")).verified,
    ).toBe(false);
    await asUser(secondSession);
    expect(await allowed()).toBe(false);
  });
  it("exhausts five bad attempts and refuses a correct code after exhaustion", async () => {
    await advanceCooldown();
    const challenge = await reserve("verify", secondSession);
    for (let attempt = 0; attempt < 5; attempt++)
      expect((await verify(challenge, "wrong-digest", secondSession)).verified).toBe(false);
    expect((await verify(challenge, "test-digest", secondSession)).verified).toBe(false);
    await asUser(secondSession);
    expect(await allowed()).toBe(false);
  });
  it("rejects expired challenges", async () => {
    await advanceCooldown();
    const challenge = await reserve("verify", secondSession);
    await db.query(
      "update public.email_mfa_challenges set expires_at=now()-interval '1 second' where challenge_id=$1",
      [challenge],
    );
    expect((await verify(challenge, "test-digest", secondSession)).verified).toBe(false);
  });
  it("consumes codes once and grants only the verified session access", async () => {
    await advanceCooldown();
    const challenge = await reserve("verify", secondSession);
    expect((await verify(challenge, "test-digest", secondSession)).verified).toBe(true);
    expect((await verify(challenge, "test-digest", secondSession)).verified).toBe(false);
    await asUser(secondSession);
    expect(await allowed()).toBe(true);
  });
  it("invalidates an old-email marker and a marker older than twelve hours", async () => {
    await admin();
    await db.query("update auth.users set email='changed@example.com' where id=$1", [user]);
    await asUser(secondSession);
    expect(await allowed()).toBe(false);
    await admin();
    await db.query("update auth.users set email=$1 where id=$2", [email, user]);
    await db.query(
      "update public.email_mfa_sessions set verified_at=now()-interval '12 hours' where user_id=$1 and session_id=$2",
      [user, secondSession],
    );
    await asUser(secondSession);
    expect(await allowed()).toBe(false);
  });
  it("requires native and email verification when both factors are enabled", async () => {
    await admin();
    await db.query("insert into auth.mfa_factors values($1,'phone','verified')", [user]);
    await asUser();
    expect(await allowed()).toBe(false);
    await asUser(session, "aal2");
    expect(await allowed()).toBe(true);
    await asUser(secondSession, "aal2");
    expect(await allowed()).toBe(false);
    await admin();
    await db.query("delete from auth.mfa_factors where user_id=$1", [user]);
  });
  it("caps hourly sends and permits email disable only after code verification", async () => {
    await admin();
    await db.query("update public.email_mfa_send_limits set send_count=10 where user_id=$1", [
      user,
    ]);
    await advanceCooldown();
    await expect(reserve("verify")).rejects.toThrow(/Too many email/);
    await db.query(
      "update public.email_mfa_send_limits set window_start=now()-interval '1 hour' where user_id=$1",
      [user],
    );
    const challenge = await reserve("disable");
    expect((await verify(challenge, "wrong-digest")).verified).toBe(false);
    await asUser(secondSession);
    expect(await allowed()).toBe(false);
    expect((await verify(challenge)).verified).toBe(true);
    await asUser(secondSession);
    expect(await allowed()).toBe(true);
  });
});
