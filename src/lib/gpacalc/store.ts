import { useCallback, useEffect, useState } from "react";
import { DEFAULT_SETTINGS, type GpaCourse, type GpaSettings } from "./types";

const COURSES_KEY = "gpacalc.courses.v1";
const SETTINGS_KEY = "gpacalc.settings.v1";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as object) } as T;
  } catch {
    return fallback;
  }
}

function readArray<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

/** localStorage-backed GPA calculator state (hydration-safe). */
export function useGpaStore() {
  const [hydrated, setHydrated] = useState(false);
  const [courses, setCourses] = useState<GpaCourse[]>([]);
  const [settings, setSettings] = useState<GpaSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    setCourses(readArray<GpaCourse>(COURSES_KEY));
    setSettings(read<GpaSettings>(SETTINGS_KEY, DEFAULT_SETTINGS));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(COURSES_KEY, JSON.stringify(courses));
  }, [courses, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings, hydrated]);

  const updateCourse = useCallback((id: string, patch: Partial<GpaCourse>) => {
    setCourses((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);

  const removeCourse = useCallback((id: string) => {
    setCourses((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const addCourses = useCallback((next: GpaCourse[]) => {
    setCourses((prev) => [...prev, ...next]);
  }, []);

  const clearCourses = useCallback(() => setCourses([]), []);

  return {
    hydrated,
    courses,
    setCourses,
    settings,
    setSettings,
    updateCourse,
    removeCourse,
    addCourses,
    clearCourses,
  };
}
