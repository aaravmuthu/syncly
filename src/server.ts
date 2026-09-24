import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { CSP_NONCE_HEADER, STATIC_CSP, buildCsp } from "./lib/csp";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), payment=(), usb=()",
};

// Vite's dev server injects un-nonced inline scripts (HMR, React refresh), so
// the strict script policy only applies to production builds.
const ENFORCE_SCRIPT_CSP = process.env.NODE_ENV === "production";

function mintNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

function withSecurityHeaders(response: Response, nonce: string | null): Response {
  // Fetch responses can have immutable headers; rebuild so we can add ours.
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(name)) headers.set(name, value);
  }
  if (!headers.has("Content-Security-Policy")) {
    const isHtml = (headers.get("content-type") ?? "").includes("text/html");
    // A router-rendered page carries the nonce meta tag; anything else (API
    // replies, the static error page) has no scripts that need to run.
    const body = isHtml && nonce ? buildCsp(nonce) : STATIC_CSP;
    headers.set(
      "Content-Security-Policy",
      ENFORCE_SCRIPT_CSP ? body : body.replace(/script-src [^;]+; /, ""),
    );
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const nonce = mintNonce();
    try {
      // Always overwrite, so a client can't pick its own nonce by sending the header.
      const headers = new Headers(request.headers);
      headers.set(CSP_NONCE_HEADER, nonce);
      const handler = await getServerEntry();
      const response = await handler.fetch(new Request(request, { headers }), env, ctx);
      const normalized = await normalizeCatastrophicSsrResponse(response);
      // normalizeCatastrophicSsrResponse swaps in the static error page on a crash.
      return withSecurityHeaders(normalized, normalized === response ? nonce : null);
    } catch (error) {
      console.error(error);
      return withSecurityHeaders(
        new Response(renderErrorPage(), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
        null,
      );
    }
  },
};
