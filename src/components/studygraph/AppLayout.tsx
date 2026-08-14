import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  BookOpen,
  Brain,
  CalendarRange,
  GraduationCap,
  LayoutDashboard,
  LineChart,
  Menu,
  MessagesSquare,
  Network,
  NotebookPen,
  Settings,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useStudyGraph } from "@/lib/studygraph/store";
import { courseMastery } from "@/lib/studygraph/engine";
import { COURSE_BY_ID } from "@/lib/studygraph/curriculum";
import { Logo } from "./Logo";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/graph", label: "Knowledge Graph", icon: Network },
  { to: "/learn", label: "Learn", icon: BookOpen },
  { to: "/practice", label: "Practice", icon: Target },
  { to: "/review", label: "Review", icon: Brain },
  { to: "/planner", label: "Planner", icon: CalendarRange },
  { to: "/coach", label: "AI Coach", icon: MessagesSquare },
  { to: "/analytics", label: "Analytics", icon: LineChart },
  { to: "/notes", label: "Notes", icon: NotebookPen },
  { to: "/subjects", label: "Subjects", icon: GraduationCap },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppLayout({
  children,
  title,
  subtitle,
  actions,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  const { state } = useStudyGraph();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const course = COURSE_BY_ID.get(state.profile.courseId);
  const mastery = courseMastery(state, state.profile.courseId);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="ambient-field min-h-dvh">
      <div className="mx-auto flex min-h-dvh w-full max-w-[1600px]">
        {/* Sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-[264px] shrink-0 border-r border-sidebar-border bg-sidebar backdrop-blur-2xl transition-transform duration-300 lg:static lg:translate-x-0",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex h-full flex-col p-4">
            <div className="flex items-center justify-between">
              <Link to="/" className="flex items-center gap-2.5 px-1 py-2">
                <Logo className="h-8 w-8" />
                <span className="text-[15px] font-semibold tracking-tight">StudyGraph</span>
              </Link>
              <button
                className="rounded-lg p-2 text-muted-foreground lg:hidden"
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <nav className="mt-4 flex-1 space-y-0.5 overflow-y-auto">
              {NAV.map((item) => {
                const active = pathname === item.to;
                const Icon = item.icon;
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
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Active course
              </p>
              <p className="mt-1 truncate text-sm font-semibold">{course?.name ?? "—"}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="accent-gradient h-full rounded-full"
                  style={{ width: `${Math.round(mastery * 100)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {Math.round(mastery * 100)}% graph mastery · {state.streak.current} day streak
              </p>
            </div>
          </div>
        </aside>

        {open ? (
          <button
            className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Close navigation overlay"
          />
        ) : null}

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-border bg-background/70 px-5 py-4 backdrop-blur-xl">
            <div className="flex flex-wrap items-center gap-3">
              <button
                className="rounded-lg border border-border p-2 lg:hidden"
                onClick={() => setOpen(true)}
                aria-label="Open navigation"
              >
                <Menu className="h-4 w-4" />
              </button>
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1>
                {subtitle ? (
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">{subtitle}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                {actions}
                <Link
                  to="/coach"
                  className="accent-gradient hidden items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold text-primary-foreground sm:inline-flex"
                >
                  <Sparkles className="h-4 w-4" />
                  Ask coach
                </Link>
              </div>
            </div>
          </header>

          <main className="flex-1 px-5 py-6 pb-24 lg:pb-10">{children}</main>
        </div>
      </div>
    </div>
  );
}
