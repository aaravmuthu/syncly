// Client-safe. The AI-built multi-stop plan ("itinerary"): the stop kinds the
// model may choose from, the persisted shape, and the timeline math both the
// builder and the plan page use, so a swapped pick re-times the whole night
// the same way everywhere.
import { z } from "zod";
import { haversineMiles, milesToDriveMinutes } from "./location";
import type { PlanCategory } from "./types";

type StopKindDef = {
  label: string;
  emoji: string;
  /** Geoapify Places `categories` value searched for this stop. */
  categories: string;
  /** The plan category a plan anchored on this stop gets. */
  planCategory: PlanCategory;
  /** Typical stay, used when the model gives no usable duration. */
  minutes: number;
};

export const STOP_KINDS = {
  restaurant: {
    label: "Dinner",
    emoji: "🍜",
    categories: "catering.restaurant",
    planCategory: "dinner",
    minutes: 75,
  },
  fast_food: {
    label: "Quick bite",
    emoji: "🍔",
    categories: "catering.fast_food",
    planCategory: "dinner",
    minutes: 40,
  },
  cafe: {
    label: "Coffee",
    emoji: "☕",
    categories: "catering.cafe.coffee_shop,catering.cafe",
    planCategory: "dinner",
    minutes: 45,
  },
  boba: {
    label: "Boba",
    emoji: "🧋",
    categories: "catering.cafe.bubble_tea",
    planCategory: "dinner",
    minutes: 30,
  },
  dessert: {
    label: "Dessert",
    emoji: "🍦",
    categories: "catering.ice_cream,catering.cafe.dessert",
    planCategory: "dinner",
    minutes: 35,
  },
  bowling: {
    label: "Bowling",
    emoji: "🎳",
    categories: "entertainment.bowling_alley",
    planCategory: "hangout",
    minutes: 90,
  },
  cinema: {
    label: "Movie",
    emoji: "🎬",
    categories: "entertainment.cinema",
    planCategory: "movie",
    minutes: 140,
  },
  arcade: {
    label: "Arcade",
    emoji: "🕹️",
    categories: "entertainment.amusement_arcade",
    planCategory: "hangout",
    minutes: 75,
  },
  mini_golf: {
    label: "Mini golf",
    emoji: "⛳",
    categories: "entertainment.miniature_golf",
    planCategory: "hangout",
    minutes: 60,
  },
  escape_room: {
    label: "Escape room",
    emoji: "🔐",
    categories: "entertainment.escape_game",
    planCategory: "hangout",
    minutes: 75,
  },
  trampoline: {
    label: "Trampoline park",
    emoji: "🤸",
    categories: "entertainment.activity_park.trampoline,entertainment.activity_park",
    planCategory: "sports",
    minutes: 90,
  },
  ice_skating: {
    label: "Ice skating",
    emoji: "⛸️",
    categories: "sport.ice_rink",
    planCategory: "sports",
    minutes: 75,
  },
  sports: {
    label: "Sports",
    emoji: "🏀",
    categories: "sport.sports_centre",
    planCategory: "sports",
    minutes: 90,
  },
  museum: {
    label: "Museum",
    emoji: "🏛️",
    categories: "entertainment.museum",
    planCategory: "daytrip",
    minutes: 120,
  },
  theater: {
    label: "Show",
    emoji: "🎭",
    categories: "entertainment.culture.theatre,entertainment.culture",
    planCategory: "concert",
    minutes: 150,
  },
  theme_park: {
    label: "Theme park",
    emoji: "🎢",
    categories: "entertainment.theme_park,entertainment.water_park",
    planCategory: "daytrip",
    minutes: 300,
  },
  park: {
    label: "Park",
    emoji: "🌳",
    categories: "leisure.park",
    planCategory: "hangout",
    minutes: 60,
  },
  lake: {
    label: "Lake",
    emoji: "🏞️",
    categories: "natural.water,beach,leisure.park",
    planCategory: "daytrip",
    minutes: 150,
  },
  mall: {
    label: "Shopping",
    emoji: "🛍️",
    categories: "commercial.shopping_mall",
    planCategory: "shopping",
    minutes: 90,
  },
} as const satisfies Record<string, StopKindDef>;

export type StopKind = keyof typeof STOP_KINDS;
export const STOP_KIND_IDS = Object.keys(STOP_KINDS) as [StopKind, ...StopKind[]];

export const MAX_STOPS = 4;

/** A real venue found for a stop. Public place data only, never anyone's home. */
export const itineraryVenueSchema = z
  .object({
    key: z.string().max(200),
    title: z.string().max(120),
    address: z.string().max(240).nullable(),
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
    costMin: z.number().min(0).max(10_000),
    costMax: z.number().min(0).max(10_000),
    rating: z.number().min(0).max(5).nullable(),
    openHours: z.string().max(500).nullable().optional(),
    dietaryFriendly: z.array(z.string().max(40)).max(20).optional(),
  })
  .refine((v) => v.costMin <= v.costMax, "The minimum cost cannot exceed the maximum");
