/**
 * Browser-safe shapes and helpers for "Find My Friends" location sharing.
 *
 * Sharing is always owner-controlled: a row in `location_shares` means the
 * owner lets one viewer see their live pin, either for an hour, until the end
 * of the day, or indefinitely. Ghost Mode pauses friend visibility only —
 * linked guardians keep their safety radar so curfew and safe-zone alerts
 * never go dark.
 */

import { zonedDateKey, zonedToInstant } from "./plan-time";

export type ShareMode = "hour" | "end_of_day" | "indefinite";

export type GhostChoice = "hour" | "tomorrow" | "until_reenabled" | "resume";

/** Friend visibility applies to pins and automatic chat cards alike. */
export function canViewFriendLocation(
  profile: {
    location_sharing_enabled: boolean;
    location_pause_indefinite: boolean;
    location_paused_until: string | null;
  },
  share: { expires_at: string | null; hidden?: boolean | null },
  nowMs = Date.now(),
): boolean {
  return (
    profile.location_sharing_enabled &&
    !profile.location_pause_indefinite &&
    !(profile.location_paused_until && Date.parse(profile.location_paused_until) > nowMs) &&
    !share.hidden &&
    (share.expires_at == null || Date.parse(share.expires_at) > nowMs)
  );
}

export const SHARE_OPTIONS: {
  mode: ShareMode;
  label: string;
  emoji: string;
  detail: string;
}[] = [
  {
    mode: "hour",
    label: "Share for 1 Hour",
    emoji: "⏱️",
    detail: "Auto-stops 60 minutes from now",
  },
  {
    mode: "end_of_day",
    label: "Share Until End of Day",
    emoji: "🌙",
    detail: "Auto-stops tonight at 11:59 PM",
  },
  {
    mode: "indefinite",
    label: "Share Indefinitely",
    emoji: "♾️",
    detail: "Stays on until you turn it off",
  },
];

export const GHOST_OPTIONS: { choice: GhostChoice; label: string; detail: string }[] = [
  { choice: "hour", label: "Pause for 1 Hour", detail: "Friends see you again in 60 minutes" },
  { choice: "tomorrow", label: "Pause Until Tomorrow", detail: "Resumes at 6:00 AM" },
  {
    choice: "until_reenabled",
    label: "Turn Off Until I Re-enable",
    detail: "Stays hidden until you switch it back on",
  },
];

/** Expiration instant for a duration choice; null means indefinite. */
export function expiryFor(mode: ShareMode, now = new Date(), timeZone?: string): string | null {
  if (mode === "indefinite") return null;
  if (mode === "hour") return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  if (timeZone) {
    return new Date(
      Date.parse(zonedToInstant(nextZonedDay(now, timeZone), "00:00", timeZone)) - 1,
    ).toISOString();
  }
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return end.toISOString();
}

/** Instant Ghost Mode lifts; null means "until I re-enable" or "resume now". */
export function ghostUntilFor(
  choice: GhostChoice,
  now = new Date(),
  timeZone?: string,
): string | null {
  if (choice === "hour") return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  if (choice === "tomorrow") {
    if (timeZone) return zonedToInstant(nextZonedDay(now, timeZone), "06:00", timeZone);
    const t = new Date(now);
    t.setDate(t.getDate() + 1);
    t.setHours(6, 0, 0, 0);
    return t.toISOString();
  }
  return null;
}

function nextZonedDay(now: Date, timeZone: string): string {
  const date = new Date(`${zonedDateKey(now.toISOString(), timeZone)}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export type SharePeer = {
  profileId: string;
  name: string;
  emoji: string;
  avatarUrl: string | null;
  /** My outgoing share to them, if any. */
  sharingWithThem: { mode: ShareMode; expiresAt: string | null } | null;
  /** Their outgoing share to me — the mutual half. */
  sharingWithMe: { mode: ShareMode; expiresAt: string | null } | null;
};

export type FriendPin = SharePeer & {
  lat: number;
  lon: number;
  batteryPct: number | null;
  motion: string | null;
  statusEmoji: string;
  lastSeen: string;
  address: string | null;
  distanceMiles: number | null;
  driveMinutes: number | null;
  atHome: boolean;
};

export type SharingState = {
  ghost: { active: boolean; until: string | null; indefinite: boolean };
  sharingWith: number;
  streaming: boolean;
};

/** Human label for the remaining lifetime of a share. */
export function shareCountdown(expiresAt: string | null): string {
  if (!expiresAt) return "Indefinitely ♾️";
  const mins = Math.round((new Date(expiresAt).getTime() - Date.now()) / 60000);
  if (mins <= 0) return "Expired";
  if (mins < 60) return `${mins}m left`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs}h left` : `${Math.round(hrs / 24)}d left`;
}

export function motionEmoji(motion: string | null | undefined, atHome: boolean): string {
  if (atHome) return "🏠";
  const m = (motion ?? "").toLowerCase();
  if (/driv|car|mph|road/.test(m)) return "🚗";
  if (/walk|mov/.test(m)) return "🚶";
  return "📍";
}

export function motionLabel(motion: string | null | undefined, atHome: boolean): string {
  if (atHome) return "At Home";
  const m = (motion ?? "").toLowerCase();
  if (/driv|car|mph|road/.test(m)) return "Driving";
  if (/walk/.test(m)) return "Walking";
  return motion?.trim() || "Stationary";
}

/** Native maps deep link — Apple Maps on iOS/macOS, Google Maps elsewhere. */
export function directionsUrl(lat: number, lon: number, label?: string | null): string {
  const isApple =
    typeof navigator !== "undefined" && /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
  const q = encodeURIComponent(label ?? "Destination");
  return isApple
    ? `https://maps.apple.com/?daddr=${lat},${lon}&q=${q}`
    : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
}
