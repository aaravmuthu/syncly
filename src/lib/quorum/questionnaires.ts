import type { ConstraintPayload } from "./types";

export type Field =
  | { kind: "money"; key: keyof ConstraintPayload; label: string; hint?: string; hard?: boolean }
  | { kind: "number"; key: keyof ConstraintPayload; label: string; hint?: string; suffix?: string; hard?: boolean }
  | { kind: "time"; key: keyof ConstraintPayload; label: string; hint?: string; hard?: boolean }
  | { kind: "toggle"; key: keyof ConstraintPayload; label: string; hint?: string }
  | {
      kind: "chips";
      key: keyof ConstraintPayload;
      label: string;
      hint?: string;
      options: string[];
      hard?: boolean;
    }
  | { kind: "text"; key: keyof ConstraintPayload; label: string; hint?: string };

export type Step = { id: string; title: string; caption: string; fields: Field[] };

const CUISINES = [
  "italian",
  "mexican",
  "asian",
  "japanese",
  "korean",
  "bbq",
  "pizza",
  "dessert",
  "cafe",
  "noodles",
];

const DIETARY = ["vegetarian", "vegan", "halal", "kosher", "gluten-free", "nut-free", "dairy-free"];

const dinner: Step[] = [
  {
    id: "money",
    title: "What's comfortable to spend?",
    caption: "Nobody sees this number. It only filters options out.",
    fields: [
      { kind: "money", key: "maxSpend", label: "Most I'd spend", hint: "Per person, all-in", hard: true },
      {
        kind: "chips",
        key: "venueStyle",
        label: "What kind of place works",
        options: ["fast food", "casual", "sit-down", "dessert", "cafe"],
      },
    ],
  },
  {
    id: "food",
    title: "Food that works for you",
    caption: "Dietary needs are treated as hard requirements — never as a preference.",
    fields: [
      { kind: "chips", key: "dietary", label: "Dietary needs", options: DIETARY, hard: true },
      { kind: "chips", key: "likedTags", label: "Cuisines you like", options: CUISINES },
      { kind: "chips", key: "dislikedTags", label: "Rather avoid", options: CUISINES },
    ],
  },
  {
    id: "logistics",
    title: "Getting there and back",
    caption: "Ride needs stay private. We only publish the finished car plan.",
    fields: [
      { kind: "number", key: "maxTravelMinutes", label: "Furthest I'd travel", suffix: "min", hard: true },
      { kind: "toggle", key: "needsRide", label: "I need a ride" },
      { kind: "toggle", key: "canDrive", label: "I can drive others" },
      { kind: "number", key: "seats", label: "Seats I can offer", suffix: "seats" },
    ],
  },
  {
    id: "time",
    title: "When you're actually free",
    caption: "Curfews and return times are hard limits.",
    fields: [
      { kind: "time", key: "earliestStart", label: "Earliest I can start", hard: true },
      { kind: "time", key: "latestEnd", label: "Latest I can stay out", hard: true },
      { kind: "time", key: "requiredReturnTime", label: "Must be home by", hard: true },
      { kind: "toggle", key: "parentApprovalRequired", label: "I need a parent to approve this" },
      { kind: "text", key: "notes", label: "Anything else" },
    ],
  },
];

