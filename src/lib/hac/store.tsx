import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { HacData, DistrictId, UserEvent, CourseCustom, BellRotation } from "./types";
import { getFallbackData } from "./mockData";
import { defaultBellRotation } from "./customize";
import { encryptJSON, decryptJSON } from "./secureStore";
import { emptyStreak, recordCheckIn, type StreakState } from "./streaks";
import type { MarkingPeriod } from "./marking";

const STORAGE_KEY = "aurahac.data.v1";
const CRED_KEY = "aurahac.cred.v1";
const THEME_KEY = "aurahac.theme.v2";
const DEMO_KEY = "aurahac.demo.v1";
const DONE_KEY = "aurahac.done.v1";
const EVENTS_KEY = "aurahac.events.v1";
const CUSTOM_KEY = "aurahac.coursecustom.v1";
const BELL_KEY = "aurahac.bell.v1";
const STREAK_KEY = "aurahac.streak.v1";

export type Theme =
  | "nebula"
  | "onyx"
  | "executive"
  | "arctic"
  | "titanium"
  | "phantom"
  | "genesis"
  | "platinum";
const THEMES: Theme[] = [
  "nebula",
  "onyx",
  "executive",
  "arctic",
  "titanium",
  "phantom",
  "genesis",
  "platinum",
];

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
  userEvents: UserEvent[];
  addEvent: (e: Omit<UserEvent, "id" | "reminded">) => void;
  removeEvent: (id: string) => void;
  notificationsEnabled: boolean;
  enableNotifications: () => Promise<boolean>;
  courseCustom: Record<string, CourseCustom>;
  setCourseCustom: (courseId: string, custom: CourseCustom) => void;
  bellRotation: BellRotation;
  setBellRotation: (b: BellRotation) => void;
  streak: StreakState;
  /** Record a daily check-in; `onTrack` decides if it extends the streak. */
  recordStreak: (onTrack: boolean) => void;
  activePeriod: MarkingPeriod;
  setActivePeriod: (p: MarkingPeriod) => void;
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
  const [userEvents, setUserEvents] = useState<UserEvent[]>([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [courseCustom, setCourseCustomState] = useState<Record<string, CourseCustom>>({});
  const [bellRotation, setBellRotationState] = useState<BellRotation>(defaultBellRotation());
  const [streak, setStreak] = useState<StreakState>(emptyStreak());
  const [activePeriod, setActivePeriod] = useState<MarkingPeriod>("MP4");
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Hydrate from localStorage once. Fall back to demo data so the app is
  // Hydrate from localStorage once. Show the login screen by default; restore a
  // live session, or a previously chosen demo session, when present.
  useEffect(() => {
    try {
      const t = localStorage.getItem(THEME_KEY);
      if (t && (THEMES as string[]).includes(t)) setThemeState(t as Theme);

      const done = localStorage.getItem(DONE_KEY);
      if (done) setCompleted(JSON.parse(done));

      const ev = localStorage.getItem(EVENTS_KEY);
      if (ev) setUserEvents(JSON.parse(ev));

      const cc = localStorage.getItem(CUSTOM_KEY);
      if (cc) setCourseCustomState(JSON.parse(cc));

      const bell = localStorage.getItem(BELL_KEY);
      if (bell) setBellRotationState({ ...defaultBellRotation(), ...JSON.parse(bell) });

      const sk = localStorage.getItem(STREAK_KEY);
      if (sk) setStreak({ ...emptyStreak(), ...JSON.parse(sk) });

      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        setNotificationsEnabled(true);
      }


      const d = localStorage.getItem(STORAGE_KEY);
      if (d) {
        setData(JSON.parse(d));
        const c = localStorage.getItem(CRED_KEY);
        if (c) {
          // Credentials are stored AES-GCM encrypted; decrypt in memory only.
          decryptJSON<Cred>(c)
            .then((cred) => setCred(cred))
            .catch(() => {
              // Legacy/plaintext or corrupted entry — drop it.
              try {
                localStorage.removeItem(CRED_KEY);
              } catch {
                /* ignore */
              }
            });
        }
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
      localStorage.setItem(CRED_KEY, await encryptJSON(c));
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

  function persistEvents(list: UserEvent[]) {
    try {
      localStorage.setItem(EVENTS_KEY, JSON.stringify(list));
    } catch {
      /* ignore */
    }
  }

  function fireReminder(e: UserEvent) {
    const verb = e.type === "exam" ? "Study for" : "Finish";
    const mins = e.minutes;
    const time = mins >= 60 ? `${Math.round((mins / 60) * 10) / 10}h` : `${mins}m`;
    const body = `${verb} "${e.title}"${e.course ? ` (${e.course})` : ""} · plan ~${time}`;
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification(e.type === "exam" ? "📚 Exam prep reminder" : "📝 Homework reminder", {
          body,
        });
      }
    } catch {
      /* ignore */
    }
    setUserEvents((prev) => {
      const next = prev.map((x) => (x.id === e.id ? { ...x, reminded: true } : x));
      persistEvents(next);
      return next;
    });
  }

  // Schedule reminder timers for all upcoming events.
  useEffect(() => {
    for (const t of Object.values(timers.current)) clearTimeout(t);
    timers.current = {};
    const now = Date.now();
    for (const e of userEvents) {
      if (!e.reminderAt || e.reminded) continue;
      const at = new Date(e.reminderAt).getTime();
      const delay = at - now;
      if (delay <= 0) {
        fireReminder(e);
      } else if (delay < 2 ** 31 - 1) {
        timers.current[e.id] = setTimeout(() => fireReminder(e), delay);
      }
    }
    return () => {
      for (const t of Object.values(timers.current)) clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEvents]);

  function addEvent(e: Omit<UserEvent, "id" | "reminded">) {
    setUserEvents((prev) => {
      const next = [...prev, { ...e, id: crypto.randomUUID(), reminded: false }];
      persistEvents(next);
      return next;
    });
  }

  function removeEvent(id: string) {
    setUserEvents((prev) => {
      const next = prev.filter((x) => x.id !== id);
      persistEvents(next);
      return next;
    });
  }

  async function enableNotifications() {
    if (typeof Notification === "undefined") return false;
    if (Notification.permission === "granted") {
      setNotificationsEnabled(true);
      return true;
    }
    try {
      const res = await Notification.requestPermission();
      const ok = res === "granted";
      setNotificationsEnabled(ok);
      return ok;
    } catch {
      return false;
    }
  }

  function setCourseCustom(courseId: string, custom: CourseCustom) {
    setCourseCustomState((prev) => {
      const next = { ...prev, [courseId]: custom };
      try {
        localStorage.setItem(CUSTOM_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function setBellRotation(b: BellRotation) {
    setBellRotationState(b);
    try {
      localStorage.setItem(BELL_KEY, JSON.stringify(b));
    } catch {
      /* ignore */
    }
  }

  function recordStreak(onTrack: boolean) {
    setStreak((prev) => {
      const { next } = recordCheckIn(prev, onTrack);
      try {
        localStorage.setItem(STREAK_KEY, JSON.stringify(next));
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
      userEvents,
      addEvent,
      removeEvent,
      notificationsEnabled,
      enableNotifications,
      courseCustom,
      setCourseCustom,
      bellRotation,
      setBellRotation,
      streak,
      recordStreak,
      activePeriod,
      setActivePeriod,
    }),
    [data, loading, error, cred, isFallback, theme, courseNav, completed, userEvents, notificationsEnabled, courseCustom, bellRotation, streak, activePeriod],
  );

  return <HacCtx.Provider value={value}>{children}</HacCtx.Provider>;
}

export function useHac() {
  const c = useContext(HacCtx);
  if (!c) throw new Error("useHac must be inside HacProvider");
  return c;
}