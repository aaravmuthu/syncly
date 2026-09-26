import { OPTION_CATALOG } from "@/lib/quorum/catalog";
import type { ConstraintPayload } from "@/lib/quorum/types";

/*
 * The sample group shared by /demo and the landing hero's live iPad screen,
 * so both show the same four friends and the same engine results.
 */
export type DemoMember = {
  id: string;
  name: string;
  emoji: string;
  sacrificeLoad: number;
  constraints: ConstraintPayload;
};

export const DEMO_GROUP: DemoMember[] = [
  {
    id: "m1",
    name: "Maya",
    emoji: "🌿",
    sacrificeLoad: 0.6,
    constraints: {
      maxSpend: 20,
      dietary: ["vegetarian"],
      likedTags: ["cozy", "indoor"],
      maxTravelMinutes: 20,
      needsRide: true,
      latestEnd: "21:30",
      parentApprovalRequired: true,
    },
  },
  {
    id: "m2",
    name: "Dev",
    emoji: "🎧",
    sacrificeLoad: 0.1,
    constraints: {
      maxSpend: 45,
      likedTags: ["games", "active"],
      maxTravelMinutes: 35,
      canDrive: true,
      seats: 3,
      latestEnd: "23:00",
    },
  },
  {
    id: "m3",
    name: "Sofia",
    emoji: "📚",
    sacrificeLoad: 0.3,
    constraints: {
      maxSpend: 30,
      dietary: ["gluten-free"],
      likedTags: ["group", "indoor"],
      dislikedTags: ["late-night"],
      maxTravelMinutes: 25,
      needsRide: true,
      latestEnd: "22:00",
    },
  },
  {
    id: "m4",
    name: "Theo",
    emoji: "🏀",
    sacrificeLoad: 0.2,
    constraints: {
      maxSpend: 25,
      likedTags: ["active", "outdoor"],
      maxTravelMinutes: 30,
      canDrive: true,
      seats: 4,
      latestEnd: "22:30",
    },
  },
];

// The category picker used to live here. With this sample group only
// Hangout and Food had a single feasible option -- the other four chips led
// straight to "nothing works" -- so the demo commits to one Friday hangout
// and spends its attention on the thing that is actually new: private
// answers reshaping the shortlist.
export const DEMO_POOL = OPTION_CATALOG.filter((o) => o.category.includes("hangout"));
