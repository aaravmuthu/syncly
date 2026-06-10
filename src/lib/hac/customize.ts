import type { Course, CourseCustom, BellRotation } from "./types";

/** Color gradient presets students can assign to a class block. */
export const GRADIENT_PRESETS: { id: string; label: string; css: string; from: string }[] = [
  { id: "violet", label: "Violet", css: "linear-gradient(135deg,#8b5cf6,#6366f1)", from: "#8b5cf6" },
  { id: "ocean", label: "Ocean", css: "linear-gradient(135deg,#0ea5e9,#2563eb)", from: "#0ea5e9" },
  { id: "emerald", label: "Emerald", css: "linear-gradient(135deg,#10b981,#059669)", from: "#10b981" },
  { id: "sunset", label: "Sunset", css: "linear-gradient(135deg,#f97316,#ef4444)", from: "#f97316" },
  { id: "rose", label: "Rose", css: "linear-gradient(135deg,#f43f5e,#ec4899)", from: "#f43f5e" },
  { id: "gold", label: "Gold", css: "linear-gradient(135deg,#f59e0b,#eab308)", from: "#f59e0b" },
  { id: "cyan", label: "Cyan", css: "linear-gradient(135deg,#06b6d4,#14b8a6)", from: "#06b6d4" },
  { id: "slate", label: "Slate", css: "linear-gradient(135deg,#64748b,#475569)", from: "#64748b" },
];

export const EMOJI_CHOICES = [
  "📝", "📚", "🧪", "🔬", "🧮", "📐", "🌍", "🏛️", "🎨", "🎭",
  "🎵", "💻", "⚙️", "🧬", "📖", "✍️", "🗣️", "💪", "⚖️", "🧠",
  "🏃", "🍎", "🌐", "📊", "🔢", "🪐", "⚛️", "📜",
];

export function gradientCss(id: string | null | undefined): string | null {
  if (!id) return null;
  return GRADIENT_PRESETS.find((g) => g.id === id)?.css ?? null;
}

export function gradientFrom(id: string | null | undefined): string | null {
  if (!id) return null;
  return GRADIENT_PRESETS.find((g) => g.id === id)?.from ?? null;
}

/** Resolved display info for a course, blending its raw data with overrides. */
export interface CourseDisplay {
  name: string;
  emoji: string | null;
  gradient: string | null; // css
  from: string | null; // base color
}

export function courseDisplay(course: Course, custom?: CourseCustom): CourseDisplay {
  const alias = custom?.alias?.trim();
  return {
    name: alias && alias.length ? alias : course.name,
    emoji: custom?.emoji ?? null,
    gradient: gradientCss(custom?.gradient),
    from: gradientFrom(custom?.gradient),
  };
}

/** A sensible default A/B-day rotation students can start from. */
export function defaultBellRotation(): BellRotation {
  const blocks = (prefix: string) => [
    { id: `${prefix}-1`, label: "1st Period", start: "08:25", end: "09:55", room: "A101" },
    { id: `${prefix}-2`, label: "2nd Period", start: "10:00", end: "11:30", room: "B204" },
    { id: `${prefix}-lunch`, label: "Lunch", start: "11:30", end: "12:15", room: "Cafeteria" },
    { id: `${prefix}-3`, label: "3rd Period", start: "12:20", end: "13:50", room: "C312" },
    { id: `${prefix}-4`, label: "4th Period", start: "13:55", end: "15:25", room: "D118" },
  ];
  return {
    enabled: false,
    dayTypes: ["A Day", "B Day"],
    periods: { "A Day": blocks("a"), "B Day": blocks("b") },
    weekMap: { 1: "A Day", 2: "B Day", 3: "A Day", 4: "B Day", 5: "A Day" },
  };
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The day-type scheduled for a given date, or null. */
export function dayTypeFor(rot: BellRotation, date: Date): string | null {
  const wd = date.getDay();
  const t = rot.weekMap[wd];
  return t && rot.periods[t] ? t : null;
}

export function weekdayLabel(i: number): string {
  return WEEKDAYS[i] ?? "";
}
