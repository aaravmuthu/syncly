// Server-only location providers.
//
// Geocoding / autocomplete: Mapbox (MAPBOX_TOKEN) with an automatic keyless
// OpenStreetMap fallback. Venue discovery: Geoapify (GEOAPIFY_KEY) with a
// fallback to the seeded catalog layer. Every call fails soft — a missing key,
// a network error or a bad response returns null/[] instead of throwing.

import { milesToDriveMinutes, haversineMiles, priceLevelFor, type ZipLocation } from "./location";
import { mergeMapPois, poiLabel } from "./map-poi";
import type { OptionSeed, PlanCategory } from "./types";

export type PlaceSuggestion = {
  id: string;
  label: string; // "6390 Main St, Frisco, TX 75034"
  zip: string | null;
  city: string | null;
  state: string | null;
  lat: number;
  lon: number;
};

export type SuggestOptions = {
  /** Prefer full residential street addresses over ZIP/city results. */
  addressOnly?: boolean;
  /** Bias results near these coordinates (user's saved home, else Texas). */
  proximity?: { lat: number; lon: number } | null;
};

const mapboxToken = () => process.env["MAPBOX_TOKEN"] ?? "";
const geoapifyKey = () => process.env["GEOAPIFY_KEY"] ?? "";

/** Fallback proximity bias: Frisco, TX. */
const DEFAULT_PROXIMITY = { lat: 33.1507, lon: -96.8236 };

/** Public map token for the browser (Mapbox GL). Empty string = maps disabled. */
export function publicMapToken(): string {
  const t = mapboxToken();
  return t.startsWith("pk.") ? t : "";
}

// ---------------------------------------------------------------- autocomplete

/** Drops results whose label repeats one already seen (case/space-insensitive). */
function dedupeByLabel(results: PlaceSuggestion[]): PlaceSuggestion[] {
  const seen = new Set<string>();
  return results.filter((r) => {
    const key = r.label.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function suggestPlacesServer(
  queryRaw: string,
  opts: SuggestOptions = {},
): Promise<PlaceSuggestion[]> {
  const query = (queryRaw ?? "").trim();
  if (query.length < 3) return [];

  const prox = opts.proximity ?? DEFAULT_PROXIMITY;
  // Address mode must ask Mapbox for street addresses only — including
  // "place"/"postcode" here returns extra city/ZIP features alongside the
  // real address (e.g. querying "...Frisco, TX 75034" also matches a
  // postcode feature for "Frisco, TX 75034"), which rendered as redundant,
  // ZIP-only dropdown rows.
  const types = opts.addressOnly ? "address" : "postcode,place,locality,neighborhood,address";

  const token = mapboxToken();
  if (token) {
    try {
      const url =
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
        `?access_token=${encodeURIComponent(token)}&country=us&limit=6&autocomplete=true` +
        `&proximity=${prox.lon},${prox.lat}` +
        `&types=${encodeURIComponent(types)}`;
      const res = await fetch(url);
      if (res.ok) {
        const json = (await res.json()) as {
          features?: {
            id: string;
            place_name: string;
            text: string;
            address?: string;
            center: [number, number];
            context?: { id: string; text: string; short_code?: string }[];
          }[];
        };
        const out = (json.features ?? []).map((f) => {
          const ctx = f.context ?? [];
          const pick = (prefix: string) => ctx.find((c) => c.id.startsWith(prefix));
          const postcode = f.id.startsWith("postcode") ? f.text : pick("postcode")?.text;
          const cityCtx = pick("place")?.text ?? (f.id.startsWith("place") ? f.text : null);
          const region = pick("region");
          const state = region?.short_code?.replace(/^US-/, "") ?? region?.text ?? null;
          return {
            id: f.id,
            label: f.place_name.replace(/, United States$/, ""),
            zip: postcode && /^\d{5}$/.test(postcode) ? postcode : null,
            city: cityCtx ?? null,
            state,
            lat: f.center[1],
            lon: f.center[0],
          } satisfies PlaceSuggestion;
        });
        // Address-mode: surface exact street matches first.
        if (out.length) {
          const ordered = opts.addressOnly
            ? [...out].sort(
                (a, b) => Number(b.id.startsWith("address")) - Number(a.id.startsWith("address")),
              )
            : out;
          return dedupeByLabel(ordered);
        }
      }
    } catch {
      /* fall through to OSM */
    }
  }

  // Keyless fallback
  try {
    const url =
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}` +
      `&countrycodes=us&format=json&limit=6&addressdetails=1` +
      `&viewbox=${prox.lon - 1.5},${prox.lat + 1.5},${prox.lon + 1.5},${prox.lat - 1.5}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Syncly group planner (https://syncly.website)",
        Accept: "application/json",
      },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      place_id: number;
      display_name: string;
      lat: string;
      lon: string;
      address?: {
        postcode?: string;
        city?: string;
        town?: string;
        village?: string;
        state?: string;
      };
    }[];
    return dedupeByLabel(
      json.map((r) => ({
        id: String(r.place_id),
        label: r.display_name.replace(/, United States$/, ""),
        zip: r.address?.postcode && /^\d{5}$/.test(r.address.postcode) ? r.address.postcode : null,
        city: r.address?.city ?? r.address?.town ?? r.address?.village ?? null,
        state: r.address?.state ?? null,
        lat: Number(r.lat),
        lon: Number(r.lon),
      })),
    );
  } catch {
    return [];
  }
}

// ------------------------------------------------------------------ map search

export type MapSearchResult = {
  id: string;
  name: string;
  /** Street address or locality line shown under the name. */
  detail: string;
  category: string | null;
  lat: number;
  lon: number;
};

type SearchBoxFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    mapbox_id?: string;
    name?: string;
    full_address?: string;
    address?: string;
    place_formatted?: string;
    poi_category?: string[];
  };
};

