/** Browser-safe shapes for the Friend Profile Sheet and nickname overrides. */

import type { ShareMode } from "./sharing";

export type MutualCircle = { id: string; name: string; emoji: string };

export type SharedPlan = {
  id: string;
  title: string;
  category: string;
  status: string;
  when: string | null;
  where: string | null;
};

export type FriendTelemetry = {
  lat: number;
  lon: number;
  batteryPct: number | null;
  motion: string;
  statusEmoji: string;
  atHome: boolean;
  address: string | null;
  lastSeen: string;
  distanceMiles: number | null;
  driveMinutes: number | null;
};

export type ShareLink = { mode: ShareMode; expiresAt: string | null; hidden: boolean };

export type FriendProfile = {
  profileId: string;
  name: string;
  nickname: string | null;
  emoji: string;
  avatarUrl: string | null;
  bio: string | null;
  school: string | null;
  gradYear: number | null;
  handle: string;
  circles: MutualCircle[];
  /** My outgoing share to them. */
  sharingWithThem: ShareLink | null;
  /** Their outgoing share to me. */
  sharingWithMe: ShareLink | null;
  guardianLinked: boolean;
  telemetry: FriendTelemetry | null;
  upcoming: SharedPlan[];
  memories: SharedPlan[];
};

/** Nicknames win over display names everywhere the signed-in user looks. */
export function aliasFor(
  nicknames: Record<string, string> | undefined,
  profileId: string | null | undefined,
  fallback: string | null | undefined,
): string {
  if (profileId && nicknames?.[profileId]) return nicknames[profileId]!;
  return fallback ?? "Member";
}