const event: Step[] = [
  {
    id: "money",
    title: "Ticket and spending limits",
    caption: "Kept private. Options above your limit simply won't appear as feasible.",
    fields: [
      { kind: "money", key: "maxTicketPrice", label: "Most for a ticket", hard: true },
      { kind: "money", key: "maxSpend", label: "Most for the whole night", hard: true },
      { kind: "chips", key: "likedTags", label: "What you're into", options: ["music", "indie", "pop", "arena", "outdoor", "all-ages"] },
    ],
  },
  {
    id: "logistics",
    title: "Travel and rides",
    caption: "",
    fields: [
      { kind: "number", key: "maxTravelMinutes", label: "Furthest I'd travel", suffix: "min", hard: true },
      { kind: "toggle", key: "needsRide", label: "I need a ride" },
      { kind: "toggle", key: "canDrive", label: "I can drive others" },
      { kind: "number", key: "seats", label: "Seats I can offer", suffix: "seats" },
    ],
  },
  {
    id: "time",
    title: "Timing and permission",
    caption: "",
    fields: [
      { kind: "time", key: "earliestStart", label: "Earliest I can start", hard: true },
      { kind: "time", key: "requiredReturnTime", label: "Must be home by", hard: true },
      { kind: "toggle", key: "parentApprovalRequired", label: "Parent permission required" },
      { kind: "text", key: "notes", label: "Anything else" },
    ],
  },
];

const trip: Step[] = [
  {
    id: "budget",
    title: "Trip budget",
    caption: "Total, not per day. Private to you.",
    fields: [
      { kind: "money", key: "totalBudget", label: "Total I can spend", hard: true },
      { kind: "number", key: "maxDays", label: "Most days I can go", suffix: "days", hard: true },
    ],
  },
  {
    id: "travel",
    title: "How far, and how",
    caption: "",
    fields: [
      { kind: "number", key: "maxTravelMinutes", label: "Max travel time", suffix: "min", hard: true },
      {
        kind: "chips",
        key: "destinationTypes",
        label: "Kinds of places you like",
        options: ["beach", "city", "mountains", "nature", "warm", "walkable"],
      },
      { kind: "chips", key: "dislikedTags", label: "Rather avoid", options: ["hiking", "swimming", "museums", "long drives", "camping"] },
    ],
  },
  {
    id: "needs",
    title: "Food and rules",
    caption: "",
    fields: [
      { kind: "chips", key: "dietary", label: "Dietary needs", options: DIETARY, hard: true },
      { kind: "toggle", key: "parentApprovalRequired", label: "Parent permission required" },
      { kind: "toggle", key: "needsRide", label: "I need a ride" },
      { kind: "toggle", key: "canDrive", label: "I can drive others" },
      { kind: "number", key: "seats", label: "Seats I can offer", suffix: "seats" },
      { kind: "text", key: "notes", label: "Anything else" },
    ],
  },
];

const general: Step[] = [
  {
    id: "money",
    title: "What's comfortable to spend?",
    caption: "Private. Used only to rule options in or out.",
    fields: [
      { kind: "money", key: "maxSpend", label: "Most I'd spend", hard: true },
      {
        kind: "chips",
        key: "likedTags",
        label: "What sounds good",
        options: ["active", "chill", "games", "outdoor", "indoor", "cheap", "food"],
      },
      { kind: "chips", key: "dislikedTags", label: "Rather avoid", options: ["active", "loud", "outdoor", "long drives", "crowds"] },
    ],
  },
  {
    id: "logistics",
    title: "Getting there",
    caption: "",
    fields: [
      { kind: "number", key: "maxTravelMinutes", label: "Furthest I'd travel", suffix: "min", hard: true },
      { kind: "toggle", key: "needsRide", label: "I need a ride" },
      { kind: "toggle", key: "canDrive", label: "I can drive others" },
      { kind: "number", key: "seats", label: "Seats I can offer", suffix: "seats" },
    ],
  },
  {
    id: "time",
    title: "Timing",
    caption: "",
    fields: [
      { kind: "time", key: "earliestStart", label: "Earliest I can start", hard: true },
      { kind: "time", key: "latestEnd", label: "Latest I can stay out", hard: true },
      { kind: "time", key: "requiredReturnTime", label: "Must be home by", hard: true },
      { kind: "toggle", key: "parentApprovalRequired", label: "Parent permission required" },
      { kind: "text", key: "notes", label: "Anything else" },
    ],
  },
];

export const QUESTIONNAIRES: Record<string, Step[]> = { dinner, event, trip, general };