/** "7135 Preston Road, Frisco, Texas 75034, United States" -> "7135 Preston Road, Frisco, TX". */
function shortAddress(f: SearchBoxFeature["properties"]): string {
  const line = f.address ?? "";
  const place = (f.place_formatted ?? "").replace(/, United States$/, "");
  // Keep "City, State"; drop the ZIP and country.
  const cityState = place
    .split(", ")
    .slice(0, 2)
    .map((part) => part.replace(/\s+\d{5}(-\d{4})?$/, ""))
    .join(", ");
  return [line, cityState].filter(Boolean).join(", ");
}

const fromSearchBox = (f: SearchBoxFeature, i: number): MapSearchResult => ({
  id: f.properties.mapbox_id ?? `sb-${i}`,
  name: f.properties.name ?? "Place",
  detail: shortAddress(f.properties) || f.properties.full_address || "",
  category: f.properties.poi_category?.length ? poiLabel(f.properties.poi_category) : null,
  lat: f.geometry.coordinates[1],
  lon: f.geometry.coordinates[0],
});

export const MAP_NEARBY_CATEGORIES = ["restaurant", "coffee", "park", "entertainment", "shopping"];

/**
 * Venue-first search for the map: businesses and landmarks first (Mapbox Search
 * Box, which ranks by distance to `proximity`), then neighbourhoods and
 * addresses from the geocoder for things like "Legacy West". With `category`
 * set it lists what's around `proximity` instead of matching a name.
 */
