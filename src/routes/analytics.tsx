import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/studygraph/AppLayout";
import { MasteryBar, Panel, SectionTitle, Sparkline, Stat } from "@/components/studygraph/ui";
import { useStudyGraph } from "@/lib/studygraph/store";
import { COURSE_BY_ID, conceptsForCourse } from "@/lib/studygraph/curriculum";
import {
  bottlenecks,
  courseMastery,
  forgettingRisk,
  recordFor,
  retention,
  statusBreakdown,
  timeToTarget,
} from "@/lib/studygraph/engine";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — StudyGraph" },
      {
        name: "description",
        content:
          "Mastery velocity, retention curves, accuracy by difficulty, unit heatmaps and prerequisite bottleneck analysis.",
      },
      { property: "og:title", content: "Analytics — StudyGraph" },
      {
        property: "og:description",
        content: "Deep progress analytics: velocity, retention, accuracy and bottlenecks.",
      },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { state } = useStudyGraph();
  const courseId = state.profile.courseId;
  const course = COURSE_BY_ID.get(courseId);
  const concepts = conceptsForCourse(courseId);
  const counts = statusBreakdown(state, courseId);
  const mastery = courseMastery(state, courseId);

  const last14 = Array.from({ length: 14 }, (_, i) => {
    const day = new Date(Date.now() - (13 - i) * 86_400_000).toISOString().slice(0, 10);
    return state.sessions
      .filter((s) => s.at.slice(0, 10) === day)
      .reduce((a, b) => a + b.minutes, 0);
  });

  const byDifficulty = [1, 2, 3, 4, 5].map((d) => {
    const rows = state.attempts.filter((a) => {
      return a.correct !== undefined && a.conceptId && d === difficultyOf(a.questionId);
    });
    const acc = rows.length ? rows.filter((r) => r.correct).length / rows.length : null;
    return { d, acc, n: rows.length };
  });

  const units = (course?.units ?? []).map((u) => {
    const list = concepts.filter((cpt) => cpt.unitId === u.id);
    const avg = list.length
      ? list.reduce((sum, cpt) => sum + retention(recordFor(state, cpt.id)), 0) / list.length
      : 0;
    return { ...u, avg, count: list.length };
  });

  const decaying = concepts
    .map((cpt) => ({ cpt, rec: recordFor(state, cpt.id) }))
    .filter((x) => x.rec.mastery > 0)
    .sort((a, b) => forgettingRisk(b.rec) - forgettingRisk(a.rec))
    .slice(0, 6);

  return (
    <AppLayout title="Analytics" subtitle={`${course?.name} · ${concepts.length} concepts tracked`}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Graph mastery" value={`${Math.round(mastery * 100)}%`} accent />
        <Stat label="Mastered nodes" value={`${counts.mastered}/${concepts.length}`} />
        <Stat
          label="Total study"
          value={`${Math.round(state.sessions.reduce((a, b) => a + b.minutes, 0) / 60)} h`}
        />
        <Stat label="Hours to target" value={Math.round(timeToTarget(state, courseId, state.profile.targetMastery) / 60)} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel className="p-6">
          <SectionTitle eyebrow="Momentum" title="Study minutes, last 14 days" />
          <div className="mt-5 flex h-32 items-end gap-1.5">
            {last14.map((m, i) => (
              <div
                key={i}
                className="accent-gradient flex-1 rounded-t-md"
                style={{ height: `${Math.max(4, (m / Math.max(...last14, 1)) * 100)}%` }}
                title={`${m} min`}
              />
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Peak {Math.max(...last14)} min · average{" "}
            {Math.round(last14.reduce((a, b) => a + b, 0) / last14.length)} min/day
          </p>
        </Panel>

        <Panel className="p-6">
          <SectionTitle eyebrow="Distribution" title="Mastery by status" />
          <div className="mt-4 space-y-3">
            {(
              [
                ["mastered", counts.mastered],
                ["strong", counts.strong],
                ["developing", counts.developing],
                ["weak", counts.weak],
                ["locked", counts.locked],
                ["unassessed", counts.unassessed],
              ] as const
            ).map(([key, value]) => (
              <div key={key}>
                <div className="flex justify-between text-xs">
                  <span className="capitalize text-muted-foreground">{key}</span>
                  <span className="tabular-nums">{value}</span>
                </div>
                <div className="mt-1.5">
                  <MasteryBar value={value / Math.max(concepts.length, 1)} />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="p-6">
          <SectionTitle eyebrow="Coverage" title="Unit heatmap" />
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {units.map((u) => (
              <div
                key={u.id}
                className="rounded-2xl border border-border p-3"
                style={{
                  background: `color-mix(in oklab, var(--primary) ${Math.round(u.avg * 26)}%, transparent)`,
                }}
              >
                <p className="text-sm font-medium">{u.name}</p>
                <p className="text-xs text-muted-foreground">
                  {Math.round(u.avg * 100)}% · {u.count} concepts
                </p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="p-6">
          <SectionTitle eyebrow="Calibration" title="Accuracy by difficulty" />
          <div className="mt-4 space-y-3">
            {byDifficulty.map((row) => (
              <div key={row.d}>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Level {row.d}</span>
                  <span>{row.acc === null ? "no data" : `${Math.round(row.acc * 100)}% (${row.n})`}</span>
                </div>
                <div className="mt-1.5">
                  <MasteryBar value={row.acc ?? 0} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Healthy adaptive practice sits near 70–80% at your working difficulty.
          </p>
        </Panel>

        <Panel className="p-6">
          <SectionTitle eyebrow="Retention" title="Fastest decaying concepts" />
          <div className="mt-4 space-y-3">
            {decaying.map(({ cpt, rec }) => (
              <div key={cpt.id} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{cpt.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {Math.round(retention(rec) * 100)}% now · {Math.round(forgettingRisk(rec) * 100)}% lost
                  </p>
                </div>
                <Sparkline points={rec.history.map((h) => h.mastery)} />
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="p-6">
          <SectionTitle eyebrow="Structure" title="Prerequisite bottlenecks" />
          <div className="mt-4 space-y-2">
            {bottlenecks(state, courseId).map((b) => (
              <div key={b.concept.id} className="rounded-xl border border-border px-3 py-2">
                <p className="text-sm font-medium">{b.concept.name}</p>
                <p className="text-xs text-muted-foreground">
                  Blocks {b.blocked} concept{b.blocked > 1 ? "s" : ""} · {Math.round(b.mastery * 100)}% retained
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </AppLayout>
  );
}

function difficultyOf(questionId: string) {
  const parts = questionId.split("-");
  const n = Number(parts[parts.length - 3]);
  return isFinite(n) ? n : 3;
}
