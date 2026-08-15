import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  BellRing,
  CalendarRange,
  ChevronRight,
  GraduationCap,
  LineChart,
  MessagesSquare,
  Moon,
  RotateCcw,
  Sun,
  Target,
} from "lucide-react";
import { AppLayout } from "@/components/studygraph/AppLayout";
import { Panel, SectionTitle } from "@/components/studygraph/ui";
import { Sheet } from "@/components/studygraph/Sheet";
import { useStudyGraph } from "@/lib/studygraph/store";
import { COURSES, COURSE_BY_ID } from "@/lib/studygraph/curriculum";
import { courseMastery } from "@/lib/studygraph/engine";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — StudyGraph" },
      {
        name: "description",
        content:
          "Your course, study goals, notification preferences and everything StudyGraph knows about your learning.",
      },
      { property: "og:title", content: "Profile — StudyGraph" },
      {
        property: "og:description",
        content: "Manage your course, goals, appearance and notifications in StudyGraph.",
      },
    ],
  }),
  component: ProfilePage,
});

const SHORTCUTS = [
  { to: "/practice", label: "Practice", detail: "Adaptive question sets", icon: Target },
  { to: "/planner", label: "Planner", detail: "Fit study into your day", icon: CalendarRange },
  { to: "/coach", label: "AI Coach", detail: "Ask about your graph", icon: MessagesSquare },
  { to: "/analytics", label: "Analytics", detail: "Velocity and retention", icon: LineChart },
  { to: "/subjects", label: "Subjects", detail: "Browse the catalogue", icon: GraduationCap },
] as const;

function ProfilePage() {
  const { state, setProfile, resetProgress, loadDemo } = useStudyGraph();
  const [coursesOpen, setCoursesOpen] = useState(false);
  const course = COURSE_BY_ID.get(state.profile.courseId);
  const mastery = courseMastery(state, state.profile.courseId);
  const initials = (state.profile.name || "You")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");

  return (
    <AppLayout title="Profile" subtitle="Goals, preferences and everything else">
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <Panel className="p-5">
          <div className="flex min-w-0 items-center gap-4">
            <div className="accent-gradient grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-lg font-semibold text-primary-foreground">
              {initials.toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <input
                value={state.profile.name}
                onChange={(e) => setProfile({ name: e.target.value })}
                placeholder="Your name"
                aria-label="Your name"
                className="w-full truncate bg-transparent text-lg font-semibold tracking-tight outline-none"
              />
              <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
                {course?.name} · {Math.round(mastery * 100)}% mastery ·{" "}
                {state.streak.current} day streak
              </p>
            </div>
          </div>
        </Panel>

        <Panel className="p-5">
          <SectionTitle eyebrow="Course" title="What you're studying" />
          <button
            onClick={() => setCoursesOpen(true)}
            className="mt-3 flex w-full items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3.5 text-left transition-colors hover:bg-secondary"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{course?.name ?? "Choose a course"}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {course?.examDate
                  ? `Exam ${new Date(`${course.examDate}T00:00:00Z`).toLocaleDateString(undefined, { month: "long", day: "numeric" })}`
                  : "No exam date set"}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>

          <div className="mt-4 space-y-4">
            <Field
              label="Target mastery"
              value={`${Math.round(state.profile.targetMastery * 100)}%`}
            >
              <input
                type="range"
                min={60}
                max={100}
                step={5}
                value={Math.round(state.profile.targetMastery * 100)}
                onChange={(e) => setProfile({ targetMastery: Number(e.target.value) / 100 })}
                className="w-full accent-[var(--primary)]"
                aria-label="Target mastery"
              />
            </Field>
            <Field label="Weekly study time" value={`${state.profile.weeklyMinutes} min`}>
              <input
                type="range"
                min={60}
                max={900}
                step={30}
                value={state.profile.weeklyMinutes}
                onChange={(e) => setProfile({ weeklyMinutes: Number(e.target.value) })}
                className="w-full accent-[var(--primary)]"
                aria-label="Weekly study minutes"
              />
            </Field>
          </div>
        </Panel>

        <Panel className="p-2">
          <ul className="divide-y divide-border">
            {SHORTCUTS.map((s) => {
              const Icon = s.icon;
              return (
                <li key={s.to}>
                  <Link
                    to={s.to}
                    className="flex min-h-[56px] items-center gap-3 rounded-2xl px-3 py-3 transition-colors hover:bg-secondary"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-secondary">
                      <Icon className="h-4 w-4 text-primary" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{s.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {s.detail}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel className="p-5">
          <SectionTitle eyebrow="Appearance" title="Theme" />
          <div className="mt-3 grid grid-cols-3 gap-2">
            {(["dark", "light", "system"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setProfile({ theme: t })}
                className={`flex min-h-[44px] items-center justify-center gap-2 rounded-xl border px-3 text-sm capitalize transition-colors ${
                  state.profile.theme === t
                    ? "border-primary bg-secondary text-foreground"
                    : "border-border text-muted-foreground hover:bg-secondary"
                }`}
              >
                {t === "dark" ? <Moon className="h-4 w-4" /> : t === "light" ? <Sun className="h-4 w-4" /> : null}
                {t}
              </button>
            ))}
          </div>
        </Panel>

        <Panel className="p-5">
          <SectionTitle eyebrow="Notifications" title="What we'll remind you about" />
          <div className="mt-3 space-y-1">
            {(
              [
                ["reviews", "Reviews due", "When retention starts to fade"],
                ["study", "Daily study reminder", "One nudge a day, never more"],
                ["exams", "Exam approaching", "Milestone checkpoints only"],
                ["milestones", "Mastery milestones", "When a concept reaches mastery"],
              ] as const
            ).map(([key, label, detail]) => (
              <label
                key={key}
                className="flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl px-1"
              >
                <BellRing className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{detail}</span>
                </span>
                <input
                  type="checkbox"
                  checked={state.profile.notifications[key]}
                  onChange={(e) =>
                    setProfile({
                      notifications: { ...state.profile.notifications, [key]: e.target.checked },
                    })
                  }
                  className="h-5 w-5 shrink-0 accent-[var(--primary)]"
                />
              </label>
            ))}
          </div>
        </Panel>

        <Panel className="p-5">
          <SectionTitle eyebrow="Data" title="Your learning record" />
          <p className="mt-2 text-[13px] text-muted-foreground">
            StudyGraph stores your graph on this device. Resetting clears mastery, attempts and
            review history — it cannot be undone.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={loadDemo}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-border px-4 text-sm font-medium transition-colors hover:bg-secondary"
            >
              <RotateCcw className="h-4 w-4" />
              Reload demo data
            </button>
            <button
              onClick={resetProgress}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-destructive/40 px-4 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
            >
              Reset my progress
            </button>
          </div>
        </Panel>
      </div>

      <Sheet
        open={coursesOpen}
        onClose={() => setCoursesOpen(false)}
        eyebrow="Switch course"
        title="Choose what to map"
      >
        <div className="space-y-2 pt-1">
          {COURSES.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setProfile({ courseId: c.id });
                setCoursesOpen(false);
              }}
              className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left transition-colors ${
                state.profile.courseId === c.id
                  ? "border-primary bg-secondary"
                  : "border-border hover:bg-secondary"
              }`}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{c.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {c.units.length} units · {Math.round(courseMastery(state, c.id) * 100)}% mastery
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      </Sheet>
    </AppLayout>
  );
}

function Field({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums">{value}</span>
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}
