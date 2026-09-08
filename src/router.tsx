import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Warms the target route's code (and, per-route, its data via loaders)
    // as soon as a Link is touched/hovered, instead of waiting for the tap
    // to land -- most of a navigation's cost gets hidden behind the tap.
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
  });

  return router;
};
