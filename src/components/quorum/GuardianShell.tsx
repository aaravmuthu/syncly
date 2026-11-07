import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { House, Radar, UserRound, type LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import { haptic } from "@/lib/quorum/haptics";
import { Wordmark } from "./Wordmark";
import { ContextSwitcher } from "./ContextSwitcher";
import { Avatar } from "./Avatar";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/lib/theme";
import { getMe } from "@/lib/quorum/plan.functions";
import { FriendProvider } from "@/lib/quorum/nicknames";
import { FriendProfileSheet } from "./friend/FriendProfileSheet";
import { PageTransition } from "./interactions/PageTransition";

// v1 scope: GuardianShell wraps only /guardian. Radar and Profile are the
// existing shared routes, rendered via AppShell as they work today -- making
// every shared route shell-aware is a bigger change, out of scope for now.
const NAV = [
  { to: "/guardian", label: "Family", icon: House },
  { to: "/radar", label: "Radar", icon: Radar },
  { to: "/settings", label: "Profile", icon: UserRound },
] as const satisfies readonly { to: string; label: string; icon: LucideIcon }[];

export function GuardianShell({
  children,
  title,
  subtitle,
  action,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const me = useQuery({ queryKey: ["me"], queryFn: useServerFn(getMe), retry: false });

  return (
    <FriendProvider>
      <div
        data-vaul-drawer-wrapper
        className="app-shell mx-auto min-h-dvh w-full bg-background md:max-w-3xl md:shadow-2xl"
      >
        <header className="liquid-bar liquid-bar-docked safe-top sticky top-0 z-30">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 px-4 py-3">
            <Link to="/guardian" className="tap-target flex items-center gap-2">
              <Wordmark className="h-6" />
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-caption font-semibold uppercase tracking-wide text-foreground">
                Family
              </span>
            </Link>
            <div className="flex items-center gap-2">
              <nav aria-label="Family navigation" className="hidden items-center gap-1 md:flex">
                {NAV.map((n) => (
                  <Link
                    key={n.to}
                    to={n.to}
                    aria-current={pathname.startsWith(n.to) ? "page" : undefined}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-sm font-medium transition",
                      pathname.startsWith(n.to)
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {n.label}
                  </Link>
                ))}
              </nav>
              <ContextSwitcher />
              <ThemeToggle />
              <Link
                to="/settings"
                aria-label="Your profile"
                className="tap-target pressable grid place-items-center active:pressable-active"
              >
                <Avatar
                  url={me.data?.avatar_url}
                  emoji={me.data?.avatar_emoji}
                  name={me.data?.display_name}
                  size={32}
                  className="ring-1 ring-primary/40"
                />
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-3xl px-4 pb-32 pt-6">
          {title ? (
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
                {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
              </div>
              {action}
            </div>
          ) : null}
          <PageTransition>{children}</PageTransition>
        </main>

        <nav
          aria-label="Family navigation"
          className="mobile-tab-bar liquid-bar fixed left-[max(0.75rem,env(safe-area-inset-left,0px))] right-[max(0.75rem,env(safe-area-inset-right,0px))] bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-50 mx-auto max-w-md rounded-full md:hidden"
        >
          <div className="mx-auto flex max-w-xs items-stretch justify-between px-2 py-1.5">
            {NAV.map((n) => {
              const active = pathname.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  aria-current={active ? "page" : undefined}
                  onClick={() => haptic("select")}
                  className="flex flex-1 rounded-full focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <motion.span
                    whileTap={{ scale: 0.9 }}
                    animate={{ scale: active ? 1.06 : 1, y: active ? -1 : 0 }}
                    transition={{ type: "spring", stiffness: 460, damping: 24 }}
                    className={cn(
                      "tap-target relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-2 py-2 text-caption font-medium",
                      active ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {active ? (
                      <motion.span
                        layoutId="guardian-tab-indicator"
                        transition={{ type: "spring", stiffness: 420, damping: 32 }}
                        className="absolute -top-px h-0.5 w-8 rounded-full bg-primary"
                      />
                    ) : null}
                    <n.icon className="h-5 w-5" aria-hidden />
                    {n.label}
                  </motion.span>
                </Link>
              );
            })}
          </div>
        </nav>

        <FriendProfileSheet />
      </div>
    </FriendProvider>
  );
}
