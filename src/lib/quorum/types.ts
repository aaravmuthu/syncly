export type PlanCategory =
  | "dinner"
  | "hangout"
  | "concert"
  | "trip"
  | "party"
  | "movie"
  | "shopping"
  | "sports"
  | "daytrip"
  | "roadtrip"
  | "custom";

export const CATEGORIES: {
  id: PlanCategory;
  label: string;
  emoji: string;
  blurb: string;
  questionnaire: "dinner" | "event" | "trip" | "general";
  /** Shown as its own choice in category pickers. Non-top-level ids are
   *  legacy/tag-level values — still valid data, but folded into a broader
   *  category's picker instead of standing alone (see PlanWizard's vibe row). */
  topLevel?: boolean;
}[] = [
  {
    id: "dinner",
    label: "Food & Drinks",
    emoji: "🍜",
    blurb: "Restaurants, boba, late bites, dessert runs",
    questionnaire: "dinner",
    topLevel: true,
  },
  {
    id: "hangout",
    label: "Hangout",
    emoji: "🛋️",
    blurb: "Movies, bowling, arcades — low-key and easy to say yes to",
    questionnaire: "general",
    topLevel: true,
  },
  {
    id: "concert",
    label: "Concert / Event",
    emoji: "🎟️",
    blurb: "Tickets, venues, late returns",
    questionnaire: "event",
    topLevel: true,
  },
  {
    id: "trip",
    label: "Trip / Getaway",
    emoji: "🏝️",
    blurb: "Day trips, road trips, multi-day travel",
    questionnaire: "trip",
    topLevel: true,
  },
  {
    id: "party",
    label: "Party",
    emoji: "🎉",
    blurb: "Hosting and headcounts",
    questionnaire: "general",
    topLevel: true,
  },
  {
    id: "movie",
    label: "Movie",
    emoji: "🎬",
    blurb: "Showtimes and seats",
    questionnaire: "general",
  },
  {
    id: "shopping",
    label: "Shopping",
    emoji: "🛍️",
    blurb: "Malls, thrifting, outlets",
    questionnaire: "general",
  },
  {
    id: "sports",
    label: "Sports & Rec",
    emoji: "🏓",
    blurb: "Courts, ranges, climbing, bowling",
    questionnaire: "general",
    topLevel: true,
  },
  {
    id: "daytrip",
    label: "Day Trip",
    emoji: "🚗",
    blurb: "Out and back in a day",
    questionnaire: "trip",
  },
  {
    id: "roadtrip",
    label: "Road Trip",
    emoji: "🛣️",
    blurb: "Longer drives, split costs",
    questionnaire: "trip",
  },
  {
    id: "custom",
    label: "Custom",
    emoji: "✨",
    blurb: "Anything else",
    questionnaire: "general",
    topLevel: true,
  },
];

/** The general, non-overlapping choices offered in category pickers. Movie,
 *  Shopping, Day Trip and Road Trip stay valid stored values (existing plans
 *  still render correctly via categoryMeta) but no longer compete as peers
 *  of the broader buckets they're actually part of. */
export const TOP_LEVEL_CATEGORIES = CATEGORIES.filter((c) => c.topLevel);

export function categoryMeta(id: string) {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1]!;
}

/**
 * PRIVATE per-person answers. Never leaves the server in raw form once other
 * members are involved — only aggregate compatibility is shared.
 */
export type ConstraintPayload = {
  // money
  maxSpend?: number | null;
  maxTicketPrice?: number | null;
  totalBudget?: number | null;
  // taste
  likedTags?: string[];
  dislikedTags?: string[];
  dietary?: string[];
  allergies?: string[];
  venueStyle?: string[]; // fast food / casual / sit-down / dessert / cafe
  // logistics
  maxTravelMinutes?: number | null;
  maxDistanceMiles?: number | null;
  zipCode?: string | null;
  needsRide?: boolean;
  canDrive?: boolean;
  seats?: number | null;
  earliestStart?: string | null; // "18:00"
  latestEnd?: string | null; // "22:30"
  unavailableDates?: string[];
  /** Hour slots this member is free, e.g. ["18:00","19:00"]. Aggregated only. */
  availability?: string[];
  requiredReturnTime?: string | null;
  parentApprovalRequired?: boolean;
  parentConditions?: string[];
  // trips
  maxDays?: number | null;
  travelMode?: "drive" | "fly" | "either" | null;
  destinationTypes?: string[];
  // free text
  notes?: string | null;
  skipped?: boolean;
};

export type OptionSeed = {
  key: string;
  title: string;
  subtitle: string;
  category: PlanCategory[];
  costMin: number;
  costMax: number;
  /** Complete outings use the upper estimate for their all-in budget check. */
  costForBudget?: number;
  travelMinutes: number;
  durationMinutes?: number;
  start: string;
  end: string;
  location: string;
  tags: string[];
  dietaryFriendly: string[]; // vegetarian, vegan, halal, gluten-free, nut-free...
  style: string; // casual / sit-down / fast food / venue / outdoor ...
  requiresDriving: boolean;
  seatsNeeded?: boolean;
  // live location metadata (filled by the ZIP-anchored venue layer)
  lat?: number;
  lon?: number;
  distanceMiles?: number;
  address?: string;
  priceLevel?: "$" | "$$" | "$$$" | "$$$$";
  rating?: number;
  /** "Pizza", "Coffee", "Bowling" … derived from the provider's categories. */
  cuisine?: string;
  /** Drives the map pin icon. */
  kind?: "food" | "activity";
  /** Raw OSM-style opening hours when the provider supplies them. */
  openHours?: string;
};

export type ScoreBreakdown = {
  hardFailures: number; // count of members blocked (never named)
  budgetFit: number;
  scheduleFit: number;
  travelFit: number;
  preferenceFit: number;
  dietaryFit: number;
  transportFit: number;
  fairness: number;
  /** Whether this option actually involves anyone driving. Drives whether a
   *  per-car travel cost line or "Rides" plan should be shown at all — for
   *  walkable options this is false and no car cost should ever appear. */
  requiresDriving: boolean;
  /**
   * The actual number behind the headline score's largest input (62% weight):
   * a blend of the group's average preference satisfaction and its worst-off
   * member's, 0-100. Distinct from `preferenceFit` (average only) — this is
   * what "Overall Match" is mostly made of, and the UI should show this
   * number rather than implying budget/schedule/travel drive the headline.
   */
  overallFit: number;
  reasons: string[];
  cautions: string[];
  /** Assigned when the option makes the strict top-3 shortlist. */
  optionLabel?: { key: "A" | "B" | "C"; emoji: string; title: string };
  fair?: {
    avgMinutes: number;
    spreadMinutes: number;
    midpointLabel?: string | null;
    drives: { name: string; miles: number; minutes: number }[];
    curfewOk: boolean;
    curfewNote?: string | null;
  };
  itinerary?: import("./itinerary").Itinerary;
  itineraryDurationMinutes?: number;
  /** Public candidate facts retained for a fresh server-side check at lock-in. */
  optionSeed?: OptionSeed;
  venue?: {
    address?: string;
    distanceMiles?: number;
    priceLevel?: string;
    rating?: number;
    cuisine?: string;
    kind?: "food" | "activity";
    lat?: number;
    lon?: number;
  };
};
