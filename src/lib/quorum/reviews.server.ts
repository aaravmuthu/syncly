// Suggestions to verify before an outing. Never manufacture venue evidence.
export type VenueInsight = {
  checks: string[];
  aiGenerated: false;
};
export async function generateVenueInsight(input: {
  name: string;
  address?: string | null;
  cuisine?: string | null;
  kind: string;
  priceLevel?: string | null;
}): Promise<VenueInsight> {
  return {
    aiGenerated: false,
    checks:
      input.kind === "activity"
        ? [
            "Check opening hours for your date.",
            "Confirm admission prices and whether booking is required.",
            "Check age requirements and group capacity.",
          ]
        : [
            "Check opening hours for your date.",
            "Confirm current menu prices and group seating.",
            "Ask the venue directly about dietary needs and allergens.",
          ],
  };
}
