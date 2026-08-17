// Client-safe venue imagery + preview stats.
// Geoapify gives us no photos or ratings, so we map the venue's cuisine /
// category to a curated Unsplash hero image and derive a stable preview
// rating from the venue key (same venue always shows the same numbers).

const U = (id: string, w = 1200) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=70`;

type PhotoRule = { match: RegExp; url: string; label: string };

const RULES: PhotoRule[] = [
  { match: /pizza|pizzeria/, url: U("photo-1513104890138-7c749659a591"), label: "Pizza" },
  { match: /burger|wing|american|bbq|barbecue|grill|steak/, url: U("photo-1568901346375-23c9450c58cd"), label: "Burgers & wings" },
  { match: /mexican|taco|taqueria|tex-?mex|burrito/, url: U("photo-1613514785940-daed07799d9b"), label: "Mexican" },
  { match: /boba|bubble|tea|smoothie|juice/, url: U("photo-1558857563-b371033873b8"), label: "Boba & tea" },
  { match: /coffee|cafe|café|espresso|bakery|donut/, url: U("photo-1495474472287-4d71bcdd2085"), label: "Coffee" },
  { match: /italian|pasta|trattoria/, url: U("photo-1551183053-bf91a1d81141"), label: "Italian" },
  { match: /sushi|japanese|poke/, url: U("photo-1579871494447-9811cf80d66c"), label: "Sushi" },
  { match: /asian|chinese|thai|ramen|noodle|korean|viet|pho|indian|curry/, url: U("photo-1569718212165-3a8278d5f624"), label: "Asian" },
  { match: /ice_?cream|dessert|frozen|yogurt|sweet|creamery/, url: U("photo-1497034825429-c343d7c6a68f"), label: "Dessert" },
  { match: /bowl/, url: U("photo-1538481199705-c710c4e965fc"), label: "Bowling" },
  { match: /arcade|game|entertainment|escape|karaoke/, url: U("photo-1571902943202-507ec2618e8f"), label: "Arcade" },
  { match: /cinema|movie|theat/, url: U("photo-1517649763962-0c623066013b"), label: "Movies" },
  { match: /park|garden|trail|nature|natural|lake/, url: U("photo-1441974231531-c6227db76b6e"), label: "Parks" },
  { match: /golf|pickle|tennis|sport|gym|fitness|climb|skate/, url: U("photo-1552566626-52f8b828add9"), label: "Sports" },
  { match: /mountain|outdoor|hike|attraction|tourism/, url: U("photo-1467003909585-2f8a72700288"), label: "Outdoors" },
  { match: /fast_?food|diner|restaurant|catering|food/, url: U("photo-1414235077428-338989a2e8c0"), label: "Restaurant" },
];

const DEFAULT_FOOD = U("photo-1504674900247-0877df9cc836");
const DEFAULT_ACTIVITY = U("photo-1571902943202-507ec2618e8f");

/** Hero image for a venue, chosen from its cuisine/category/name. */
export function venuePhoto(v: {
  title?: string | null;
  cuisine?: string | null;
  subtitle?: string | null;
  category?: string | null;
  kind?: "food" | "activity" | string | null;
}): string {
  const hay = [v.cuisine, v.category, v.subtitle, v.title]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const hit = RULES.find((r) => r.match.test(hay));
  if (hit) return hit.url;
  return v.kind === "activity" ? DEFAULT_ACTIVITY : DEFAULT_FOOD;
}

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export type VenueStats = { rating: number; reviewCount: number; ratingLabel: string };

/** Stable, venue-specific preview rating shown before details load. */
export function venueStats(key: string): VenueStats {
  const h = hash(key || "venue");
  const rating = Math.round((4.1 + (h % 9) / 10) * 10) / 10; // 4.1 – 4.9
  const reviewCount = 60 + (h % 18) * 30; // 60 – 570
  const rounded = Math.floor(reviewCount / 10) * 10;
  return { rating, reviewCount, ratingLabel: `★ ${rating.toFixed(1)} (${rounded}+ reviews)` };
}

/** Google Maps search link that lands on the venue's reviews. */
export function googleReviewsUrl(name: string, address?: string | null): string {
  const q = encodeURIComponent([name, address].filter(Boolean).join(" "));
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}
