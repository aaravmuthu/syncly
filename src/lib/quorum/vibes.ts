// Client-safe food/activity "vibe" filters. Each vibe maps to a concrete set of
// Geoapify Places categories used when discovering venues for a plan.

export type Vibe = {
  id: string;
  label: string;
  emoji: string;
  /** Geoapify `categories` value for this vibe. */
  categories: string;
  kind: "food" | "activity";
};

export const VIBES: Vibe[] = [
  {
    id: "burgers-wings",
    label: "Burgers & Wings",
    emoji: "🍔",
    categories: "catering.restaurant.burger,catering.fast_food.burger,catering.restaurant.american",
    kind: "food",
  },
  {
    id: "pizza",
    label: "Pizza",
    emoji: "🍕",
    categories: "catering.restaurant.pizza,catering.fast_food.pizza,catering.restaurant.italian",
    kind: "food",
  },
  {
    id: "casual-dining",
    label: "Casual Dining",
    emoji: "🍽️",
    categories: "catering.restaurant",
    kind: "food",
  },
  {
    id: "boba-cafes",
    label: "Boba & Cafes",
    emoji: "🧋",
    categories: "catering.cafe,catering.cafe.bubble_tea,catering.cafe.coffee_shop,catering.ice_cream",
    kind: "food",
  },
  {
    id: "late-night",
    label: "Late Night",
    emoji: "🌙",
    categories: "catering.fast_food,catering.restaurant,catering.cafe",
    kind: "food",
  },
  {
    id: "activities",
    label: "Activities & Fun",
    emoji: "🎳",
    categories: "entertainment,leisure.park,sport.sports_centre,entertainment.bowling_alley",
    kind: "activity",
  },
  {
    id: "outdoors",
    label: "Outdoors",
    emoji: "🌳",
    categories: "leisure.park,natural,tourism.attraction",
    kind: "activity",
  },
];

export function vibeById(id: string | null | undefined): Vibe | null {
  if (!id) return null;
  return VIBES.find((v) => v.id === id) ?? null;
}

/** Radius options offered when creating a plan. */
export const RADIUS_OPTIONS = [5, 10, 15, 25] as const;

/** Maps link for a venue — opens Google Maps with coordinates + name. */
export function directionsUrl(v: {
  lat?: number | null;
  lon?: number | null;
  address?: string | null;
  title?: string | null;
}): string {
  const named = [v.title, v.address].filter(Boolean).join(" ").trim();
  if (named) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(named)}`;
  }
  if (v.lat != null && v.lon != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${v.lat},${v.lon}`)}`;
  }
  return "https://www.google.com/maps";
}