export async function searchMapPlacesServer(
  opts: {
    query?: string;
    category?: string;
    proximity?: { lat: number; lon: number } | null;
    limit?: number;
  } = {},
): Promise<MapSearchResult[]> {
  const token = mapboxToken();
  const query = (opts.query ?? "").trim();
  const category =
    opts.category && MAP_NEARBY_CATEGORIES.includes(opts.category) ? opts.category : "";
  if (!token || (!category && query.length < 2)) return [];
  const prox = opts.proximity ?? DEFAULT_PROXIMITY;
  const limit = Math.min(10, Math.max(1, opts.limit ?? 8));
  const common =
    `access_token=${encodeURIComponent(token)}&country=us&language=en&limit=${limit}` +
    `&proximity=${prox.lon},${prox.lat}`;

  const searchBox = async (): Promise<MapSearchResult[]> => {
    const url = category
      ? `https://api.mapbox.com/search/searchbox/v1/category/${category}?${common}`
      : `https://api.mapbox.com/search/searchbox/v1/forward?q=${encodeURIComponent(query)}&${common}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = (await res.json()) as { features?: SearchBoxFeature[] };
    return (json.features ?? []).map(fromSearchBox);
  };

  const places = async (): Promise<MapSearchResult[]> => {
    if (category) return [];
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
      `?${common}&autocomplete=true&types=${encodeURIComponent("neighborhood,locality,place,address")}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = (await res.json()) as {
      features?: { id: string; text: string; place_name: string; center: [number, number] }[];
    };
    return (json.features ?? []).map((f) => ({
      id: f.id,
      name: f.text,
      detail: f.place_name
        .replace(/, United States$/, "")
        .split(", ")
        .slice(1)
        .join(", "),
      category: null,
      lat: f.center[1],
      lon: f.center[0],
    }));
  };

  const [a, b] = await Promise.all([searchBox().catch(() => []), places().catch(() => [])]);
  return mergeMapPois([...a, ...b], limit);
}

// -------------------------------------------------------------- venue search

const GEOAPIFY_CATEGORIES: Record<PlanCategory, string> = {
  dinner:
    "catering.restaurant,catering.fast_food,catering.cafe,catering.restaurant.pizza,catering.fast_food.burger",
  hangout: "catering.cafe,entertainment,leisure.park,leisure",
  concert: "entertainment.culture,adult.nightclub",
  trip: "tourism.attraction,tourism.sights,natural",
  party: "entertainment,catering.bar,entertainment.bowling_alley",
  movie: "entertainment.cinema",
  shopping:
    "commercial.shopping_mall,commercial.marketplace,commercial.supermarket,commercial.clothing",
  sports: "sport.sports_centre,sport.fitness,leisure.playground,sport.stadium",
  daytrip: "tourism.attraction,leisure.park,natural",
  roadtrip: "tourism.attraction,tourism.sights",
  custom: "entertainment,catering.restaurant,leisure.park",
};

const OUTDOOR_HINTS = ["park", "natural", "playground", "beach", "garden", "trail"];

type GeoapifyFeature = {
  properties: {
    place_id?: string;
    name?: string;
    address_line1?: string;
    address_line2?: string;
    formatted?: string;
    city?: string;
    state_code?: string;
    categories?: string[];
    lat: number;
    lon: number;
    distance?: number; // meters
    datasource?: { raw?: Record<string, unknown> };
  };
};

/** Rough cost band derived from the place's categories + OSM price hints. */
function costBand(
  categories: string[],
  raw: Record<string, unknown> | undefined,
): [number, number] {
  const c = categories.join(" ");
  if (c.includes("fast_food")) return [9, 16];
  if (c.includes("cafe")) return [8, 18];
  if (c.includes("cinema")) return [12, 22];
  if (c.includes("nightclub") || c.includes("culture")) return [25, 65];
  if (c.includes("bowling") || c.includes("sports_centre")) return [15, 30];
  if (c.includes("park") || c.includes("natural") || c.includes("attraction")) return [0, 12];
  if (c.includes("shopping")) return [10, 45];
  if (c.includes("bar")) return [18, 40];
  if (c.includes("restaurant")) {
    const price = String(raw?.["price_range"] ?? raw?.["price"] ?? "");
    if (price.includes("$$$")) return [45, 85];
    if (price.includes("$$")) return [20, 40];
    return [16, 34];
  }
  return [12, 30];
}

