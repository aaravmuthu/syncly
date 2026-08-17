// Client-safe category tabs for the in-app "Browse Local Spots" picker.
// Each tab maps to a concrete set of Geoapify Places categories.

export type SpotTab = {
  id: string;
  label: string;
  emoji: string;
  kind: "food" | "activity";
  categories: string;
};

export const FOOD_TABS: SpotTab[] = [
  {
    id: "restaurants",
    label: "Restaurants",
    emoji: "🍽️",
    kind: "food",
    categories: "catering.restaurant",
  },
  {
    id: "pizza",
    label: "Pizza",
    emoji: "🍕",
    kind: "food",
    categories: "catering.restaurant.pizza,catering.fast_food.pizza",
  },
  {
    id: "burgers",
    label: "Burgers",
    emoji: "🍔",
    kind: "food",
    categories: "catering.restaurant.burger,catering.fast_food.burger",
  },
  {
    id: "wings",
    label: "Wings",
    emoji: "🍗",
    kind: "food",
    categories: "catering.restaurant.american,catering.fast_food.chicken",
  },
  {
    id: "boba",
    label: "Boba & Cafes",
    emoji: "🧋",
    kind: "food",
    categories: "catering.cafe,catering.ice_cream",
  },
];

export const ACTIVITY_TABS: SpotTab[] = [
  {
    id: "pickleball",
    label: "Pickleball",
    emoji: "🏓",
    kind: "activity",
    categories: "sport.sports_centre,sport.pitch",
  },
  {
    id: "bowling",
    label: "Bowling",
    emoji: "🎳",
    kind: "activity",
    categories: "entertainment.bowling_alley",
  },
  {
    id: "golf",
    label: "Golf",
    emoji: "⛳",
    kind: "activity",
    categories: "sport.sports_centre,leisure",
  },
  {
    id: "movies",
    label: "Movies",
    emoji: "🎬",
    kind: "activity",
    categories: "entertainment.cinema",
  },
  {
    id: "parks",
    label: "Parks",
    emoji: "🌳",
    kind: "activity",
    categories: "leisure.park,natural",
  },
];

export const SPOT_TABS: SpotTab[] = [...FOOD_TABS, ...ACTIVITY_TABS];

export function spotTabById(id: string | null | undefined): SpotTab | null {
  if (!id) return null;
  return SPOT_TABS.find((t) => t.id === id) ?? null;
}

/** Radius choices offered by the quick slider. */
export const SPOT_RADII = [5, 10, 15, 25] as const;
