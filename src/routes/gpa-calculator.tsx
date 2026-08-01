import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Calculator } from "lucide-react";
import { MetricCards } from "@/components/gpacalc/MetricCards";
import { ImportPanel } from "@/components/gpacalc/ImportPanel";
import { CourseTable } from "@/components/gpacalc/CourseTable";
import { ScalePanel } from "@/components/gpacalc/ScalePanel";
import { WhatIf } from "@/components/gpacalc/WhatIf";
import { Charts } from "@/components/gpacalc/Charts";
import { useGpaStore } from "@/lib/gpacalc/store";
import { activeYearOf, computeGpa, resolveScale, yearsOf } from "@/lib/gpacalc/engine";
import type { GpaSettings } from "@/lib/gpacalc/types";

export const Route = createFileRoute("/gpa-calculator")({
  head: () => ({
    meta: [
      { title: "HAC GPA Calculator — Weighted & Unweighted" },
      {
        name: "description",
        content:
          "Paste grades from Home Access Center and get exact weighted, unweighted, 5.0 and Texas 6.0 GPA math, plus a what-if target calculator.",
      },
      { property: "og:title", content: "HAC GPA Calculator — Weighted & Unweighted" },
      {
        property: "og:description",
        content:
          "Credit-accurate GPA engine for high school students: HAC paste import, custom scales, charts, and target planning.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GpaCalculatorPage,
});

function GpaCalculatorPage() {
  const store = useGpaStore();
  const { courses, settings } = store;

  const scale = useMemo(
    () => resolveScale(settings.scale, settings.custom),
    [settings.scale, settings.custom],
  );
  const years = useMemo(() => yearsOf(courses), [courses]);
  const activeYear = useMemo(() => activeYearOf(courses, settings), [courses, settings]);

  const cumulative = useMemo(() => computeGpa(courses, scale), [courses, scale]);
  const current = useMemo(
    () => computeGpa(courses.filter((c) => c.year === activeYear), scale),
    [courses, activeYear, scale],
  );

  const patchSettings = (patch: Partial<GpaSettings>) =>
    store.setSettings((s) => ({ ...s, ...patch }));

  return (
    <main className="min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(60%_45%_at_50%_0%,var(--primary)_0%,transparent_65%)] opacity-20" />
      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl border border-border bg-card/70 backdrop-blur-xl">
              <Calculator className="size-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                GPA Calculator
              </h1>
              <p className="text-sm text-muted-foreground">
                Credit-exact weighted &amp; unweighted math, straight from your HAC grades.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex rounded-xl border border-border bg-card/70 p-1 backdrop-blur-xl">
              {(["points", "percent"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => patchSettings({ display: d })}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    settings.display === d
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {d === "points" ? "GPA points" : "100-point avg"}
                </button>
              ))}
            </div>
            <Link
              to="/"
              className="flex items-center gap-2 rounded-xl border border-border bg-card/70 px-3 py-2 text-sm text-muted-foreground backdrop-blur-xl transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4" /> Dashboard
            </Link>
          </div>
        </header>

        <div className="mt-8 space-y-6">
          <MetricCards
            cumulative={cumulative}
            current={current}
            scale={scale}
            display={settings.display}
            activeYear={activeYear}
          />

          <ScalePanel settings={settings} onChange={patchSettings} years={years} />

          <ImportPanel
            onImport={store.addCourses}
            onClear={store.clearCourses}
            activeYear={activeYear}
            count={courses.length}
          />

          <CourseTable
            courses={courses}
            scale={scale}
            onUpdate={store.updateCourse}
            onRemove={store.removeCourse}
          />

          <Charts courses={courses} scale={scale} />

          <WhatIf cumulative={cumulative} scale={scale} />

          <p className="pb-8 text-center text-xs text-muted-foreground">
            Everything stays in your browser's local storage — no account, no server.
          </p>
        </div>
      </div>
    </main>
  );
}
