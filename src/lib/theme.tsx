import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Moon, Sun } from "lucide-react";
import { type ThemeChoice, type Ctx, ThemeContext, useTheme } from "./theme-context";

const STORAGE_KEY = "syncly-theme";

function systemPrefersDark() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function apply(resolved: "light" | "dark") {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", resolved === "dark" ? "#141311" : "#f7f6f2");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeChoice>("system");
  const [systemDark, setSystemDark] = useState(false);
  const [ready, setReady] = useState(false);

  // Hydration-safe: read storage + system preference after mount only.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY) as ThemeChoice | null;
      if (stored === "light" || stored === "dark" || stored === "system") setThemeState(stored);
    } catch {
      /* Storage may be blocked; follow the system theme. */
    }
    setReady(true);
    setSystemDark(systemPrefersDark());
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const resolved: "light" | "dark" = theme === "system" ? (systemDark ? "dark" : "light") : theme;

  useEffect(() => {
    if (ready) apply(resolved);
  }, [ready, resolved]);

  const setTheme = useCallback((t: ThemeChoice) => {
    setThemeState(t);
    try {
      window.localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* private mode */
    }
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      theme,
      resolved,
      setTheme,
      toggle: () => setTheme(resolved === "dark" ? "light" : "dark"),
    }),
    [theme, resolved, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Compact icon toggle for the navigation bar. */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolved, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={resolved === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className={
        "tap-target pressable active:pressable-active inline-flex items-center justify-center rounded-full border border-border text-base text-muted-foreground hover:bg-secondary hover:text-foreground " +
        (className ?? "")
      }
    >
      {resolved === "dark" ? (
        <Moon className="size-4" aria-hidden />
      ) : (
        <Sun className="size-4" aria-hidden />
      )}
    </button>
  );
}
