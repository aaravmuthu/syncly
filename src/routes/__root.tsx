import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Link,
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { MotionConfig } from "motion/react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { BRAND } from "@/lib/brand";
import { supabase } from "@/integrations/supabase/client";
import { ThemeProvider } from "@/lib/theme";
import { registerServiceWorker } from "@/lib/quorum/pwa";

function NotFoundComponent() {
  return (
    <div className="paper-field flex min-h-screen items-center justify-center px-6">
      <div className="card-surface max-w-md px-8 py-10 text-center">
        <p className="text-sm font-medium text-muted-foreground">404</p>
        <h1 className="mt-2 text-2xl font-semibold">We couldn't find that page</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The link may be old, or the plan it pointed to was removed.
        </p>
        <Link
          to="/"
          className="pressable active:pressable-active mt-6 inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Back to {BRAND.name}
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="paper-field flex min-h-screen items-center justify-center px-6">
      <div className="card-surface max-w-md px-8 py-10 text-center">
        <h1 className="text-xl font-semibold">Something went wrong on our end</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Nothing was lost. Try again, or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="pressable active:pressable-active rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Try again
          </button>
          <a
            href="/"
            className="rounded-full border border-input px-5 py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "google-site-verification",
        content: "nRxYZNZNCuzgoqSu_oEMzMOqkKfABn18YKk0hPvePw4",
      },
      {
        name: "viewport",
        content: "viewport-fit=cover, width=device-width, initial-scale=1.0",
      },
      { name: "theme-color", content: "#000000" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Syncly" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Gloock&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon-light.png", media: "(prefers-color-scheme: light)" },
      { rel: "icon", type: "image/png", href: "/favicon-dark.png", media: "(prefers-color-scheme: dark)" },
      { rel: "icon", type: "image/png", href: "/favicon-dark.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.json" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);

  useEffect(() => {
    registerServiceWorker();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        {/* App-wide, not new: every framer-motion animation already in this
            app (whileTap/whileHover on every Button, TeenWidget, HUD
            controls, and everything just added in this pass) had no
            prefers-reduced-motion handling at all until this one wrapper --
            "user" respects the OS setting for spring/tween animations while
            still allowing layout animations that convey real information. */}
        <MotionConfig reducedMotion="user">
          <Outlet />
          <Toaster
            position="top-center"
            richColors
            closeButton
            offset={{ top: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}
          />
        </MotionConfig>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
