// Shared zod building blocks for server-function input validation.
//
// Every createServerFn in src/lib/quorum validates its input with these at
// runtime, so a hand-crafted request can't smuggle in wrong types, oversized
// strings, non-UUID ids, or javascript:/data: URLs that later get rendered.
import { z } from "zod";
import { isValidTimeZone } from "./plan-time";
export const timeZone = z.string().max(64).refine(isValidTimeZone, "Choose a valid timezone");

/** A database row id. Every table keys on uuid. */
export const id = z.string().uuid();
export const optId = id.nullish();

/** Trimmed plain text capped at `max` characters. */
export const text = (max: number) => z.string().trim().max(max);
export const optText = (max: number) => text(max).nullish();
/** Required text: non-empty after trimming. */
export const reqText = (max: number) => text(max).min(1);

export const lat = z.number().finite().min(-90).max(90);
export const lon = z.number().finite().min(-180).max(180);

/** Dollar amounts, travel radii, seat counts, and similar small non-negative numbers. */
export const amount = (max: number) => z.number().finite().min(0).max(max);
/** Optional amount; a cleared number input arrives as NaN or "", which means "not set". */
export const optAmount = (max: number) =>
  z.preprocess(
    (v) => (v === "" || (typeof v === "number" && Number.isNaN(v)) ? null : v),
    amount(max).nullish(),
  );

/** "HH:MM" or a full ISO timestamp, as the planning UI sends either. */
export const timeish = z
  .string()
  .max(40)
  .regex(
    /^(\d{2}:\d{2}(:\d{2})?|\d{4}-\d{2}-\d{2}([T ][\d:.]+)?(Z|[+-]\d{2}:?\d{2})?)$/,
    "Invalid time",
  );
/** Optional time; a cleared time input sends "", which is kept as-is. */
export const optTimeish = z.union([timeish, z.literal("")]).nullish();

/**
 * URLs we store and later render as <img>/<audio>/links. Only https is
 * allowed, which rules out javascript:, data:, and plaintext http.
 */
export const httpsUrl = z
  .string()
  .max(2048)
  .url()
  .refine((u) => u.startsWith("https://"), "URL must use https");
export const optHttpsUrl = httpsUrl.nullish();

/** A base64 image/audio data URL for uploads; the handlers re-check the MIME type. */
export const dataUrl = z
  .string()
  .max(12 * 1024 * 1024)
  .regex(/^data:[a-z]+\/[a-z0-9.+-]+(;[a-z0-9=-]+)*;base64,/i, "Unsupported upload");

/** Short opaque codes and tokens (invite codes, approval tokens, HMAC sigs). */
export const token = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/, "Invalid code");

export const emoji = z.string().max(16);
export const tags = (maxItems = 30, maxLen = 60) => z.array(text(maxLen)).max(maxItems);

export const planCategory = z.enum([
  "dinner",
  "hangout",
  "concert",
  "trip",
  "party",
  "movie",
  "shopping",
  "sports",
  "daytrip",
  "roadtrip",
  "custom",
]);

export const spotKind = z.enum(["food", "activity"]);

export const conciergeHistory = z
  .array(z.object({ role: z.enum(["user", "assistant"]), content: text(4000) }))
  .max(20);

export const constraintPayload = z.object({
  maxSpend: optAmount(100_000),
  maxTicketPrice: optAmount(100_000),
  totalBudget: optAmount(1_000_000),
  likedTags: tags().optional(),
  dislikedTags: tags().optional(),
  dietary: tags().optional(),
  allergies: tags().optional(),
  venueStyle: tags().optional(),
  maxTravelMinutes: optAmount(24 * 60),
  maxDistanceMiles: optAmount(5_000),
  zipCode: optText(10),
  needsRide: z.boolean().optional(),
  canDrive: z.boolean().optional(),
  seats: z.preprocess(
    (v) => (v === "" || (typeof v === "number" && Number.isNaN(v)) ? null : v),
    amount(50).int().nullish(),
  ),
  earliestStart: optTimeish,
  latestEnd: optTimeish,
  unavailableDates: tags(366, 40).optional(),
  availability: tags(96, 40).optional(),
  requiredReturnTime: optTimeish,
  parentApprovalRequired: z.boolean().optional(),
  parentConditions: tags(20, 200).optional(),
  maxDays: optAmount(365),
  travelMode: z.enum(["drive", "fly", "either"]).nullish(),
  destinationTypes: tags().optional(),
  notes: optText(1000),
  skipped: z.boolean().optional(),
});

export const browseSpot = z.object({
  key: text(300),
  title: text(300),
  subtitle: text(300),
  address: optText(500).transform((v) => v ?? null),
  cuisine: optText(200).transform((v) => v ?? null),
  priceLevel: text(20),
  kind: spotKind,
  costMin: amount(100_000),
  costMax: amount(100_000),
  lat,
  lon,
  miles: amount(50_000),
  minutes: amount(100_000),
  members: z
    .array(
      z.object({
        profileId: id,
        name: text(100),
        miles: amount(50_000),
        minutes: amount(100_000),
      }),
    )
    .max(100),
});

/**
 * DM attachment metadata. Clients only ever send a shared location; anything
 * else is dropped so a crafted message can't stash arbitrary data that a
 * future renderer might trust.
 */
export const messageMeta = z.object({
  lat: lat.optional(),
  lon: lon.optional(),
  label: text(120).optional(),
});

/** Number-ish profile inputs: form fields may send "", a numeric string, or a number. */
const numberish = z.union([z.number().finite(), z.string().max(20)]).nullish();
/** Nullable profile text: "" is accepted and cleared to null by saveProfile. */
const nullableText = (max: number) => z.string().max(max).nullish();

/**
 * Every column saveProfile may write. Unknown keys are stripped, so a crafted
 * request can't touch sync_code, user_id, is_demo or any other column.
 */
export const profilePatch = z.object({
  display_name: text(60).optional(),
  avatar_emoji: emoji.optional(),
  avatar_url: z.union([httpsUrl, z.literal("")]).nullish(),
  bio: nullableText(500),
  school: nullableText(120),
  grad_year: numberish,
  age: numberish,
  home_area: nullableText(120),
  budget_preference: nullableText(40),
  curfew_time: nullableText(40),
  independence_level: nullableText(40),
  needs_transportation: z.boolean().optional(),
  parent_approval_required: z.boolean().optional(),
  preferred_categories: tags(20, 40).optional(),
  personalization_enabled: z.boolean().optional(),
  parent_features_enabled: z.boolean().optional(),
  transport_features_enabled: z.boolean().optional(),
  notifications_enabled: z.boolean().optional(),
  onboarded: z.boolean().optional(),
  zip_code: nullableText(10),
  theme_preference: text(20).optional(),
  home_address: nullableText(300),
  home_lat: numberish,
  home_lon: numberish,
  account_type: z.enum(["teen", "guardian"]).optional(),
  phone: nullableText(30),
  share_contact_with_parents: z.boolean().optional(),
  location_sharing_enabled: z.boolean().optional(),
});
