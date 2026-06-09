import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { mockCourses, mockSemesters } from "./mockData";
import type { Course, Semester, Tier } from "./types";
import { courseAverage, cumulativeGpa } from "./gpa";

type Theme = "obsidian" | "slate" | "matrix";

interface StoreShape {
  connected: boolean;
  connect: () => void;
  courses: Course[];
  semesters: Semester[];
  overrides: Record<string, number>;
  setOverride: (id: string, percent: number | null) => void;
  resetOverrides: () => void;
  tierOverrides: Record<string, Tier>;
  setTierOverride: (id: string, tier: Tier) => void;
  weighted: boolean;
  setWeighted: (v: boolean) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  studentName: string;
}

const Ctx = createContext<StoreShape | null>(null);

export function GradewayProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [tierOverrides, setTierOverrides] = useState<Record<string, Tier>>({});
  const [weighted, setWeighted] = useState(true);
  const [theme, setTheme] = useState<Theme>("obsidian");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const value: StoreShape = useMemo(
    () => ({
      connected,
      connect: () => setConnected(true),
      courses: mockCourses,
      semesters: mockSemesters,
      overrides,
      setOverride: (id, p) =>
        setOverrides((prev) => {
          const next = { ...prev };
          if (p === null) delete next[id];
          else next[id] = p;
          return next;
        }),
      resetOverrides: () => setOverrides({}),
      tierOverrides,
      setTierOverride: (id, t) => setTierOverrides((prev) => ({ ...prev, [id]: t })),
      weighted,
      setWeighted,
      theme,
      setTheme,
      studentName: "Alex Morgan",
    }),
    [connected, overrides, tierOverrides, weighted, theme],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGradeway() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useGradeway outside provider");
  return ctx;
}

export function useCourseRows() {
  const { courses, overrides, tierOverrides } = useGradeway();
  return courses.map((c) => {
    const tier = tierOverrides[c.id] ?? c.tier;
    const percent = courseAverage(c, overrides);
    return { course: c, tier, percent, credits: c.credits };
  });
}

export function useCumulativeGpa() {
  const { semesters } = useGradeway();
  const rows = useCourseRows();
  const past = semesters.flatMap((s) => s.courses);
  return cumulativeGpa(
    past,
    rows.map((r) => ({ percent: r.percent, tier: r.tier, credits: r.credits })),
  );
}