import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { HacData, DistrictId, UserEvent, CourseCustom, BellRotation } from "./types";
import { getFallbackData } from "./mockData";
import { bellRotationFromHac, defaultBellRotation } from "./customize";
import {
  encryptJSON,
  decryptJSON,
  encryptForExport,
  decryptFromImport,
  hasPin as vaultHasPin,
  isUnlocked as vaultUnlocked,
  setPin as vaultSetPin,
  removePin as vaultRemovePin,
  unlockWithPin as vaultUnlock,
  lockVault,
} from "./secureStore";
import { emptyStreak, recordCheckIn, type StreakState } from "./streaks";
import type { MarkingPeriod } from "./marking";
import {
  academicYearLabel,
  emptyLedger,
  lockThrough,
  mergeSync,
  type GradeLedger,
} from "./history";
import { emptyProfile, type StudentProfile } from "./profile";

const STORAGE_KEY = "aurahac.data.v2";
const LEGACY_STORAGE_KEY = "aurahac.data.v1";
const LEDGER_KEY = "aurahac.ledger.v1";
const PROFILE_KEY = "aurahac.profile.v1";
const CRED_KEY = "aurahac.cred.v1";
const DATA_VERSION_KEY = "aurahac.data.version.v1";
const THEME_KEY = "aurahac.theme.v2";
const DEMO_KEY = "aurahac.demo.v1";
const DONE_KEY = "aurahac.done.v1";
const EVENTS_KEY = "aurahac.events.v1";
const CUSTOM_KEY = "aurahac.coursecustom.v1";
const BELL_KEY = "aurahac.bell.v1";
const STREAK_KEY = "aurahac.streak.v1";
const DATA_SCHEMA_VERSION = 8;

