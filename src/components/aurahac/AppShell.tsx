import { useEffect, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { useHac } from "@/lib/hac/store";
import { LoginGate } from "./LoginGate";
import { PullToRefresh } from "./PullToRefresh";
import { DesktopSidebar } from "./DesktopSidebar";
import { OverviewTab } from "./tabs/OverviewTab";
import { GradesTab } from "./tabs/GradesTab";
import { GpaTab } from "./tabs/GpaTab";
import { RecordsTab } from "./tabs/RecordsTab";
import { CalendarTab } from "./tabs/CalendarTab";
import { SettingsTab } from "./tabs/SettingsTab";
import { Home, BookOpen, GraduationCap, FolderOpen, Calendar, Settings } from "lucide-react";

type TabId = "overview" | "grades" | "gpa" | "records" | "calendar" | "settings";

const TABS: { id: TabId; label: string; icon: typeof Home }[] = [
  { id: "overview", label: "Overview", icon: Home },
  { id: "grades", label: "Grades", icon: BookOpen },
  { id: "gpa", label: "GPA", icon: GraduationCap },
  { id: "records", label: "Records", icon: FolderOpen },
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "settings", label: "Settings", icon: Settings },
];

function Pane({ active, current, children }: { active: TabId; current: TabId; children: ReactNode }) {
  const { refresh, loading, hasCredentials } = useHac();
  if (active !== current) return null;
  return (
    <div className="absolute inset-0">
      {hasCredentials ? (
        <PullToRefresh
          onRefresh={() => void refresh()}
          refreshing={loading}
          className="overflow-y-auto px-5"
        >
          {children}
        </PullToRefresh>
      ) : (
        <div className="absolute inset-0 overflow-y-auto overflow-x-hidden px-5" style={{ overscrollBehaviorX: "none", touchAction: "pan-y" }}>{children}</div>
      )}
    </div>
  );
}

export function AppShell() {
  const { data, hasCredentials, courseNav } = useHac();
  const [tab, setTab] = useState<TabId>("overview");

  useEffect(() => {
    if (courseNav) setTab("grades");
  }, [courseNav]);


  return (
    <div
      className="relative overflow-hidden"
      style={{ width: "100vw", height: "100dvh" }}
    >
      {/* Animated mesh backdrop */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(60% 50% at 15% 10%, color-mix(in oklab, var(--primary) 14%, transparent), transparent 70%), radial-gradient(50% 40% at 90% 80%, color-mix(in oklab, var(--accent) 10%, transparent), transparent 70%), var(--background-deep, var(--background))",
        }}
      />

      {!data && !hasCredentials ? (
        <LoginGate />
      ) : (
        <div className="absolute inset-0 flex">
          <DesktopSidebar />
          <div className="relative flex-1 min-w-0">
            <Pane active="overview" current={tab}><OverviewTab /></Pane>
            <Pane active="grades" current={tab}><GradesTab /></Pane>
            <Pane active="gpa" current={tab}><GpaTab /></Pane>
            <Pane active="calendar" current={tab}><CalendarTab /></Pane>
            <Pane active="settings" current={tab}><SettingsTab /></Pane>
          </div>
        </div>
      )}

      {data ? (
        <nav
          className="fixed z-[9999] glass-strong rounded-3xl px-2 py-2 flex items-center gap-1 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.7)] bottom-5 left-1/2 -translate-x-1/2 lg:left-[calc(50%+150px)]"
        >
          {TABS.map((t) => {
            const active = tab === t.id;
            const Icon = t.icon;
            return (
              <motion.button
                key={t.id}
                onClick={() => setTab(t.id)}
                whileTap={{ scale: 0.85 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className={`relative h-12 w-12 rounded-xl grid place-items-center transition-colors duration-200 ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {active ? (
                  <motion.span
                    layoutId="nav-capsule"
                    className="absolute inset-0 rounded-xl"
                    style={{
                      background: "color-mix(in oklab, var(--primary) 16%, transparent)",
                      border: "1px solid color-mix(in oklab, var(--primary) 40%, transparent)",
                      boxShadow: "0 0 20px -4px var(--primary)",
                    }}
                    transition={{ type: "spring", stiffness: 500, damping: 34 }}
                  />
                ) : null}
                <Icon className="h-5 w-5 relative z-10" />
              </motion.button>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}