export type ItineraryVenue = z.infer<typeof itineraryVenueSchema>;

export const itineraryStopSchema = z.object({
  id: z.string().max(40),
  kind: z.enum(STOP_KIND_IDS),
  label: z.string().max(40),
  /** One short line on why this stop fits the night. */
  why: z.string().max(160),
  minutes: z.number().int().min(15).max(600),
  options: z.array(itineraryVenueSchema).max(3),
  /** Index into `options` of the current pick. */
  pick: z.number().int().min(0).max(2),
});
export type ItineraryStop = z.infer<typeof itineraryStopSchema>;

export const itinerarySchema = z
  .object({
    version: z.literal(1),
    title: z.string().max(80),
    vibe: z.string().max(200),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((value) => {
        const date = new Date(`${value}T12:00:00Z`);
        return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
      }, "Choose a real calendar date")
      .nullable(),
    /** Wall-clock "HH:MM" start of the first stop. */
    start: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
    budgetPerPerson: z.number().min(0).max(10_000).nullable(),
    areaLabel: z.string().max(120).nullable(),
    zip: z.string().max(10).nullable(),
    /** The stop the group votes on through the normal private-answer flow. */
    anchor: z
      .number()
      .int()
      .min(0)
      .max(MAX_STOPS - 1),
    stops: z.array(itineraryStopSchema).min(1).max(MAX_STOPS),
    invite: z.string().max(280),
    weather: z
      .object({ emoji: z.string().max(8), line: z.string().max(120), outdoorRisk: z.boolean() })
      .nullable(),
  })
  .refine((it) => it.anchor < it.stops.length, "Choose a stop in the itinerary")
  .refine((it) => timeline(it).totalMinutes < 1440, "Keep the outing under 24 hours");
export type Itinerary = z.infer<typeof itinerarySchema>;

/** What the AI drafts before any venue is looked up. */
export type ItineraryDraft = Omit<Itinerary, "stops" | "weather" | "areaLabel" | "zip"> & {
  stops: Omit<ItineraryStop, "options" | "pick">[];
  /** Place the model read from the request (ZIP or city), if any. */
  area: string | null;
  searchRadiusMiles: number | null;
  aiGenerated?: boolean;
  rescoutStopIds?: string[];
};

export type TimedStop = ItineraryStop & {
  start: string;
  end: string;
  /** Drive from the previous stop's pick, null for the first stop. */
  driveMinutes: number | null;
  driveMiles: number | null;
};

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
export const toClock = (mins: number) => {
  const m = ((Math.round(mins) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/** "19:30" -> "7:30 PM". */
export function to12h(t: string): string {
  const h = Number(t.slice(0, 2));
  const m = t.slice(3, 5);
  return `${h % 12 || 12}:${m} ${h < 12 ? "AM" : "PM"}`;
}

export const pickOf = (stop: Pick<ItineraryStop, "options" | "pick">) =>
  stop.options[stop.pick] ?? stop.options[0] ?? null;

/**
 * Lays the stops end to end from `start`: each one lasts its `minutes`, and
 * the drive between two picks is the same estimate the venue engine uses.
 */
export function timeline(it: { start: string; stops: ItineraryStop[] }): {
  stops: TimedStop[];
  end: string;
  totalMinutes: number;
} {
  let clock = toMin(it.start);
  const startedAt = clock;
  let prev: ItineraryVenue | null = null;
  const stops = it.stops.map((stop) => {
    const here = pickOf(stop);
    let driveMinutes: number | null = null;
    let driveMiles: number | null = null;
    if (prev && here) {
      driveMiles = Math.round(haversineMiles(prev, here) * 10) / 10;
      driveMinutes = driveMiles < 0.3 ? 2 : milesToDriveMinutes(driveMiles);
      clock += driveMinutes;
    }
    const start = toClock(clock);
    clock += stop.minutes;
    prev = here ?? prev;
    return { ...stop, start, end: toClock(clock), driveMinutes, driveMiles };
  });
  return { stops, end: toClock(clock), totalMinutes: clock - startedAt };
}

/** Per-person cost range across every stop's current pick. */
export function costRange(it: { stops: ItineraryStop[] }): { min: number; max: number } {
  return it.stops.reduce(
    (sum, stop) => {
      const v = pickOf(stop);
      return v ? { min: sum.min + v.costMin, max: sum.max + v.costMax } : sum;
    },
    { min: 0, max: 0 },
  );
}

/** Parses a stored itinerary, or null for plans made before itineraries existed. */
export function readItinerary(raw: unknown): Itinerary | null {
  const parsed = itinerarySchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
