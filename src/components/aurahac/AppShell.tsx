import { useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useHac } from "@/lib/hac/store";
import { LoginGate } from "./LoginGate";
import { OverviewTab } from "./tabs/OverviewTab";
import { GradesTab } from "./tabs/GradesTab";
import { GpaTab } from "./tabs/GpaTab";
import { CalendarTab } from "./tabs/CalendarTab";
import { SettingsTab } from "./tabs/SettingsTab";
import { Home, BookOpen, GraduationCap, Calendar, Settings } from "lucide-react";

type TabId = "overview" | "grades" | "gpa" | "calendar" | "settings";

const TABS: { id: TabId; label: string; icon: typeof Home }[] = [
  { id: "overview", label: "Overview", icon: Home },
  { id: "grades", label: "Grades", icon: BookOpen },
  { id: "gpa", label: "GPA", icon: GraduationCap },
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "settings", label: "Settings", icon: Settings },
];

function Pane({ active, current, children }: { active: TabId; current: TabId; children: ReactNode }) {
  return (
    <div
      className="absolute inset-0 overflow-y-auto px-5"
      style={{ display: active === current ? "block" : "none" }}
    >
      {children}
    </div>
  );
}

export function AppShell() {
  const { data, hasCredentials } = useHac();
  const [tab, setTab] = useState<TabId>("overview");

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
        <div className="absolute inset-0">
          <Pane active="overview" current={tab}><OverviewTab /></Pane>
          <Pane active="grades" current={tab}><GradesTab /></Pane>
          <Pane active="gpa" current={tab}><GpaTab /></Pane>
          <Pane active="calendar" current={tab}><CalendarTab /></Pane>
          <Pane active="settings" current={tab}><SettingsTab /></Pane>
        </div>
      )}

      {data ? (
        <nav
          className="fixed z-[9999] glass-strong rounded-3xl px-2 py-2 flex items-center gap-1 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.7)]"
          style={{ bottom: 20, left: "50%", transform: "translateX(-50%)" }}
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