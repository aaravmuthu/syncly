import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  BookOpen,
  Brain,
  CalendarRange,
  Home,
  LineChart,
  MessagesSquare,
  Network,
  Target,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useStudyGraph } from "@/lib/studygraph/store";
import { courseMastery } from "@/lib/studygraph/engine";
import { COURSE_BY_ID } from "@/lib/studygraph/curriculum";
import { Logo } from "./Logo";

const TABS = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/graph", label: "Graph", icon: Network },
  { to: "/learn", label: "Learn", icon: BookOpen },
  { to: "/review", label: "Review", icon: Brain },
  { to: "/profile", label: "Profile", icon: User },
] as const;

const DESKTOP_EXTRA = [
  { to: "/practice", label: "Practice", icon: Target },
  { to: "/planner", label: "Planner", icon: CalendarRange },
  { to: "/coach", label: "AI Coach", icon: MessagesSquare },
  { to: "/analytics", label: "Analytics", icon: LineChart },
] as const;

export function AppLayout({
  children,
  title,
  subtitle,
  actions,
  bare = false,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  /** Hides the page header — used by immersive full-screen modes. */
  bare?: boolean;
}) {
  const { state } = useStudyGraph();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mounted, setMounted] = useState(false);
  const course = COURSE_BY_ID.get(state.profile.courseId);
  const mastery = courseMastery(state, state.profile.courseId);

  useEffect(() => setMounted(true), []);

  const isActive = (to: string) => pathname === to;

  return (
    <div className="ambient-field min-h-dvh">
      <div className="mx-auto flex min-h-dvh w-full max-w-[1600px]">
        {/* Desktop navigation rail */}
        <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-4 lg:flex">
          <Link to="/" className="flex items-center gap-2.5 px-1 py-2">
            <Logo className="h-8 w-8" />
            <span className="text-[15px] font-semibold tracking-tight">StudyGraph</span>
          </Link>

          <nav className="mt-5 flex-1 space-y-0.5 overflow-y-auto">
            {[...TABS, ...DESKTOP_EXTRA].map((item) => {
              const Icon = item.icon;
              const active = isActive(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
                    active && "bg-sidebar-accent text-foreground",
                  )}
                >
                  <Icon className={cn("h-4 w-4", active && "text-primary")} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="glass-soft mt-4 rounded-2xl p-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Course</p>
            <p className="mt-1 truncate text-sm font-semibold">{course?.name ?? "—"}</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="accent-gradient h-full rounded-full transition-[width] duration-500"
                style={{ width: `${Math.round(mastery * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {Math.round(mastery * 100)}% mastery · {state.streak.current} day streak
            </p>
          </div>
        </aside>

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          {!bare && title ? (
            <header className="sticky top-0 z-30 border-b border-border bg-background/80 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl sm:px-5">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <div className="min-w-0">
                  <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">
                    {title}
                  </h1>
                  {subtitle ? (
                    <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{subtitle}</p>
                  ) : null}
                </div>
                {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
              </div>
            </header>
          ) : null}

          <main
            className={cn(
              "flex-1 px-4 sm:px-5",
              bare ? "pt-[max(0.5rem,env(safe-area-inset-top))]" : "pt-4",
              "pb-[calc(6.5rem+env(safe-area-inset-bottom))] lg:pb-10",
            )}
          >
            {children}
          </main>
        </div>
      </div>

      {/* Mobile bottom navigation */}
      <nav
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(0.6rem,env(safe-area-inset-bottom))] lg:hidden",
          mounted ? "opacity-100" : "opacity-0",
        )}
        aria-label="Primary"
      >
        <div className="glass mx-auto flex max-w-md items-stretch justify-between gap-1 rounded-[22px] p-1.5">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = isActive(tab.to);
            return (
              <Link
                key={tab.to}
                to={tab.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-[52px] flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[10px] font-medium transition-colors",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {active ? (
                  <span className="absolute inset-0 rounded-2xl bg-secondary" aria-hidden />
                ) : null}
                <Icon
                  className={cn(
                    "relative h-[18px] w-[18px] transition-transform duration-200",
                    active && "-translate-y-px text-primary",
                  )}
                />
                <span className="relative">{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
