// Helpers for code that touches the DOM or navigation outside React (map
// markers, redirects). React escapes text for us; these paths don't, so any
// user-controlled value must go through here instead of innerHTML / raw URLs.

/** A <span> whose content is set as plain text, never parsed as HTML. */
export function pinSpan(className: string, text?: string | null): HTMLSpanElement {
  const span = document.createElement("span");
  span.className = className;
  if (text != null) span.textContent = text;
  return span;
}

/** Returns the URL only if it's http(s), a same-origin path, or a raster image data URL. */
export function safeImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (/^data:image\/(png|jpeg|jpg|gif|webp);base64,/i.test(trimmed)) return trimmed;
  try {
    const parsed = new URL(trimmed, window.location.origin);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : null;
  } catch {
    return null;
  }
}

/**
 * Only same-origin, path-only redirect targets survive; anything else (other
 * hosts, `//evil.com`, `/\evil.com`, `javascript:`) falls back to `fallback`.
 */
export function safeRedirectPath(next: string | null | undefined, fallback: string): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;
  // Browsers treat "\" like "/" and strip tabs/newlines, so "/\evil.com" would leave the site.
  // eslint-disable-next-line no-control-regex -- matching control chars is the point
  if (/[\\\u0000-\u001f\u007f]/.test(next)) return fallback;
  try {
    const base = "https://syncly.invalid";
    const parsed = new URL(next, base);
    if (parsed.origin !== base) return fallback;
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return fallback;
  }
}

/** Only lets a server-supplied redirect through if it's a real http(s) URL. */
export function isHttpUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}
