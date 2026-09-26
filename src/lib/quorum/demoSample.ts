import { OPTION_CATALOG } from "./catalog";
import { rankOptions, type MemberInput } from "./engine";
import type { ConstraintPayload, PlanCategory } from "./types";

/**
 * The made-up sample group behind /demo and the landing hero's iPad screen.
 * Both run it through the real engine, so what they show is what the app
 * would rank — never a user's data.
 */
export type DemoMember = {
  id: string;
  name: string;
  emoji: string;
  sacrificeLoad: number;
  constraints: ConstraintPayload;
};

export const DEMO_MEMBERS: DemoMember[] = [
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

/** Ranks the catalog for `category` against `members`, best first. */
export function rankDemo(category: PlanCategory, members: DemoMember[]) {
  const pool = OPTION_CATALOG.filter((o) => o.category.includes(category));
  const inputs: MemberInput[] = members.map((m) => ({
    profileId: m.id,
    constraints: m.constraints,
    sacrificeLoad: m.sacrificeLoad,
  }));
  return rankOptions(pool.length ? pool : OPTION_CATALOG, inputs);
}

/** `members` with one person's answers patched. */
export function withAnswers(
  members: DemoMember[],
  id: string,
  patch: Partial<ConstraintPayload>,
): DemoMember[] {
  return members.map((m) =>
    m.id === id ? { ...m, constraints: { ...m.constraints, ...patch } } : m,
  );
}