export type SaveState = "idle" | "saving" | "saved";


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

  /* --- Encrypted vault --- */
  /** True when a Master PIN is configured but the vault has not been unlocked. */
  locked: boolean;
  hasPin: boolean;
  unlock: (pin: string) => Promise<void>;
  setPin: (pin: string) => Promise<void>;
  clearPin: (pin: string) => Promise<void>;
  saveState: SaveState;
  exportBackup: (passphrase: string) => Promise<void>;
  importBackup: (file: File, passphrase: string) => Promise<void>;

  /* --- Marking-period ledger --- */
  ledger: GradeLedger;
  academicYear: string;

  /* --- Student profile --- */
  profile: StudentProfile;
  setProfile: (p: StudentProfile) => void;
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
  const [activePeriod, setActivePeriodState] = useState<MarkingPeriod>("MP4");
  const [locked, setLocked] = useState(false);
  const [hasPinState, setHasPinState] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [ledger, setLedger] = useState<GradeLedger>(emptyLedger());
  const [profile, setProfileState] = useState<StudentProfile>(emptyProfile());
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Flash the "Data Encrypted & Saved" indicator. */
  function flashSaved() {
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setSaveState("saved");
      saveTimer.current = setTimeout(() => setSaveState("idle"), 2200);
    }, 260);
  }

  /** Persist grade data + ledger AES-256-GCM encrypted. */
  async function persistSecure(d: HacData | null, l: GradeLedger) {
    try {
      if (d) {
        localStorage.setItem(STORAGE_KEY, await encryptJSON(d));
        localStorage.setItem(DATA_VERSION_KEY, String(DATA_SCHEMA_VERSION));
      }
      localStorage.setItem(LEDGER_KEY, await encryptJSON(l));
      flashSaved();
    } catch {
      /* storage unavailable */
    }
  }

  /** Fold a fresh sync into the persistent marking-period ledger. */
  function absorb(d: HacData): GradeLedger {
    const next = mergeSync(ledger, d, activePeriod);
    setLedger(next);
    return next;
  }


  // Hydrate from localStorage once. Non-sensitive preferences load synchronously;
  // grade data + credentials live in the AES-256-GCM vault and load after it is
  // unlocked (immediately when no Master PIN is set).
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

      const pf = localStorage.getItem(PROFILE_KEY);
      if (pf) setProfileState({ ...emptyProfile(), ...JSON.parse(pf) });

      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        setNotificationsEnabled(true);
      }

      // Legacy plaintext cache from before the vault — drop it.
      localStorage.removeItem(LEGACY_STORAGE_KEY);

      const pinned = vaultHasPin();
      setHasPinState(pinned);
      if (pinned && !vaultUnlocked()) {
        setLocked(true);
        return;
      }
      void loadVault();
    } catch {
      /* show login screen */
    }
  }, []);

  /** Read the encrypted grade ledger + credentials out of local storage. */
  async function loadVault() {
    try {
      const lg = localStorage.getItem(LEDGER_KEY);
      if (lg) setLedger({ ...emptyLedger(), ...(await decryptJSON<GradeLedger>(lg)) });
    } catch {
      /* corrupt ledger — start fresh */
    }
    try {
      const c = localStorage.getItem(CRED_KEY);
      if (c) setCred(await decryptJSON<Cred>(c));
    } catch {
      try {
        localStorage.removeItem(CRED_KEY);
      } catch {
        /* ignore */
      }
    }
    try {
      const version = Number(localStorage.getItem(DATA_VERSION_KEY) ?? "0");
      const d = localStorage.getItem(STORAGE_KEY);
      if (d && version === DATA_SCHEMA_VERSION) {
        setData(await decryptJSON<HacData>(d));
        return;
      }
      if (d) localStorage.removeItem(STORAGE_KEY);
      if (localStorage.getItem(DEMO_KEY)) {
        setData(getFallbackData());
        setIsFallback(true);
      }
    } catch {
      /* fall through to login */
    }
  }


  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // If credentials were restored but cached data is missing (e.g. cleared by a
  // schema-version bump), auto-resync so the user never lands on a blank shell.
  const didAutoSync = useRef(false);
  useEffect(() => {
    if (cred && !data && !loading && !didAutoSync.current) {
      didAutoSync.current = true;
      void refresh();
    }
  }, [cred, data, loading]);

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
      if (!localStorage.getItem(BELL_KEY)) {
        const hacBell = bellRotationFromHac(d);
        setBellRotationState(hacBell);
        localStorage.setItem(BELL_KEY, JSON.stringify(hacBell));
      }
      localStorage.setItem(CRED_KEY, await encryptJSON(c));
      await persistSecure(d, absorb(d));

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
      localStorage.removeItem(DATA_VERSION_KEY);
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
      await persistSecure(d, absorb(d));
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
      localStorage.removeItem(DATA_VERSION_KEY);
      localStorage.removeItem(CRED_KEY);
      localStorage.removeItem(DEMO_KEY);
    } catch {
      /* ignore */
    }
  }

  /* ---------------- Vault: PIN, lock, backups ---------------- */

  async function unlock(pin: string) {
    await vaultUnlock(pin);
    if (!vaultUnlocked()) throw new Error("Incorrect PIN");
    await loadVault();
    setLocked(false);
  }

  async function setPin(pin: string) {
    await vaultSetPin(pin);
    setHasPinState(true);
    await persistSecure(data, ledger);
  }

  async function clearPin(pin: string) {
    await vaultRemovePin(pin);
    setHasPinState(false);
  }

  async function exportBackup(passphrase: string) {
    const payload = {
      exportedAt: new Date().toISOString(),
      schema: DATA_SCHEMA_VERSION,
      data,
      ledger,
      profile,
      userEvents,
      courseCustom,
      bellRotation,
      streak,
      completed,
    };
    const blob = new Blob([await encryptForExport(payload, passphrase)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aurahac-backup-${new Date().toISOString().slice(0, 10)}.aurahac`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importBackup(file: File, passphrase: string) {
    const text = await file.text();
    const payload = await decryptFromImport<{
      data: HacData | null;
      ledger: GradeLedger;
      profile: StudentProfile;
      userEvents: UserEvent[];
      courseCustom: Record<string, CourseCustom>;
      bellRotation: BellRotation;
      streak: StreakState;
      completed: Record<string, boolean>;
    }>(text, passphrase);

    if (payload.data) {
      setData(payload.data);
      setIsFallback(false);
    }
    const nextLedger = { ...emptyLedger(), ...(payload.ledger ?? {}) };
    setLedger(nextLedger);
    if (payload.profile) setProfile({ ...emptyProfile(), ...payload.profile });
    if (payload.userEvents) {
      setUserEvents(payload.userEvents);
      persistEvents(payload.userEvents);
    }
    if (payload.courseCustom) {
      setCourseCustomState(payload.courseCustom);
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(payload.courseCustom));
    }
    if (payload.bellRotation) setBellRotation(payload.bellRotation);
    if (payload.streak) {
      setStreak(payload.streak);
      localStorage.setItem(STREAK_KEY, JSON.stringify(payload.streak));
    }
    if (payload.completed) {
      setCompleted(payload.completed);
      localStorage.setItem(DONE_KEY, JSON.stringify(payload.completed));
    }
    await persistSecure(payload.data ?? data, nextLedger);
  }

  /** Switching the active marking period locks everything before it. */
  function setActivePeriod(p: MarkingPeriod) {
    setActivePeriodState(p);
    setLedger((prev) => {
      const next = lockThrough(prev, p);
      void persistSecure(null, next);
      return next;
    });
  }

  function setProfile(p: StudentProfile) {
    setProfileState(p);
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
    } catch {
      /* ignore */
    }
    flashSaved();
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
      locked,
      hasPin: hasPinState,
      unlock,
      setPin,
      clearPin,
      saveState,
      exportBackup,
      importBackup,
      ledger,
      academicYear: academicYearLabel(data?.syncedAt),
      profile,
      setProfile,
    }),
    [data, loading, error, cred, isFallback, theme, courseNav, completed, userEvents, notificationsEnabled, courseCustom, bellRotation, streak, activePeriod, locked, hasPinState, saveState, ledger, profile],

  );

  return <HacCtx.Provider value={value}>{children}</HacCtx.Provider>;
}

export function useHac() {
  const c = useContext(HacCtx);
  if (!c) throw new Error("useHac must be inside HacProvider");
  return c;
}