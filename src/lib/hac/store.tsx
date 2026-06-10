import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { HacData, DistrictId } from "./types";
import { getFallbackData } from "./mockData";

const STORAGE_KEY = "aurahac.data.v1";
const CRED_KEY = "aurahac.cred.v1";

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
  login: (c: Cred) => Promise<void>;
  refresh: () => Promise<void>;
  logout: () => void;
  accent: "violet" | "cyan" | "emerald";
  setAccent: (a: "violet" | "cyan" | "emerald") => void;
}

const HacCtx = createContext<Ctx | null>(null);

export function HacProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<HacData | null>(null);
  const [cred, setCred] = useState<Cred | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accent, setAccentState] = useState<"violet" | "cyan" | "emerald">("violet");

  // Hydrate from localStorage once.
  useEffect(() => {
    try {
      const d = localStorage.getItem(STORAGE_KEY);
      if (d) setData(JSON.parse(d));
      const c = localStorage.getItem(CRED_KEY);
      if (c) setCred(JSON.parse(c));
      const a = localStorage.getItem("aurahac.accent");
      if (a === "violet" || a === "cyan" || a === "emerald") setAccentState(a);
    } catch {
      /* ignore */
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
    setData(null);
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
      login,
      refresh,
      logout,
      accent,
      setAccent,
    }),
    [data, loading, error, cred, accent],
  );

  return <HacCtx.Provider value={value}>{children}</HacCtx.Provider>;
}

export function useHac() {
  const c = useContext(HacCtx);
  if (!c) throw new Error("useHac must be inside HacProvider");
  return c;
}