function dietaryFrom(raw: Record<string, unknown> | undefined, categories: string[]): string[] {
  const out = new Set<string>();
  const c = categories.join(" ");
  const supported = (key: string) =>
    ["yes", "only", "designated"].includes(String(raw?.[key] ?? "").toLowerCase());
  if (supported("diet:vegetarian") || c.includes("vegetarian")) out.add("vegetarian");
  if (supported("diet:vegan") || c.includes("vegan")) out.add("vegan");
  if (supported("diet:halal") || c.includes("halal")) out.add("halal");
  if (supported("diet:gluten_free") || c.includes("gluten_free")) out.add("gluten-free");
  if (!c.includes("catering")) {
    // Non-food venues never block a dietary constraint.
    ["vegetarian", "vegan", "halal", "gluten-free", "nut-free"].forEach((d) => out.add(d));
  }
  return [...out];
}

/** Human cuisine / activity label from the provider's category list. */
function cuisineFrom(
  categories: string[],
  raw: Record<string, unknown> | undefined,
): string | undefined {
  const rawCuisine = String(raw?.["cuisine"] ?? "")
    .split(";")[0]
    ?.trim();
  const pretty = (s: string) =>
    s
      .replace(/_/g, " ")
      .replace(/\b\w/g, (m) => m.toUpperCase())
      .trim();
  if (rawCuisine) return pretty(rawCuisine);
  const leaf = categories
    .filter((c) => c.split(".").length > 2)
    .map((c) => c.split(".").pop()!)
    .find(Boolean);
  if (leaf) return pretty(leaf);
  const top = categories[0]?.split(".")[1];
  return top ? pretty(top) : undefined;
}

const kindFor = (categories: string[]): "food" | "activity" =>
  categories.join(" ").includes("catering") ? "food" : "activity";

export type VenueSearch = {
  origin: ZipLocation;
  category: PlanCategory;
  maxRadiusMiles?: number | null;
  maxBudget?: number | null;
  limit?: number;
  /** Optional food/activity vibe id — overrides the category defaults. */
  vibe?: string | null;
  /** Explicit Geoapify category list — overrides both vibe and category. */
  categoriesOverride?: string | null;
  /** Free-text name filter ("chipotle"). */
  name?: string | null;
};

/**
 * Real nearby venues from Geoapify Places, mapped into the engine's OptionSeed
 * shape so the compatibility engine can score them unchanged.
 */
