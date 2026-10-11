import { STOP_KINDS, type Itinerary, type ItineraryVenue, type StopKind } from "./itinerary";
import type { OptionSeed } from "./types";

type VenueLookup = (kind: StopKind, venue: ItineraryVenue) => Promise<OptionSeed[]>;

/** Browser-supplied venue metadata is a draft, never authoritative scoring data. */
export async function verifyItineraryVenues(
  it: Itinerary,
  lookup: VenueLookup,
): Promise<Itinerary> {
  const stops = await Promise.all(
    it.stops.map(async (stop) => ({
      ...stop,
      options: await Promise.all(
        stop.options.map(async (venue) => {
          const matches = await lookup(stop.kind, venue);
          const source = matches.find((candidate) => candidate.key === venue.key);
          if (!source || source.lat == null || source.lon == null) {
            throw new Error("A venue could not be verified. Refresh the draft before launching.");
          }
          return {
            key: source.key.slice(0, 200),
            title: source.title.slice(0, 120),
            address: source.address?.slice(0, 240) ?? null,
            lat: source.lat,
            lon: source.lon,
            costMin: source.costMin,
            costMax: source.costMax,
            rating: source.rating ?? null,
            openHours: source.openHours ?? null,
            dietaryFriendly: source.dietaryFriendly,
          };
        }),
      ),
    })),
  );
  return { ...it, stops };
}

export async function verifyLiveItinerary(it: Itinerary): Promise<Itinerary> {
  const { searchVenuesGeoapify } = await import("./places.server");
  return verifyItineraryVenues(it, (kind, venue) =>
    searchVenuesGeoapify({
      origin: { lat: venue.lat, lon: venue.lon, label: "Venue", zip: it.zip ?? "" },
      category: STOP_KINDS[kind].planCategory,
      categoriesOverride: STOP_KINDS[kind].categories,
      maxRadiusMiles: 0.25,
      limit: 14,
    }),
  );
}
