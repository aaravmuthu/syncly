import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bell,
  House,
  MessageCircle,
  Radar,
  UserRound,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { motion } from "motion/react";
import { haptic } from "@/lib/quorum/haptics";
import { Wordmark } from "./Wordmark";
import { ContextSwitcher } from "./ContextSwitcher";

import { Avatar } from "./Avatar";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/lib/theme";
import { useNotifications } from "@/lib/quorum/useNotifications";
import { getMe } from "@/lib/quorum/plan.functions";
import { FriendProvider } from "@/lib/quorum/nicknames";
import { FriendProfileSheet } from "./friend/FriendProfileSheet";

const BASE_NAV = [
  { to: "/home", label: "Home", icon: House },
  { to: "/groups", label: "Groups", icon: Users },
  { to: "/radar", label: "Radar", icon: Radar },
  { to: "/plans", label: "Plans", icon: Zap },
  { to: "/messages", label: "Chats", icon: MessageCircle },
  { to: "/activity", label: "Activity", icon: Bell },
  { to: "/settings", label: "Profile", icon: UserRound },
] as const;

type NavItem = { to: string; label: string; icon: LucideIcon };

export function AppShell({
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
  const { unread } = useNotifications();
  const me = useQuery({ queryKey: ["me"], queryFn: useServerFn(getMe), retry: false });
  // AppShell is the "My Squad" experience for everyone -- Family Hub now has
  // its own shell (GuardianShell) and is reached via the ContextSwitcher, not
  // a swapped nav tab here.
  const NAV: NavItem[] = [...BASE_NAV];


  return (
    <FriendProvider>
    <div className="mx-auto min-h-dvh w-full bg-background md:max-w-3xl md:shadow-2xl">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link to="/home" className="flex items-center gap-2">
            <Wordmark className="h-6" />
          </Link>
          <div className="flex items-center gap-2">
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "rounded-xl px-3 py-1.5 text-sm font-medium transition",
                  pathname.startsWith(n.to)
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {n.label}
                {n.to === "/activity" && unread > 0 ? (
                  <span className="ml-1.5 inline-grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground">
                    {unread > 9 ? "9+" : unread}
                  </span>
                ) : null}
              </Link>
            ))}
          </nav>
          <ContextSwitcher />
          <ThemeToggle />
          <Link to="/settings" aria-label="Your profile" className="pressable active:pressable-active">
            <Avatar
              url={me.data?.avatar_url}
              emoji={me.data?.avatar_emoji}
              name={me.data?.display_name}
              size={32}
              className="ring-1 ring-border"
            />
          </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 pb-32 pt-6">
        {title ? (
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
              {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
            </div>
            {action}
          </div>
        ) : null}
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-background/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        <div className="mx-auto flex max-w-md items-stretch justify-between px-2 py-1.5">
          {NAV.map((n) => {
            const active = pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => haptic("select")}
                className="flex flex-1"
              >
                <motion.span
                  whileTap={{ scale: 0.9 }}
                  animate={{ scale: active ? 1.06 : 1, y: active ? -1 : 0 }}
                  transition={{ type: "spring", stiffness: 460, damping: 24 }}
                  className={cn(
                    "tap-target relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-2 py-2 text-[11px] font-medium",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId="tab-indicator"
                      transition={{ type: "spring", stiffness: 420, damping: 32 }}
                      className="absolute -top-px h-0.5 w-8 rounded-full bg-emerald-500"
                    />
                  ) : null}
                  <span className="relative leading-none">
                    <n.icon className="h-5 w-5" aria-hidden />
                    {n.to === "/activity" && unread > 0 ? (
                      <span className="absolute -right-2 -top-1 size-2 rounded-full bg-primary" />
                    ) : null}
                  </span>
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
