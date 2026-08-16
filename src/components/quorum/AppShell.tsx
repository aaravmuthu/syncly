import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Wordmark } from "./Wordmark";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/home", label: "Home", icon: "◎" },
  { to: "/groups", label: "Groups", icon: "◍" },
  { to: "/plans", label: "Plans", icon: "◈" },
  { to: "/settings", label: "You", icon: "◐" },
] as const;

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

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link to="/home" className="flex items-center gap-2">
            <Wordmark className="h-6" />
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
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
              </Link>
            ))}
          </nav>
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

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl sm:hidden">
        <div className="mx-auto flex max-w-md items-stretch justify-between px-2 py-1.5">
          {NAV.map((n) => {
            const active = pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 rounded-2xl px-2 py-2 text-[11px] font-medium transition",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span className="text-base leading-none">{n.icon}</span>
                {n.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
