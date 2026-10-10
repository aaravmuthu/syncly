import { afterEach, describe, expect, it, vi } from "vitest";
import { mergeMapPois, poiLabel, poiLimit, samePlace, type MapPoi } from "../lib/quorum/map-poi";
import { nearbyMapPlacesServer } from "../lib/quorum/places.server";
const cafe: MapPoi = {
  id: "a",
  name: "Café Uno",
  detail: "",
  category: "Coffee",
  lat: 33,
  lon: -96,
};
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe("map place normalization", () => {
  it("merges close cross-provider duplicates and prefers complete metadata", () => {
    const better = {
      ...cafe,
      id: "b",
      name: "Cafe Uno",
      detail: "12 Main St",
      website: "https://example.com",
    };
    expect(mergeMapPois([cafe, better])).toEqual([better]);
    expect(samePlace(cafe, better)).toBe(true);
  });
  it("preserves separate branches and different places at the same coordinate", () => {
    expect(
      mergeMapPois([cafe, { ...cafe, id: "b", lat: 33.01 }, { ...cafe, id: "c", name: "Bakery" }]),
    ).toHaveLength(3);
  });
  it("does not collapse distinct names in non-Latin scripts", () => {
    expect(
      mergeMapPois([
        { ...cafe, name: "咖啡", id: "one" },
        { ...cafe, name: "茶店", id: "two" },
      ]),
    ).toHaveLength(2);
  });
  it("rejects invalid coordinates and blank names", () => {
    expect(
      mergeMapPois([
        cafe,
        { ...cafe, id: "b", lat: NaN },
        { ...cafe, id: "c", lon: 181 },
        { ...cafe, id: "d", name: " " },
      ]),
    ).toEqual([cafe]);
  });
  it("translates provider categories and reveals more places at close zoom", () => {
    expect(poiLabel(["catering", "catering.fast_food"])).toBe("Fast food");
    expect(poiLabel(["commercial", "commercial.shopping_mall"])).toBe("Shopping center");
    expect(poiLabel(["unknown.internal_code"])).toBe("Place");
    expect(poiLimit(11)).toBeLessThan(poiLimit(13));
    expect(poiLimit(13)).toBeLessThan(poiLimit(16));
  });
});
const bounds = { west: -96.1, south: 32.9, east: -95.9, north: 33.1 };
const feature = (name: string, id: string, extra = {}) => ({
  properties: {
    place_id: id,
    name,
    lat: 33,
    lon: -96,
    categories: ["catering.cafe"],
    address_line1: "12 Main St",
    ...extra,
  },
});
describe("Geoapify viewport browsing", () => {
  it("uses bounds, varied categories, coalesces concurrent requests and expires cached data", async () => {
    vi.stubEnv("GEOAPIFY_KEY", "test-key");
    let now = 100000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const fetcher = vi.fn(
      async (_input: string | URL | Request) =>
        new Response(
          JSON.stringify({
            features: [
              feature("Cafe", "one"),
              feature("Closed", "two", { datasource: { raw: { disused: "yes" } } }),
            ],
          }),
        ),
    );
    vi.stubGlobal("fetch", fetcher);
    const q = { bounds, zoom: 15 };
    const [a, b] = await Promise.all([nearbyMapPlacesServer(q), nearbyMapPlacesServer(q)]);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(a).toEqual(b);
    expect(a).toHaveLength(1);
    expect(a[0]?.category).toBe("Coffee");
    const url = String(fetcher.mock.calls[0]?.[0]);
    expect(decodeURIComponent(url)).toContain("filter=rect:");
    await nearbyMapPlacesServer(q);
    expect(fetcher).toHaveBeenCalledTimes(3);
    now += 300001;
    await nearbyMapPlacesServer(q);
    expect(fetcher).toHaveBeenCalledTimes(6);
  });
  it("does not cache failed provider responses", async () => {
    vi.stubEnv("GEOAPIFY_KEY", "test-key");
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 429 }))
      .mockResolvedValue(new Response(JSON.stringify({ features: [feature("Park", "park")] })));
    vi.stubGlobal("fetch", fetcher);
    const q = { bounds: { ...bounds, west: -96.2 }, zoom: 15, category: "parks" as const };
    await expect(nearbyMapPlacesServer(q)).rejects.toThrow();
    expect(await nearbyMapPlacesServer(q)).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("does not request world-scale or reversed viewports", async () => {
    vi.stubEnv("GEOAPIFY_KEY", "test-key");
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    expect(await nearbyMapPlacesServer({ bounds, zoom: 5 })).toEqual([]);
    expect(
      await nearbyMapPlacesServer({ bounds: { ...bounds, west: bounds.east }, zoom: 15 }),
    ).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
