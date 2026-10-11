import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
let db: PGlite;
const plan = "10000000-0000-4000-8000-000000000001";
const rec = "20000000-0000-4000-8000-000000000001";
const passenger = "30000000-0000-4000-8000-000000000001";
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
 create table public.plans(id uuid primary key,status text,window_start timestamptz,window_end timestamptz,selected_recommendation_id uuid,compatibility_score numeric,itinerary jsonb);
 create table public.recommendations(id uuid primary key,plan_id uuid,feasible boolean,breakdown jsonb);
 create table public.votes(plan_id uuid);
 create table public.transport_assignments(plan_id uuid,car_label text,driver_label text,passenger_profile_ids uuid[],leg text);
 grant insert on public.recommendations to authenticated;
 grant select,update on public.plans to authenticated;
 insert into plans values('${plan}','voting',now()+interval '1 day',now()+interval '1 day 2 hours',null,90,null);
 insert into recommendations values('${rec}','${plan}',false,'{}');`);
  await db.exec(
    await readFile(
      new URL("../../supabase/migrations/20261012010000_checked_plan_actions.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.exec("update plans set time_zone='America/Chicago'");
}, 30000);
afterAll(async () => {
  await db?.close();
});
describe.sequential("real PostgreSQL action guards", () => {
  it("blocks direct timing edits that would leave stale feasibility flags", async () => {
    await db.exec("set role authenticated");
    await expect(
      db.exec("update plans set window_start=window_start+interval '1 hour'"),
    ).rejects.toThrow("checked planning action");
    await db.exec("reset role");
  });
  it("does not let a browser insert its own feasibility flag", async () => {
    await db.exec("set role authenticated");
    await expect(
      db.query(
        "insert into recommendations(id,plan_id,feasible,breakdown) values($1,$2,true,'{}')",
        [rec, plan],
      ),
    ).rejects.toThrow("permission denied");
    await db.exec("reset role");
  });
  it("rejects an infeasible option even through the service-only mutation", async () => {
    await expect(db.query("select lock_checked_plan($1,$2)", [plan, rec])).rejects.toThrow(
      "works for everyone",
    );
    expect((await db.query<{ status: string }>("select status from plans")).rows[0].status).toBe(
      "voting",
    );
  });
  it("rejects stale options while new answers are being collected", async () => {
    await db.exec(`update recommendations set feasible=true; update plans set status='collecting'`);
    await expect(db.query("select lock_checked_plan($1,$2)", [plan, rec])).rejects.toThrow(
      "Refresh the options",
    );
  });
  it("locks the chosen itinerary and replaces its rides atomically", async () => {
    await db.exec(
      `update plans set status='voting'; update recommendations set breakdown='{"itinerary":{"anchor":1},"itineraryDurationMinutes":180}';`,
    );
    await db.query("select lock_checked_plan($1,$2,$3)", [
      plan,
      rec,
      JSON.stringify([{ label: "Car 1", driver: "Driver", passengers: [passenger] }]),
    ]);
    const p = (
      await db.query<{ status: string; itinerary: { anchor: number }; minutes: number }>(
        "select status,itinerary,extract(epoch from window_end-window_start)/60 as minutes from plans",
      )
    ).rows[0];
    expect(p.status).toBe("finalized");
    expect(p.itinerary.anchor).toBe(1);
    expect(Number(p.minutes)).toBe(180);
    expect(
      (
        await db.query<{ passenger_profile_ids: string[] }>(
          "select passenger_profile_ids from transport_assignments",
        )
      ).rows[0].passenger_profile_ids,
    ).toEqual([passenger]);
  });
  it("rejects a plan that has already ended", async () => {
    await db.exec(
      `update plans set window_start=now()-interval '2 days',window_end=now()-interval '1 day'`,
    );
    await expect(db.query("select lock_checked_plan($1,$2)", [plan, rec])).rejects.toThrow(
      "already ended",
    );
  });
  it("retiming clears stale votes, choices and rides in one transaction", async () => {
    await db.exec(
      `update plans set window_start='2030-10-11T23:00:00Z',window_end='2030-10-12T02:00:00Z'; insert into votes values('${plan}')`,
    );
    await db.query("select retime_checked_plan($1,$2,$3,$4,$5,$6)", [
      plan,
      "2030-10-11T23:00:00Z",
      "2030-10-11T22:00:00Z",
      "2030-10-12T01:00:00Z",
      null,
      "America/Chicago",
    ]);
    const p = (
      await db.query<{
        status: string;
        selected_recommendation_id: string | null;
        time_zone: string;
      }>("select * from plans")
    ).rows[0];
    expect(p.status).toBe("collecting");
    expect(p.selected_recommendation_id).toBeNull();
    expect(p.time_zone).toBe("America/Chicago");
    for (const table of ["votes", "recommendations", "transport_assignments"])
      expect((await db.query(`select * from ${table}`)).rows).toHaveLength(0);
  });
  it("rejects competing time changes rather than overwriting the new window", async () => {
    await expect(
      db.query("select retime_checked_plan($1,$2,$3,$4,$5,$6)", [
        plan,
        "2030-10-11T23:00:00Z",
        "2030-10-11T21:00:00Z",
        "2030-10-12T00:00:00Z",
        null,
        "America/Chicago",
      ]),
    ).rejects.toThrow("plan changed");
  });
  it("does not allow signed-in users to call service mutations directly", async () => {
    await db.exec("set role authenticated");
    await expect(db.query("select lock_checked_plan($1,$2)", [plan, rec])).rejects.toThrow(
      "permission denied",
    );
    await db.exec("reset role");
  });
});
