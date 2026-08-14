import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CalendarDays, Clock } from "lucide-react";
import { AppLayout } from "@/components/studygraph/AppLayout";
import { GhostButton, Panel, PrimaryButton, SectionTitle, Stat } from "@/components/studygraph/ui";
import { useStudyGraph } from "@/lib/studygraph/store";
import { CONCEPT_BY_ID, COURSE_BY_ID } from "@/lib/studygraph/curriculum";
import { buildPlan, projectMastery, timeToTarget } from "@/lib/studygraph/engine";

export const Route = createFileRoute("/planner")({
  head: () => ({
    meta: [
      { title: "Study Planner — StudyGraph" },
      {
        name: "description",
        content:
          "Generate a session plan that fits your available minutes, balancing new concepts, practice and spaced review.",
      },
      { property: "og:title", content: "Study Planner — StudyGraph" },
      {
        property: "og:description",
        content: "Time-boxed study plans balancing new learning and review, tied to your exam date.",
      },
    ],
  }),
  component: PlannerPage,
});

function PlannerPage() {
  const { state, logStudy } = useStudyGraph();
  const courseId = state.profile.courseId;
  const course = COURSE_BY_ID.get(courseId);
  const [minutes, setMinutes] = useState(60);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const plan = useMemo(() => buildPlan(state, courseId, minutes), [state, courseId, minutes]);
  const projection = projectMastery(state, courseId, state.profile.weeklyMinutes);

  const examDays = course?.examDate
    ? Math.max(0, Math.round((new Date(course.examDate).getTime() - Date.now()) / 86_400_000))
    : null;

  return (
    <AppLayout title="Study Planner" subtitle="Time-boxed sessions built from your graph">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Days to exam" value={examDays ?? "—"} hint={course?.examDate ?? "No exam set"} accent />
        <Stat label="Weekly goal" value={`${state.profile.weeklyMinutes} min`} />
        <Stat label="Work to target" value={`${Math.round(timeToTarget(state, courseId, state.profile.targetMastery) / 60)} h`} />
        <Stat label="Projected" value={`${projection.weeksToTarget} wks`} hint="to 90% mastery" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_340px]">
        <Panel className="p-6">
          <SectionTitle
            eyebrow="Today"
            title="Your session"
            action={
              <span className="text-xs text-muted-foreground">
                <Clock className="mr-1 inline h-3.5 w-3.5" />
                {plan.reduce((a, b) => a + b.minutes, 0)} min
              </span>
            }
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {[25, 45, 60, 90, 120].map((m) => (
              <GhostButton key={m} active={m === minutes} onClick={() => setMinutes(m)}>
                {m} min
              </GhostButton>
            ))}
          </div>

          <ol className="mt-5 space-y-2">
            {plan.map((item, i) => {
              const key = `${item.label}-${i}`;
              const complete = done[key];
              return (
                <li
                  key={key}
                  className={`glass-soft flex items-center gap-3 rounded-2xl px-4 py-3 ${
                    complete ? "opacity-55" : ""
                  }`}
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-border text-xs">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-medium ${complete ? "line-through" : ""}`}>
                      {item.label}
                    </p>
                    <p className="text-xs capitalize text-muted-foreground">
                      {item.kind} · {item.minutes} min
                    </p>
                  </div>
                  {item.conceptId ? (
                    <Link
                      to={item.kind === "practice" ? "/practice" : "/learn"}
                      search={{ concept: item.conceptId }}
                      className="shrink-0 rounded-lg border border-border px-2.5 py-1 text-[11px] hover:bg-secondary"
                    >
                      Open
                    </Link>
                  ) : null}
                  <button
                    onClick={() => {
                      setDone((d) => ({ ...d, [key]: !d[key] }));
                      if (!complete && item.conceptId) logStudy(item.conceptId, item.minutes, item.kind === "review" ? "review" : "practice");
                    }}
                    className="shrink-0 rounded-lg border border-border px-2.5 py-1 text-[11px] hover:bg-secondary"
                  >
                    {complete ? "Undo" : "Done"}
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="mt-5">
            <PrimaryButton onClick={() => setDone({})}>Reset session</PrimaryButton>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel className="p-5">
            <SectionTitle eyebrow="Projection" title="Mastery over time" />
            <svg viewBox="0 0 260 110" className="mt-4 w-full">
              <polyline
                fill="none"
                stroke="var(--primary)"
                strokeWidth="2.5"
                strokeLinecap="round"
                points={projection.points
                  .map((p, i) => `${(i / (projection.points.length - 1)) * 250 + 5},${100 - p.mastery * 90}`)
                  .join(" ")}
              />
              <line x1="5" y1="19" x2="255" y2="19" stroke="var(--border)" strokeDasharray="4 4" />
              <text x="5" y="14" fontSize="8" fill="var(--muted-foreground)">
                90% target
              </text>
            </svg>
            <p className="mt-2 text-xs text-muted-foreground">
              At {state.profile.weeklyMinutes} min/week you reach 90% mastery in about{" "}
              {projection.weeksToTarget} weeks.
            </p>
          </Panel>

          <Panel className="p-5">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Exam countdown</p>
            </div>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{examDays ?? "—"}</p>
            <p className="text-xs text-muted-foreground">days until {course?.name} exam</p>
            <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
              {buildPlan(state, courseId, 240)
                .filter((p) => p.conceptId)
                .slice(0, 4)
                .map((p) => (
                  <p key={p.label}>• {CONCEPT_BY_ID.get(p.conceptId!)?.name}</p>
                ))}
            </div>
          </Panel>
        </div>
      </div>
    </AppLayout>
  );
}
