import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { HacData, DistrictId } from "./types";
import { getFallbackData } from "./mockData";

const STORAGE_KEY = "aurahac.data.v1";
const CRED_KEY = "aurahac.cred.v1";
const THEME_KEY = "aurahac.theme.v2";

export type Theme = "nebula" | "onyx" | "executive" | "arctic" | "titanium" | "amethyst";
const THEMES: Theme[] = ["nebula", "onyx", "executive", "arctic", "titanium", "amethyst"];

interface Cred {
  district: DistrictId;
  username: string;
  password: string;
}

interface Ctx {
  data: HacData | null;
  loading: boolean;
  error: string | null;
  hasCredentials: boolean;
  isFallback: boolean;
  login: (c: Cred) => Promise<void>;
  refresh: () => Promise<void>;
  logout: () => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const HacCtx = createContext<Ctx | null>(null);

export function HacProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<HacData | null>(null);
  const [cred, setCred] = useState<Cred | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState(false);
  const [theme, setThemeState] = useState<Theme>("nebula");

  // Hydrate from localStorage once. Fall back to demo data so the app is
  // always fully interactive even before a live sync succeeds.
  useEffect(() => {
    try {
      const d = localStorage.getItem(STORAGE_KEY);
      if (d) {
        setData(JSON.parse(d));
      } else {
        setData(getFallbackData());
        setIsFallback(true);
      }
      const c = localStorage.getItem(CRED_KEY);
      if (c) setCred(JSON.parse(c));
      const a = localStorage.getItem("aurahac.accent");
      if (a === "violet" || a === "cyan" || a === "emerald") setAccentState(a);
    } catch {
      setData(getFallbackData());
      setIsFallback(true);
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.accent = accent;
  }, [accent]);

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
    setData(getFallbackData());
    setIsFallback(true);
    setCred(null);
    setError(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(CRED_KEY);
      localStorage.removeItem("aurahac.accent");
    } catch {
      /* ignore */
    }
  }

  function setAccent(a: "violet" | "cyan" | "emerald") {
    setAccentState(a);
    try {
      localStorage.setItem("aurahac.accent", a);
    } catch {
      /* ignore */
    }
  }

  const value = useMemo<Ctx>(
    () => ({
      data,
      loading,
      error,
      hasCredentials: !!cred,
      isFallback,
      login,
      refresh,
      logout,
      accent,
      setAccent,
    }),
    [data, loading, error, cred, isFallback, accent],
  );

  return <HacCtx.Provider value={value}>{children}</HacCtx.Provider>;
}

export function useHac() {
  const c = useContext(HacCtx);
  if (!c) throw new Error("useHac must be inside HacProvider");
  return c;
}