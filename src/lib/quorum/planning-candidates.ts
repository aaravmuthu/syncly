import { scoreOption, type MemberInput } from "./engine";
import {
  costRange,
  pickOf,
  readItinerary,
  STOP_KINDS,
  timeline,
  type Itinerary,
} from "./itinerary";
import { haversineMiles, milesToDriveMinutes } from "./location";
import { zonedClockTime, zonedDateKey } from "./plan-time";
import type { MemberBase } from "./fairpoint.server";
import type { OptionSeed, PlanCategory } from "./types";
import { isOpenDuring } from "./hardfilter";

export type PlanningWindow = {
  window_start: string | null;
  window_end: string | null;
  time_zone?: string | null;
};
export function applyPlanningWindow(option: OptionSeed, plan: PlanningWindow): OptionSeed {
  if (!plan.window_start) return option;
  const zone = plan.time_zone ?? "UTC";
  return {
    ...option,
    start: zonedClockTime(plan.window_start, zone),
    end: plan.window_end ? zonedClockTime(plan.window_end, zone) : option.end,
    ...(plan.window_end
      ? {
          durationMinutes: Math.round(
            (Date.parse(plan.window_end) - Date.parse(plan.window_start)) / 60000,
          ),
        }
      : {}),
  };
}

/** Every candidate changes only the anchor; the rest of the reviewed outing stays intact. */
export function itineraryCandidates(
  raw: unknown,
  plan: PlanningWindow,
): { option: OptionSeed; itinerary: Itinerary }[] {
  const stored = readItinerary(raw);
  if (!stored) return [];
  const it = {
    ...stored,
    ...(plan.window_start
      ? {
          date: zonedDateKey(plan.window_start, plan.time_zone ?? "UTC"),
          start: zonedClockTime(plan.window_start, plan.time_zone ?? "UTC"),
        }
      : {}),
  };
  return it.stops[it.anchor].options.map((venue, pick) => {
    const itinerary = {
      ...it,
      stops: it.stops.map((s, i) => (i === it.anchor ? { ...s, pick } : s)),
    };
    const timed = timeline(itinerary);
    const cost = costRange(itinerary);
    const food = itinerary.stops.filter((s) => STOP_KINDS[s.kind].planCategory === "dinner");
    const diets = food.length
      ? (pickOf(food[0])?.dietaryFriendly ?? []).filter((d) =>
          food.every((s) => pickOf(s)?.dietaryFriendly?.includes(d)),
        )
      : [];
    return {
      itinerary,
      option: {
        key: venue.key,
        title: venue.title,
        subtitle: `${itinerary.stops.length} stops · ${itinerary.title}`,
        category: [STOP_KINDS[it.stops[it.anchor].kind].planCategory],
        costMin: cost.min,
        costMax: cost.max,
        costForBudget: cost.max,
        start: itinerary.start,
        end: timed.end,
        durationMinutes: timed.totalMinutes,
        travelMinutes: 0,
        location: venue.title,
        tags: itinerary.stops.map((s) => s.kind),
        dietaryFriendly: diets,
        style: food.length ? "sit-down" : "venue",
        kind: food.length ? "food" : "activity",
        requiresDriving: true,
        lat: venue.lat,
        lon: venue.lon,
        address: venue.address ?? undefined,
        rating: venue.rating ?? undefined,
      } satisfies OptionSeed,
    };
  });
}

export function itineraryMemberTravel(it: Itinerary, base: MemberBase) {
  const first = pickOf(it.stops[0]);
  const last = pickOf(it.stops[it.stops.length - 1]);
  if (base.lat == null || base.lon == null || !first || !last) return null;
  const home = { lat: base.lat, lon: base.lon };
  const returning = milesToDriveMinutes(haversineMiles(home, last));
  const outward = milesToDriveMinutes(haversineMiles(home, first));
  const interStop = timeline(it).stops.reduce((sum, s) => sum + (s.driveMinutes ?? 0), 0);
  return { travelMinutes: outward + interStop + returning, returnTravelMinutes: returning };
}

/** Private route distances are used only in scoring, never added to public explanations. */
export function scoreWholeItinerary(
  option: OptionSeed,
  it: Itinerary,
  members: MemberInput[],
  bases: MemberBase[],
  radius: number | null,
) {
  const venues = it.stops.map(pickOf);
  const first = venues[0];
  const last = venues.at(-1);
  const interStop = timeline(it).stops.reduce((sum, s) => sum + (s.driveMinutes ?? 0), 0);
  let routesOk = venues.every(Boolean);
  const inputs = members.map((member) => {
    const base = bases.find((b) => b.profileId === member.profileId);
    const cap =
      member.constraints.maxSpend ??
      member.constraints.totalBudget ??
      member.constraints.maxTicketPrice;
    if (cap != null && option.costMax > cap) routesOk = false;
    if (!base || base.lat == null || base.lon == null || !first || !last) {
      if (
        member.constraints.maxTravelMinutes != null ||
        member.constraints.maxDistanceMiles != null ||
        member.constraints.requiredReturnTime ||
        base?.curfew
      )
        routesOk = false;
      return member;
    }
    const home = { lat: base.lat, lon: base.lon };
    const distances = venues.map((v) => (v ? haversineMiles(home, v) : Infinity));
    const limit = member.constraints.maxDistanceMiles ?? radius;
    if (limit != null && distances.some((d) => d > limit)) routesOk = false;
    const outward = milesToDriveMinutes(haversineMiles(home, first));
    const returning = milesToDriveMinutes(haversineMiles(home, last));
    const returningAt =
      Number(it.start.slice(0, 2)) * 60 +
      Number(it.start.slice(3, 5)) +
      timeline(it).totalMinutes +
      returning;
    if (base.curfew) {
      let curfew = Number(base.curfew.slice(0, 2)) * 60 + Number(base.curfew.slice(3, 5));
      if (curfew < 360 && Number(it.start.slice(0, 2)) >= 12) curfew += 1440;
      if (returningAt > curfew) routesOk = false;
    }
    return {
      ...member,
      travelMinutes: outward + interStop + returning,
      returnTravelMinutes: returning,
      constraints: {
        ...member.constraints,
        requiredReturnTime: member.constraints.requiredReturnTime ?? base.curfew,
      },
    };
  });
  const scored = scoreOption(
    {
      ...option,
      travelMinutes: Math.max(0, ...inputs.map((m) => m.travelMinutes ?? option.travelMinutes)),
    },
    inputs,
  );
  if (!routesOk)
    return {
      ...scored,
      feasible: false,
      breakdown: {
        ...scored.breakdown,
        hardFailures: scored.breakdown.hardFailures + 1,
        reasons: [],
        cautions: [
          ...scored.breakdown.cautions,
          "The full outing does not meet every member’s requirements",
        ],
      },
    };
  return scored;
}

export function itineraryHoursFit(it: Itinerary): boolean {
  let elapsed = 0;
  return timeline(it).stops.every((s) => {
    elapsed += s.driveMinutes ?? 0;
    const date = it.date ? new Date(`${it.date}T12:00:00Z`) : null;
    if (date)
      date.setUTCDate(
        date.getUTCDate() +
          Math.floor(
            (Number(it.start.slice(0, 2)) * 60 + Number(it.start.slice(3, 5)) + elapsed) / 1440,
          ),
      );
    elapsed += s.minutes;
    return isOpenDuring(
      pickOf(s)?.openHours,
      s.start,
      s.end,
      STOP_KINDS[s.kind].planCategory as PlanCategory,
      date?.toISOString().slice(0, 10),
    );
  });
}
