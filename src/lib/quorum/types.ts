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
}[] = [
  {
    id: "dinner",
    label: "Dinner / Food",
    emoji: "🍜",
    blurb: "Restaurants, late bites, dessert runs",
    questionnaire: "dinner",
  },
  {
    id: "hangout",
    label: "Casual Hangout",
    emoji: "🛋️",
    blurb: "Low-key, low-cost, easy to say yes to",
    questionnaire: "general",
  },
  {
    id: "concert",
    label: "Concert / Event",
    emoji: "🎟️",
    blurb: "Tickets, venues, late returns",
    questionnaire: "event",
  },
  {
    id: "trip",
    label: "Vacation / Trip",
    emoji: "🏝️",
    blurb: "Multi-day, budgets, travel time",
    questionnaire: "trip",
  },
  { id: "party", label: "Party", emoji: "🎉", blurb: "Hosting and headcounts", questionnaire: "general" },
  { id: "movie", label: "Movie", emoji: "🎬", blurb: "Showtimes and seats", questionnaire: "general" },
  { id: "shopping", label: "Shopping", emoji: "🛍️", blurb: "Malls, thrifting, outlets", questionnaire: "general" },
  {
    id: "sports",
    label: "Sports / Recreation",
    emoji: "🏓",
    blurb: "Courts, ranges, climbing, bowling",
    questionnaire: "general",
  },
  { id: "daytrip", label: "Day Trip", emoji: "🚗", blurb: "Out and back in a day", questionnaire: "trip" },
  { id: "roadtrip", label: "Road Trip", emoji: "🛣️", blurb: "Longer drives, split costs", questionnaire: "trip" },
  { id: "custom", label: "Custom", emoji: "✨", blurb: "Anything else", questionnaire: "general" },
];

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
  travelMinutes: number;
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
  reasons: string[];
  cautions: string[];
  fair?: {
    avgMinutes: number;
    spreadMinutes: number;
    midpointLabel?: string | null;
    drives: { name: string; miles: number; minutes: number }[];
    curfewOk: boolean;
    curfewNote?: string | null;
  };
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
