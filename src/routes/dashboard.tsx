import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Brain, Flame, Target, TriangleAlert } from "lucide-react";
import { AppLayout } from "@/components/studygraph/AppLayout";
import { Dial, MasteryBar, Panel, SectionTitle, Stat, StatusPill } from "@/components/studygraph/ui";
import { useStudyGraph } from "@/lib/studygraph/store";
import { CONCEPT_BY_ID, COURSE_BY_ID } from "@/lib/studygraph/curriculum";
import {
  bottlenecks,
  courseMastery,
  dueForReview,
  forgettingRisk,
  recommend,
  recordFor,
  retention,
  statusBreakdown,
  statusOf,
  timeToTarget,
} from "@/lib/studygraph/engine";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — StudyGraph" },
      {
        name: "description",
        content:
          "Your live mastery snapshot: the highest-impact concept to study next, prerequisite bottlenecks, and reviews due today.",
      },
      { property: "og:title", content: "Dashboard — StudyGraph" },
      {
        property: "og:description",
        content: "Live mastery, next best action, bottlenecks and due reviews in one view.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { state } = useStudyGraph();
  const courseId = state.profile.courseId;
  const course = COURSE_BY_ID.get(courseId);
  const mastery = courseMastery(state, courseId);
  const recs = recommend(state, courseId, 4);
  const due = dueForReview(state, courseId).slice(0, 5);
  const blocks = bottlenecks(state, courseId);
  const counts = statusBreakdown(state, courseId);
  const minutes = timeToTarget(state, courseId, state.profile.targetMastery);
  const top = recs[0];
  const topConcept = top ? CONCEPT_BY_ID.get(top.conceptId) : null;

  const weekMinutes = state.sessions
    .filter((s) => Date.now() - new Date(s.at).getTime() < 7 * 86_400_000)
    .reduce((a, b) => a + b.minutes, 0);

  return (
    <AppLayout
      title={`Welcome back${state.profile.name ? `, ${state.profile.name.split(" ")[0]}` : ""}`}
      subtitle={`${course?.name ?? "No course"} · ${Object.values(counts).reduce((a, b) => a + b, 0)} concepts mapped`}
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2 p-6">
          <SectionTitle eyebrow="Next best action" title={topConcept?.name ?? "All caught up"} />
          {top && topConcept ? (
            <>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {topConcept.summary}
              </p>
              <ul className="mt-4 space-y-2">
                {top.reasons.map((r) => (
                  <li key={r} className="flex items-start gap-2 text-sm">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span className="text-muted-foreground">{r}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <Link
                  to="/learn"
                  search={{ concept: top.conceptId }}
                  className="accent-gradient inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-primary-foreground"
                >
                  Start {top.minutes} min session
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/practice"
                  search={{ concept: top.conceptId }}
                  className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-secondary"
                >
                  <Target className="h-4 w-4" />
                  Practice instead
                </Link>
                <Link
                  to="/graph"
                  search={{ concept: top.conceptId }}
                  className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-secondary"
                >
                  View on graph
                </Link>
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Nothing urgent — every concept is above target retention. Run a mixed review to keep
              it that way.
            </p>
          )}
        </Panel>

        <Panel className="flex flex-col items-center justify-center gap-3 p-6">
          <Dial value={mastery} label="Graph mastery" sublabel={`target ${Math.round(state.profile.targetMastery * 100)}%`} />
          <div className="grid w-full grid-cols-2 gap-2 text-center text-xs">
            <div className="glass-soft rounded-xl px-2 py-2">
              <p className="text-muted-foreground">Mastered</p>
              <p className="text-base font-semibold">{counts.mastered}</p>
            </div>
            <div className="glass-soft rounded-xl px-2 py-2">
              <p className="text-muted-foreground">Weak / locked</p>
              <p className="text-base font-semibold">{counts.weak + counts.locked}</p>
            </div>
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Study streak" value={`${state.streak.current} days`} hint={`Longest ${state.streak.longest}`} accent />
        <Stat label="This week" value={`${weekMinutes} min`} hint={`Goal ${state.profile.weeklyMinutes} min`} />
        <Stat label="Reviews due" value={due.length} hint="Retention dropping" />
        <Stat label="To target" value={`${Math.round(minutes / 60)} h`} hint="Estimated focused work" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel className="p-6">
          <SectionTitle
            eyebrow="Priority queue"
            title="What to study next"
            action={
              <Link to="/planner" className="text-xs text-primary hover:underline">
                Build a plan
              </Link>
            }
          />
          <div className="mt-4 space-y-3">
            {recs.map((rec) => {
              const concept = CONCEPT_BY_ID.get(rec.conceptId)!;
              const r = retention(recordFor(state, rec.conceptId));
              return (
                <Link
                  key={rec.conceptId}
                  to="/learn"
                  search={{ concept: rec.conceptId }}
                  className="glass-soft block rounded-2xl p-4 transition-transform hover:-translate-y-0.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{concept.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{rec.headline}</p>
                    </div>
                    <StatusPill status={statusOf(state, concept)} />
                  </div>
                  <div className="mt-3">
                    <MasteryBar value={r} />
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {Math.round(r * 100)}% retained · {rec.minutes} min · unlocks {rec.unlocks}
                  </p>
                </Link>
              );
            })}
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel className="p-6">
            <SectionTitle eyebrow="Root cause" title="Prerequisite bottlenecks" />
            <div className="mt-4 space-y-3">
              {blocks.length ? (
                blocks.map((b) => (
                  <Link
                    key={b.concept.id}
                    to="/learn"
                    search={{ concept: b.concept.id }}
                    className="flex items-center gap-3 rounded-2xl border border-border px-4 py-3 transition-colors hover:bg-secondary"
                  >
                    <TriangleAlert className="h-4 w-4 shrink-0 text-warning" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{b.concept.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Blocking {b.blocked} concept{b.blocked > 1 ? "s" : ""} · {Math.round(b.mastery * 100)}% retained
                      </p>
                    </div>
                  </Link>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No blocking gaps detected.</p>
              )}
            </div>
          </Panel>

          <Panel className="p-6">
            <SectionTitle
              eyebrow="Spaced repetition"
              title="Due for review"
              action={
                <Link to="/review" className="text-xs text-primary hover:underline">
                  Review all
                </Link>
              }
            />
            <div className="mt-4 space-y-2">
              {due.length ? (
                due.map((d) => (
                  <div
                    key={d.concept.id}
                    className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Brain className="h-4 w-4 shrink-0 text-primary" />
                      <span className="truncate">{d.concept.name}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {Math.round(forgettingRisk(d.rec) * 100)}% decayed
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Nothing due. Retention is holding.</p>
              )}
            </div>
          </Panel>

          <Panel className="flex items-center gap-4 p-6">
            <Flame className="h-6 w-6 text-warning" />
            <div>
              <p className="text-sm font-semibold">
                {state.achievements.filter((a) => a.unlockedAt).length} achievements unlocked
              </p>
              <p className="text-xs text-muted-foreground">
                Next: {state.achievements.find((a) => !a.unlockedAt)?.name ?? "All done"}
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </AppLayout>
  );
}
