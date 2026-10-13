import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
let db: PGlite;
const owner = "10000000-0000-4000-8000-000000000001";
const viewer = "10000000-0000-4000-8000-000000000002";
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create function my_profile_id() returns uuid language sql stable as $$ select current_setting('fixture.profile_id')::uuid $$;
    create table profiles(id uuid primary key, location_sharing_enabled boolean, location_pause_indefinite boolean, location_paused_until timestamptz);
    create table location_shares(owner_profile_id uuid, viewer_profile_id uuid, hidden boolean, expires_at timestamptz);
    create table location_pings(profile_id uuid, lat numeric, lon numeric);
    alter table profiles enable row level security;
    alter table location_shares enable row level security;
    alter table location_pings enable row level security;
    grant select on profiles,location_shares,location_pings to authenticated;
    create policy location_pings_select_own on location_pings for select to authenticated using(profile_id=my_profile_id());
    select set_config('fixture.profile_id','${viewer}',false);`);
  await db.exec(
    await readFile(
      new URL(
        "../../supabase/migrations/20261012030000_shared_location_visibility.sql",
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
  await db.exec(`truncate profiles, location_shares, location_pings;
    insert into profiles values('${owner}',true,false,null);
    insert into location_shares values('${owner}','${viewer}',false,null);
    insert into location_pings values('${owner}',33,-96);
    select set_config('fixture.profile_id','${viewer}',false);`);
});
async function readAsViewer() {
  await db.exec("set role authenticated");
  try {
    return (await db.query("select lat,lon from location_pings")).rows;
  } finally {
    await db.exec("reset role");
  }
}
describe.sequential("location consent for direct database reads", () => {
  it("lets an authorized friend see a ping without exposing shares or private profile fields", async () => {
    expect(await readAsViewer()).toEqual([{ lat: "33", lon: "-96" }]);
    await db.exec("set role authenticated");
    try {
      expect((await db.query("select * from location_shares")).rows).toEqual([]);
      expect((await db.query("select * from profiles")).rows).toEqual([]);
    } finally {
      await db.exec("reset role");
    }
  });
  it.each([
    "update profiles set location_sharing_enabled=false",
    "update profiles set location_pause_indefinite=true",
    "update profiles set location_paused_until=now()+interval '1 hour'",
    "update location_shares set hidden=true",
    "update location_shares set expires_at=now()-interval '1 minute'",
    "delete from location_shares",
    "update location_shares set viewer_profile_id=owner_profile_id",
  ])("blocks friend access after %s", async (sql) => {
    await db.exec(sql);
    expect(await readAsViewer()).toEqual([]);
  });
  it("resumes visibility after a timed pause ends", async () => {
    await db.exec("update profiles set location_paused_until=now()-interval '1 minute'");
    expect(await readAsViewer()).toHaveLength(1);
  });
  it("retains the owner's own access even while sharing is off", async () => {
    await db.exec(
      `update profiles set location_sharing_enabled=false; select set_config('fixture.profile_id','${owner}',false)`,
    );
    expect(await readAsViewer()).toHaveLength(1);
  });
  it("does not grant the visibility helper to anonymous callers", async () => {
    await db.exec("set role anon");
    try {
      await expect(db.query("select can_view_shared_location($1)", [owner])).rejects.toThrow(
        "permission denied",
      );
    } finally {
      await db.exec("reset role");
    }
  });
});
