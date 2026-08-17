/** Cover themes used as hero banners on squad cards. */
export type CoverTheme = {
  id: string;
  label: string;
  /** Tailwind gradient classes for the banner. */
  banner: string;
  /** Accent ring/text tint. */
  accent: string;
};

export const COVER_THEMES: CoverTheme[] = [
  {
    id: "obsidian_emerald",
    label: "Obsidian Emerald",
    banner: "bg-[linear-gradient(120deg,#04120d_0%,#0a3b2c_55%,#10b981_140%)]",
    accent: "text-emerald-300",
  },
  {
    id: "neon_cyber",
    label: "Neon Cyber",
    banner: "bg-[linear-gradient(120deg,#050b1a_0%,#0e2a63_50%,#22d3ee_135%)]",
    accent: "text-cyan-300",
  },
  {
    id: "midnight_purple",
    label: "Midnight Purple",
    banner: "bg-[linear-gradient(120deg,#0b0616_0%,#3b1470_55%,#a855f7_140%)]",
    accent: "text-purple-300",
  },
  {
    id: "sunset_glow",
    label: "Sunset Glow",
    banner: "bg-[linear-gradient(120deg,#1b0a06_0%,#7c2d12_50%,#fb923c_140%)]",
    accent: "text-orange-300",
  },
  {
    id: "rose_dusk",
    label: "Rose Dusk",
    banner: "bg-[linear-gradient(120deg,#150610_0%,#701a45_55%,#fb7185_140%)]",
    accent: "text-rose-300",
  },
  {
    id: "arctic_steel",
    label: "Arctic Steel",
    banner: "bg-[linear-gradient(120deg,#0a0f14_0%,#1f3a4d_55%,#94a3b8_140%)]",
    accent: "text-slate-300",
  },
];

export function coverTheme(id?: string | null): CoverTheme {
  return COVER_THEMES.find((t) => t.id === id) ?? COVER_THEMES[0]!;
}

/** Curated Unsplash presets so groups can pick a picture without uploading. */
export const GROUP_PRESET_IMAGES = [
  "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=320&q=70",
  "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=320&q=70",
  "https://images.unsplash.com/photo-1543007630-9710e4a00a20?auto=format&fit=crop&w=320&q=70",
  "https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=320&q=70",
  "https://images.unsplash.com/photo-1496024840928-4c417adf211d?auto=format&fit=crop&w=320&q=70",
  "https://images.unsplash.com/photo-1523301343968-6a6ebf63c672?auto=format&fit=crop&w=320&q=70",
];

export const GROUP_EMOJI = ["✨", "🍜", "🎬", "🏝️", "🎉", "🏓", "🚗", "🛍️", "🎟️", "🛋️", "🔥", "🏀"];
