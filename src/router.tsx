import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { routeTree } from "./routeTree.gen";
import { CSP_NONCE_HEADER } from "./lib/csp";

// server.ts mints a per-request nonce; the router stamps it on every script it
// renders so the Content-Security-Policy can refuse any script without it.
// The client reads it back from the csp-nonce meta tag the router emits.
const getCspNonce = createIsomorphicFn()
  .server(() => getRequestHeader(CSP_NONCE_HEADER))
  .client(() => undefined);

export const getRouter = () => {
  const queryClient = new QueryClient();
  const nonce = getCspNonce();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    ...(nonce ? { ssr: { nonce } } : {}),
    scrollRestoration: true,
    // Warms the target route's code (and, per-route, its data via loaders)
    // as soon as a Link is touched/hovered, instead of waiting for the tap
    // to land -- most of a navigation's cost gets hidden behind the tap.
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
  });

  return router;
};
