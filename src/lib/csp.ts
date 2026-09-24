// Content-Security-Policy shared between server.ts (which sets the header) and
// router.tsx (which stamps the nonce on the scripts it renders).

/** Internal request header server.ts uses to hand the nonce to the router. */
export const CSP_NONCE_HEADER = "x-syncly-csp-nonce";

/**
 * Hosts allowed to embed the app in an iframe: Lovable's editor preview
 * renders the app in a frame, everything else (clickjacking) is refused.
 */
const FRAME_ANCESTORS = [
  "'self'",
  "https://lovable.dev",
  "https://*.lovable.dev",
  "https://*.lovable.app",
  "https://*.lovableproject.com",
];

/**
 * Scripts must carry this request's nonce; 'strict-dynamic' lets those
 * trusted scripts load the app's own code-split chunks. Anything injected
 * (an XSS payload, an inline onerror= handler) has no nonce and never runs.
 * Styles, images, and connections stay open: the maps, Supabase, weather and
 * venue APIs pull from many hosts, and none of those can execute script.
 */
export function buildCsp(nonce: string): string {
  return [
    `script-src 'nonce-${nonce}' 'strict-dynamic'`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    `frame-ancestors ${FRAME_ANCESTORS.join(" ")}`,
    "worker-src 'self' blob:",
  ].join("; ");
}

/** Pages without a rendered document (API, server functions, errors) need no nonce. */
export const STATIC_CSP = [
  "script-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  `frame-ancestors ${FRAME_ANCESTORS.join(" ")}`,
].join("; ");
