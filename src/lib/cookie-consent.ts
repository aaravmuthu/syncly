export const CONSENT_KEY = "syncly-cookie-consent";
export const CONSENT_EVENT = "syncly:cookie-consent";
export type CookieConsent = {
  version: 1;
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  savedAt: number;
};
const MAX_AGE = 180 * 24 * 60 * 60 * 1000;
export function parseConsent(value: string | null, now = Date.now()): CookieConsent | null {
  try {
    const data = JSON.parse(value ?? "null");
    if (
      !data ||
      data.version !== 1 ||
      data.necessary !== true ||
      typeof data.analytics !== "boolean" ||
      typeof data.marketing !== "boolean" ||
      typeof data.savedAt !== "number" ||
      !Number.isFinite(data.savedAt) ||
      data.savedAt > now ||
      now - data.savedAt >= MAX_AGE
    )
      return null;
    return data;
  } catch {
    return null;
  }
}
export function readConsent(): CookieConsent | null {
  if (typeof window === "undefined") return null;
  try {
    return parseConsent(localStorage.getItem(CONSENT_KEY));
  } catch {
    return null;
  }
}
/** Optional integrations must check this BEFORE loading scripts or writing storage. */
export function hasCookieConsent(category: "analytics" | "marketing") {
  return readConsent()?.[category] === true;
}
export function saveConsent(analytics: boolean, marketing: boolean) {
  const consent: CookieConsent = {
    version: 1,
    necessary: true,
    analytics,
    marketing,
    savedAt: Date.now(),
  };
  localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: consent }));
}
export function openCookieSettings() {
  window.dispatchEvent(new Event("syncly:cookie-settings"));
}
