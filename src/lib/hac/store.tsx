import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { HacData, DistrictId, UserEvent } from "./types";
import { getFallbackData } from "./mockData";

const STORAGE_KEY = "aurahac.data.v1";
const CRED_KEY = "aurahac.cred.v1";
const THEME_KEY = "aurahac.theme.v2";
const DEMO_KEY = "aurahac.demo.v1";
const DONE_KEY = "aurahac.done.v1";
const EVENTS_KEY = "aurahac.events.v1";

export type Theme = "nebula" | "onyx" | "executive" | "arctic" | "titanium" | "amethyst";
const THEMES: Theme[] = ["nebula", "onyx", "executive", "arctic", "titanium", "amethyst"];

interface Cred {
  district: DistrictId;
  username: string;
  password: string;
}

export type CourseSubTab = "grades" | "analysis" | "whatif";

interface Ctx {
  data: HacData | null;
  loading: boolean;
  error: string | null;
  hasCredentials: boolean;
  isFallback: boolean;
  login: (c: Cred) => Promise<void>;
  loginDemo: () => void;
  refresh: () => Promise<void>;
  logout: () => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  courseNav: { courseId: string; sub: CourseSubTab } | null;
  setCourseNav: (n: { courseId: string; sub: CourseSubTab } | null) => void;
  completed: Record<string, boolean>;
  toggleCompleted: (key: string) => void;
}

const HacCtx = createContext<Ctx | null>(null);

export function HacProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<HacData | null>(null);
  const [cred, setCred] = useState<Cred | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState(false);
  const [theme, setThemeState] = useState<Theme>("nebula");
  const [courseNav, setCourseNav] = useState<{ courseId: string; sub: CourseSubTab } | null>(null);
  const [completed, setCompleted] = useState<Record<string, boolean>>({});

  // Hydrate from localStorage once. Fall back to demo data so the app is
  // Hydrate from localStorage once. Show the login screen by default; restore a
  // live session, or a previously chosen demo session, when present.
  useEffect(() => {
    try {
      const t = localStorage.getItem(THEME_KEY);
      if (t && (THEMES as string[]).includes(t)) setThemeState(t as Theme);

      const done = localStorage.getItem(DONE_KEY);
      if (done) setCompleted(JSON.parse(done));

      const d = localStorage.getItem(STORAGE_KEY);
      if (d) {
        setData(JSON.parse(d));
        const c = localStorage.getItem(CRED_KEY);
        if (c) setCred(JSON.parse(c));
        return;
      }
      if (localStorage.getItem(DEMO_KEY)) {
        setData(getFallbackData());
        setIsFallback(true);
      }
    } catch {
      /* show login screen */
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  async function callSync(c: Cred): Promise<HacData> {
    const { syncHac } = await import("./hac.functions");
    return await syncHac({ data: c });
  }

  async function login(c: Cred) {
    setLoading(true);
    setError(null);
    try {
      const d = await callSync(c);
      setData(d);
      setIsFallback(false);
      setCred(c);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
      localStorage.setItem(CRED_KEY, JSON.stringify(c));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sync failed";
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }

  function loginDemo() {
    setError(null);
    setCred(null);
    setData(getFallbackData());
    setIsFallback(true);
    try {
      localStorage.setItem(DEMO_KEY, "1");
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(CRED_KEY);
    } catch {
      /* ignore */
    }
  }

  async function refresh() {
    if (!cred) return;
    setLoading(true);
    setError(null);
    try {
      const d = await callSync(cred);
      setData(d);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    setData(null);
    setIsFallback(false);
    setCred(null);
    setError(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(CRED_KEY);
      localStorage.removeItem(DEMO_KEY);
    } catch {
      /* ignore */
    }
  }

  function setTheme(t: Theme) {
    setThemeState(t);
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch {
      /* ignore */
    }
  }

  function toggleCompleted(key: string) {
    setCompleted((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (!next[key]) delete next[key];
      try {
        localStorage.setItem(DONE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const value = useMemo<Ctx>(
    () => ({
      data,
      loading,
      error,
      hasCredentials: !!cred,
      isFallback,
      login,
      loginDemo,
      refresh,
      logout,
      theme,
      setTheme,
      courseNav,
      setCourseNav,
      completed,
      toggleCompleted,
    }),
    [data, loading, error, cred, isFallback, theme, courseNav, completed],
  );

  return <HacCtx.Provider value={value}>{children}</HacCtx.Provider>;
}

export function useHac() {
  const c = useContext(HacCtx);
  if (!c) throw new Error("useHac must be inside HacProvider");
  return c;
}