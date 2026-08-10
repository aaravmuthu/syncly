/** Student profile & avatar customization (device-local personalization). */

export type AvatarPresetId =
  | "orb"
  | "neon-rings"
  | "pulse-grid"
  | "aurora"
  | "comet"
  | "prism";

export type AuraId = "none" | "neon-blue" | "magenta-pulse" | "fire-ring" | "emerald-drift" | "violet-halo";

export interface AuraPreset {
  id: AuraId;
  label: string;
  color: string;
  /** Secondary color for the rotating conic ring. */
  color2: string;
}

export const AURA_PRESETS: AuraPreset[] = [
  { id: "none", label: "None", color: "transparent", color2: "transparent" },
  { id: "neon-blue", label: "Neon Blue Glow", color: "#38bdf8", color2: "#6366f1" },
  { id: "magenta-pulse", label: "Cyberpunk Magenta", color: "#ec4899", color2: "#a855f7" },
  { id: "fire-ring", label: "Fire Gradient Ring", color: "#f97316", color2: "#facc15" },
  { id: "emerald-drift", label: "Emerald Drift", color: "#10b981", color2: "#22d3ee" },
  { id: "violet-halo", label: "Violet Halo", color: "#8b5cf6", color2: "#22d3ee" },
];

export interface AvatarPreset {
  id: AvatarPresetId;
  label: string;
  colors: [string, string];
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: "orb", label: "Gradient Orb", colors: ["#8b5cf6", "#22d3ee"] },
  { id: "neon-rings", label: "Neon Rings", colors: ["#38bdf8", "#6366f1"] },
  { id: "pulse-grid", label: "Pulse Grid", colors: ["#22c55e", "#0ea5e9"] },
  { id: "aurora", label: "Aurora Wave", colors: ["#f472b6", "#818cf8"] },
  { id: "comet", label: "Comet Trail", colors: ["#fb923c", "#f43f5e"] },
  { id: "prism", label: "Prism Shift", colors: ["#facc15", "#14b8a6"] },
];

export interface StudentProfile {
  displayName: string;
  schoolName: string;
  gradYear: string;
  badgeId: string;
  /** Preset avatar id, used when no custom image is uploaded. */
  avatarPreset: AvatarPresetId;
  /** Data-URL of an uploaded PNG / JPG / GIF / APNG. */
  avatarImage: string | null;
  aura: AuraId;
}

export function emptyProfile(): StudentProfile {
  return {
    displayName: "",
    schoolName: "",
    gradYear: "",
    badgeId: "",
    avatarPreset: "orb",
    avatarImage: null,
    aura: "neon-blue",
  };
}

export function auraFor(id: AuraId): AuraPreset {
  return AURA_PRESETS.find((a) => a.id === id) ?? AURA_PRESETS[0];
}

export function avatarFor(id: AvatarPresetId): AvatarPreset {
  return AVATAR_PRESETS.find((a) => a.id === id) ?? AVATAR_PRESETS[0];
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "★";
}