export async function searchVenuesGeoapify(q: VenueSearch): Promise<OptionSeed[]> {
  const key = geoapifyKey();
  if (!key) return [];

  const radiusMiles = Math.min(Math.max(q.maxRadiusMiles ?? 15, 2), 60);
  const radiusMeters = Math.round(radiusMiles * 1609.34);
  const { vibeById } = await import("./vibes");
  const categories =
    q.categoriesOverride ??
    vibeById(q.vibe)?.categories ??
    GEOAPIFY_CATEGORIES[q.category] ??
    GEOAPIFY_CATEGORIES.custom;
  const name = (q.name ?? "").trim();

  try {
    const build = (cats: string) =>
      `https://api.geoapify.com/v2/places?categories=${encodeURIComponent(cats)}` +
      `&filter=circle:${q.origin.lon},${q.origin.lat},${radiusMeters}` +
      `&bias=proximity:${q.origin.lon},${q.origin.lat}` +
      (name ? `&name=${encodeURIComponent(name)}` : "") +
      `&limit=40&apiKey=${encodeURIComponent(key)}`;
    let res = await fetch(build(categories), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok && categories !== GEOAPIFY_CATEGORIES.custom) {
      // An unsupported category list must not blank the picker — retry broad.
      res = await fetch(build(GEOAPIFY_CATEGORIES.custom), {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
    }
    if (!res.ok) {
      console.error(`Geoapify places failed [${res.status}]: ${await res.text()}`);
      return [];
    }
    const json = (await res.json()) as { features?: GeoapifyFeature[] };
    const city = q.origin.label.split(",")[0]?.trim() || "Nearby";

    const seeds = (json.features ?? [])
      .filter(
        (f) =>
          f.properties.name &&
          Number.isFinite(f.properties.lat) &&
          Number.isFinite(f.properties.lon),
      )
      .map((f) => {
        const p = f.properties;
        const cats = p.categories ?? [];
        const point = { lat: p.lat, lon: p.lon };
        const distanceMiles =
          Math.round(
            (p.distance != null ? p.distance / 1609.34 : haversineMiles(q.origin, point)) * 10,
          ) / 10;
        const [costMin, costMax] = costBand(cats, p.datasource?.raw);
        const outdoor = OUTDOOR_HINTS.some((h) => cats.join(" ").includes(h));
        const seed: OptionSeed = {
          key: p.place_id ?? `${p.name}-${p.lat},${p.lon}`,
          title: p.name!,
          subtitle: p.address_line2 ?? p.formatted ?? `${distanceMiles} mi from the group`,
          category: [q.category],
          costMin,
          costMax,
          travelMinutes: milesToDriveMinutes(distanceMiles),
          start: q.category === "dinner" ? "18:30" : "18:00",
          end: q.category === "dinner" ? "20:30" : "21:00",
          location: `${p.city ?? city} · ${distanceMiles} mi`,
          tags: [poiLabel(cats), outdoor ? "outdoor" : "indoor"],
          dietaryFriendly: dietaryFrom(p.datasource?.raw, cats),
          style: outdoor ? "outdoor" : cats.join(" ").includes("catering") ? "sit-down" : "venue",
          requiresDriving: distanceMiles > 1.2,
          lat: p.lat,
          lon: p.lon,
          distanceMiles,
          address: p.address_line2 ?? p.formatted ?? undefined,
          priceLevel: priceLevelFor(costMax),
          ...(cuisineFrom(cats, p.datasource?.raw)
            ? { cuisine: cuisineFrom(cats, p.datasource?.raw)! }
            : {}),
          kind: kindFor(cats),
          ...(typeof p.datasource?.raw?.["opening_hours"] === "string"
            ? { openHours: p.datasource.raw["opening_hours"] as string }
            : {}),
        };
        return seed;
      });

    const filtered = seeds.filter((v) => {
      if (q.maxRadiusMiles != null && (v.distanceMiles ?? 0) > q.maxRadiusMiles) return false;
      if (q.maxBudget != null && v.costMin > q.maxBudget) return false;
      return true;
    });

    return (filtered.length ? filtered : seeds)
      .sort((a, b) => (a.distanceMiles ?? 0) - (b.distanceMiles ?? 0))
      .slice(0, q.limit ?? 14);
  } catch (err) {
    console.error("Geoapify places error", err);
    return [];
  }
}

/** Reverse-geocode coordinates to a US ZIP (Mapbox, OSM fallback). */
export async function reverseZipServer(lat: number, lon: number): Promise<string | null> {
  const token = mapboxToken();
  if (token) {
    try {
      const url =
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lon},${lat}.json` +
        `?access_token=${encodeURIComponent(token)}&types=postcode&limit=1`;
      const res = await fetch(url);
      if (res.ok) {
        const json = (await res.json()) as { features?: { text: string }[] };
        const zip = json.features?.[0]?.text;
        if (zip && /^\d{5}$/.test(zip)) return zip;
      }
    } catch {
      /* fall through */
    }
  }
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=18&addressdetails=1`,
      {
        headers: {
          "User-Agent": "Syncly group planner (https://syncly.website)",
          Accept: "application/json",
        },
      },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { address?: { postcode?: string } };
    const zip = json.address?.postcode;
    return zip && /^\d{5}$/.test(zip) ? zip : null;
  } catch {
    return null;
  }
}

// Viewport browsing deliberately uses the existing Geoapify provider, not Search Box.
const viewportCache = new Map<string, { expires: number; places: import("./map-poi").MapPoi[] }>();
const viewportPending = new Map<string, Promise<import("./map-poi").MapPoi[]>>();
export async function nearbyMapPlacesServer(q: {
  bounds: import("./map-poi").PoiBounds;
  zoom: number;
  category?: import("./map-poi").PoiCategory;
}): Promise<import("./map-poi").MapPoi[]> {
  const { POI_CATEGORIES, mergeMapPois, poiLabel, poiLimit } = await import("./map-poi");
  if (!geoapifyKey()) throw new Error("Nearby places are unavailable.");
  const { west, south, east, north } = q.bounds;
  if (west >= east || south >= north || east - west > 8 || north - south > 8 || q.zoom < 10)
    return [];
  const bucket = q.zoom < 12 ? 10 : q.zoom < 14 ? 12 : 14;
  const cacheKey = JSON.stringify([west, south, east, north, bucket, q.category]);
  const cached = viewportCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.places;
  const pending = viewportPending.get(cacheKey);
  if (pending) return pending;
  const request = (async () => {
    const groups = q.category
      ? [POI_CATEGORIES[q.category]]
      : bucket === 10
        ? [POI_CATEGORIES.sights, `${POI_CATEGORIES.parks},${POI_CATEGORIES.hotels}`]
        : [
            `${POI_CATEGORIES.food},${POI_CATEGORIES.coffee},${POI_CATEGORIES.dessert}`,
            `${POI_CATEGORIES.shops},${POI_CATEGORIES.gas},${POI_CATEGORIES.hotels}`,
            `${POI_CATEGORIES.parks},${POI_CATEGORIES.schools},${POI_CATEGORIES.fitness},${POI_CATEGORIES.fun},${POI_CATEGORIES.sights}`,
          ];
    const center = { lat: (south + north) / 2, lon: (west + east) / 2 };
    const batches = await Promise.all(
      groups.map(async (categories) => {
        const params = new URLSearchParams({
          categories,
          filter: `rect:${west},${south},${east},${north}`,
          bias: `proximity:${center.lon},${center.lat}`,
          limit: String(q.category ? 180 : 80),
          apiKey: geoapifyKey(),
        });
        const res = await fetch(`https://api.geoapify.com/v2/places?${params}`, {
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) throw new Error("Nearby places could not be loaded.");
        const json = (await res.json()) as { features?: GeoapifyFeature[] };
        return (json.features ?? []).flatMap((f) => {
          const p = f.properties;
          const raw = p.datasource?.raw;
          if (
            !p.name?.trim() ||
            raw?.["disused"] === "yes" ||
            raw?.["abandoned"] === "yes" ||
            raw?.["shop"] === "vacant"
          )
            return [];
          const cats = p.categories ?? [];
          const important = cats.some((c) =>
            /tourism|shopping_mall|park|university|museum|hotel/.test(c),
          );
          return [
            {
              id: p.place_id ?? `geo-${p.lon}-${p.lat}-${p.name}`,
              name: p.name,
              detail:
                [p.address_line1 !== p.name ? p.address_line1 : "", p.address_line2]
                  .filter(Boolean)
                  .join(", ") ||
                p.formatted ||
                "",
              category: poiLabel(cats),
              lat: p.lat,
              lon: p.lon,
              importance: (important ? 6 : 0) + Math.max(0, 2 - haversineMiles(center, p) / 3),
              ...(typeof raw?.["website"] === "string" ? { website: raw["website"] } : {}),
              ...(typeof raw?.["opening_hours"] === "string"
                ? { openingHours: raw["opening_hours"] }
                : {}),
            },
          ];
        });
      }),
    );
    const places = mergeMapPois(batches.flat(), poiLimit(q.zoom));
    // Failed responses never enter the cache. Busy shops refresh sooner than wide-area landmarks.
    for (const [key, value] of viewportCache)
      if (value.expires <= Date.now()) viewportCache.delete(key);
    if (viewportCache.size >= 150) viewportCache.delete(viewportCache.keys().next().value!);
    viewportCache.set(cacheKey, {
      places,
      expires: Date.now() + (bucket === 10 ? 600000 : 300000),
    });
    return places;
  })();
  viewportPending.set(cacheKey, request);
  try {
    return await request;
  } finally {
    viewportPending.delete(cacheKey);
  }
}
