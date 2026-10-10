/** Shared provider-neutral place policy. No provider category codes reach the UI. */
export const POI_CATEGORIES = {
  food: "catering.restaurant,catering.fast_food",
  coffee: "catering.cafe",
  dessert: "catering.ice_cream,commercial.food_and_drink.bakery",
  shops: "commercial",
  grocery: "commercial.supermarket,commercial.convenience",
  fitness: "sport.fitness,sport.sports_centre",
  parks: "leisure.park,leisure.garden",
  schools: "education.school,education.university",
  fun: "entertainment",
  gas: "service.vehicle.fuel",
  hotels: "accommodation.hotel",
  sights: "tourism.attraction,tourism.sights,commercial.shopping_mall",
} as const;
export type PoiCategory = keyof typeof POI_CATEGORIES;
export type MapPoi = {
  id: string;
  name: string;
  detail: string;
  category: string | null;
  lat: number;
  lon: number;
  importance?: number;
  website?: string;
  openingHours?: string;
};
export type PoiBounds = { west: number; south: number; east: number; north: number };
export function validPoint(p: { lat: number; lon: number }) {
  return (
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lon) &&
    Math.abs(p.lat) <= 90 &&
    Math.abs(p.lon) <= 180
  );
}
const normalizedName = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
export function samePlace(a: MapPoi, b: MapPoi) {
  if (a.id === b.id) return true;
  const dy = (a.lat - b.lat) * 111320;
  const dx = (a.lon - b.lon) * 111320 * Math.cos((a.lat * Math.PI) / 180);
  return normalizedName(a.name) === normalizedName(b.name) && Math.hypot(dx, dy) < 65;
}
export function mergeMapPois(places: MapPoi[], limit = 180): MapPoi[] {
  const quality = (p: MapPoi) =>
    (p.importance ?? 0) +
    (p.detail ? 2 : 0) +
    (p.category ? 1 : 0) +
    (p.website ? 1 : 0) +
    (p.openingHours ? 1 : 0);
  const out: MapPoi[] = [];
  for (const p of [...places]
    .filter((p) => validPoint(p) && p.name.trim())
    .sort((a, b) => quality(b) - quality(a))) {
    if (!out.some((other) => samePlace(p, other)))
      out.push({ ...p, name: p.name.trim(), detail: p.detail.trim() });
  }
  return out.slice(0, limit);
}
export function poiLabel(categories: string[]): string {
  const rules: [string, string][] = [
    ["ice_cream", "Dessert"],
    ["bakery", "Bakery"],
    ["fast_food", "Fast food"],
    ["cafe", "Coffee"],
    ["restaurant", "Restaurant"],
    ["shopping_mall", "Shopping center"],
    ["supermarket", "Grocery"],
    ["convenience", "Convenience store"],
    ["fuel", "Gas station"],
    ["fitness", "Gym"],
    ["school", "School"],
    ["university", "University"],
    ["hotel", "Hotel"],
    ["park", "Park"],
    ["garden", "Garden"],
    ["cinema", "Cinema"],
    ["museum", "Museum"],
    ["tourism", "Landmark"],
    ["entertainment", "Entertainment"],
    ["sport", "Sports"],
    ["commercial", "Store"],
    ["catering", "Food & drink"],
  ];
  return rules.find(([code]) => categories.some((c) => c.includes(code)))?.[1] ?? "Place";
}
export function poiLimit(zoom: number) {
  return zoom < 12 ? 50 : zoom < 14 ? 100 : 180;
}
