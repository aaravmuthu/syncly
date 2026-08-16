/** Invite-code helpers shared by the join flow. */

const KEY = "quorum:pending-invite";
export const CODE_ALPHABET = /^[A-Z0-9]{4,8}$/;

export function normalizeCode(raw: string) {
  return (raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

export function isValidCode(raw: string) {
  return CODE_ALPHABET.test(normalizeCode(raw));
}

export function inviteLink(code: string) {
  if (typeof window === "undefined") return `/join/${code}`;
  return `${window.location.origin}/join/${code}`;
}

export function setPendingInvite(code: string) {
  try {
    window.sessionStorage.setItem(KEY, normalizeCode(code));
  } catch {
    /* storage unavailable */
  }
}

export function takePendingInvite(): string | null {
  try {
    const v = window.sessionStorage.getItem(KEY);
    if (v) window.sessionStorage.removeItem(KEY);
    return v && isValidCode(v) ? v : null;
  } catch {
    return null;
  }
}

/** Native share with a clipboard fallback. Returns how it was shared. */
export async function shareOrCopy(payload: { title: string; text: string; url?: string }) {
  const nav = typeof navigator === "undefined" ? null : navigator;
  if (nav && typeof nav.share === "function") {
    try {
      await nav.share(payload);
      return "shared" as const;
    } catch {
      /* user dismissed — fall through to copy */
    }
  }
  const text = payload.url ? `${payload.text}\n${payload.url}` : payload.text;
  try {
    await nav?.clipboard?.writeText(text);
    return "copied" as const;
  } catch {
    return "failed" as const;
  }
}
