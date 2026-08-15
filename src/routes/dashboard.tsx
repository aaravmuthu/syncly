import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarRange,
  Clock,
  Info,
  MessagesSquare,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { AppLayout } from "@/components/studygraph/AppLayout";
import { MasteryBar, Panel, SectionTitle, Sparkline, StatusPill } from "@/components/studygraph/ui";
import { Sheet } from "@/components/studygraph/Sheet";
import { useStudyGraph } from "@/lib/studygraph/store";
import { CONCEPT_BY_ID, COURSE_BY_ID, conceptsForCourse } from "@/lib/studygraph/curriculum";
import {
  buildPlan,
  courseMastery,
  dueForReview,
  forgettingRisk,
  recommend,
  recordFor,
  retention,
  statusOf,
} from "@/lib/studygraph/engine";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Home — StudyGraph" },
      {
        name: "description",
        content:
          "Your next best action, today's plan, what's fading and how ready you are for the exam — in one screen.",
      },
      { property: "og:title", content: "Home — StudyGraph" },
      {
        property: "og:description",
        content: "The single screen that answers: what should I study right now?",
      },
    ],
  }),
  component: HomePage,
});

const DAY = 86_400_000;

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function HomePage() {
  const { state } = useStudyGraph();
  const [whyOpen, setWhyOpen] = useState(false);
  const courseId = state.profile.courseId;
  const course = COURSE_BY_ID.get(courseId);

  const recs = useMemo(() => recommend(state, courseId, 5), [state, courseId]);
  const top = recs[0];
  const topConcept = top ? CONCEPT_BY_ID.get(top.conceptId) : null;
  const mastery = courseMastery(state, courseId);
  const due = useMemo(() => dueForReview(state, courseId), [state, courseId]);
  const plan = useMemo(() => buildPlan(state, courseId, 25), [state, courseId]);

  const daysToExam = course?.examDate
    ? Math.max(0, Math.round((new Date(`${course.examDate}T00:00:00Z`).getTime() - Date.now()) / DAY))
    : null;

  const pool = conceptsForCourse(courseId);
  const ranked = pool
    .map((c) => ({ c, r: retention(recordFor(state, c.id)) }))
    .sort((a, b) => b.r - a.r);
  const strongest = ranked[0];
  const biggestGap = [...ranked]
    .filter((x) => x.c.importance >= 3)
    .sort((a, b) => a.r - b.r)[0];

  const weekDelta = useMemo(() => {
    let now = 0;
    let then = 0;
    let n = 0;
    for (const c of pool) {
      const rec = recordFor(state, c.id);
      if (!rec.history.length) continue;
      const past = rec.history.filter((h) => Date.now() - new Date(h.at).getTime() > 7 * DAY);
      now += rec.mastery;
      then += past.length ? past[past.length - 1]!.mastery : rec.mastery;
      n += 1;
    }
    return n ? (now - then) / n : 0;
  }, [pool, state]);

  const trend = useMemo(() => {
    const points: number[] = [];
    for (let i = 13; i >= 0; i--) {
      const cut = Date.now() - i * DAY;
      let sum = 0;
      for (const c of pool) {
        const rec = recordFor(state, c.id);
        const past = rec.history.filter((h) => new Date(h.at).getTime() <= cut);
        sum += past.length ? past[past.length - 1]!.mastery : 0;
      }
      points.push(pool.length ? sum / pool.length : 0);
    }
    return points;
  }, [pool, state]);

  const readiness = Math.round(
    (mastery * 0.75 +
      (pool.filter((c) => retention(recordFor(state, c.id)) >= 0.8).length / Math.max(pool.length, 1)) *
        0.25) *
      100,
  );

  const planTotals = plan.reduce(
    (acc, item) => {
      if (item.kind === "lesson") acc.learn += item.minutes;
      else if (item.kind === "review" || item.kind === "flashcards") acc.review += item.minutes;
      else if (item.kind === "practice") acc.practice += item.minutes;
      return acc;
    },
    { learn: 0, practice: 0, review: 0 },
  );

  return (
    <AppLayout
      title={`${greeting()}${state.profile.name ? `, ${state.profile.name.split(" ")[0]}` : ""}`}
      subtitle={`${course?.name ?? "No course"}${daysToExam !== null ? ` · ${daysToExam} days to exam` : ""}`}
      actions={
        <Link
          to="/coach"
          aria-label="Ask the AI coach"
          className="grid h-10 w-10 place-items-center rounded-xl border border-border transition-colors hover:bg-secondary"
        >
          <MessagesSquare className="h-4 w-4" />
        </Link>
      }
    >
      <div className="mx-auto w-full max-w-3xl space-y-4">
        {/* Next best action */}
        {top && topConcept ? (
          <Panel className="animate-rise overflow-hidden p-5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Your next best action
              </p>
            </div>
            <h2 className="mt-3 text-[26px] font-semibold leading-tight tracking-tight">
              {topConcept.name}
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
              {top.headline}
              {top.unlocks > 0
                ? ` — this unlocks ${top.unlocks} downstream concept${top.unlocks > 1 ? "s" : ""}.`
                : "."}
            </p>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <Metric
                label="Mastery"
                value={`${Math.round(retention(recordFor(state, top.conceptId)) * 100)}%`}
              />
              <Metric label="Impact" value={`${Math.round(Math.min(1, top.impact) * 100)}%`} />
              <Metric label="Time" value={`${top.minutes}m`} />
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Link
                to="/learn"
                search={{ concept: top.conceptId }}
                className="accent-gradient inline-flex min-h-[50px] flex-1 items-center justify-center gap-2 rounded-2xl px-5 text-[15px] font-semibold text-primary-foreground transition-transform active:scale-[0.98]"
              >
                Start {top.minutes} min
                <ArrowRight className="h-4 w-4" />
              </Link>
              <button
                onClick={() => setWhyOpen(true)}
                className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-2xl border border-border px-5 text-[15px] font-medium transition-colors hover:bg-secondary sm:w-auto"
              >
                <Info className="h-4 w-4" />
                Why this?
              </button>
            </div>
          </Panel>
        ) : (
          <Panel className="p-6 text-sm text-muted-foreground">
            You're caught up — every concept is above target retention.
          </Panel>
        )}

        {/* Today */}
        <Panel className="p-5">
          <SectionTitle
            eyebrow="Today"
            title="Your plan"
            action={
              <Link to="/planner" className="text-xs font-medium text-primary hover:underline">
                Adjust
              </Link>
            }
          />
          <div className="mt-3 grid grid-cols-3 gap-2">
            <PlanChip label="Learn" minutes={planTotals.learn} />
            <PlanChip label="Practice" minutes={planTotals.practice} />
            <PlanChip label="Review" minutes={planTotals.review} />
          </div>
          <ul className="mt-3 space-y-1.5">
            {plan.slice(0, 3).map((item, i) => (
              <li
                key={`${item.label}-${i}`}
                className="flex items-center gap-3 rounded-xl border border-border px-3.5 py-3"
              >
                <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-[13px]">{item.label}</span>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                  {item.minutes}m
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        {/* Your knowledge */}
        <Panel className="p-5">
          <SectionTitle eyebrow="Your knowledge" title={`${Math.round(mastery * 100)}% estimated mastery`} />
          <div className="mt-3">
            <MasteryBar value={mastery} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-[13px]">
            <div className="rounded-xl border border-border px-3.5 py-3">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {weekDelta >= 0 ? (
                  <TrendingUp className="h-3.5 w-3.5 text-success" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                )}
                This week
              </p>
              <p className="mt-1 font-semibold tabular-nums">
                {weekDelta >= 0 ? "+" : ""}
                {Math.round(weekDelta * 100)} pts
              </p>
            </div>
            <div className="rounded-xl border border-border px-3.5 py-3">
              <p className="text-xs text-muted-foreground">Strongest</p>
              <p className="mt-1 truncate font-medium">{strongest?.c.name ?? "—"}</p>
            </div>
            <div className="col-span-2 rounded-xl border border-border px-3.5 py-3">
              <p className="text-xs text-muted-foreground">Biggest gap</p>
              <p className="mt-1 truncate font-medium">{biggestGap?.c.name ?? "—"}</p>
              {biggestGap ? (
                <Link
                  to="/learn"
                  search={{ concept: biggestGap.c.id }}
                  className="mt-1 inline-block text-xs font-medium text-primary"
                >
                  Fix the root cause →
                </Link>
              ) : null}
            </div>
          </div>
        </Panel>

        {/* At risk */}
        <Panel className="p-5">
          <SectionTitle
            eyebrow="At risk"
            title={due.length ? `${due.length} concepts fading` : "Nothing is fading"}
            action={
              due.length ? (
                <Link to="/review" className="text-xs font-medium text-primary hover:underline">
                  Review
                </Link>
              ) : undefined
            }
          />
          {due.length ? (
            <ul className="mt-3 space-y-1.5">
              {due.slice(0, 3).map(({ concept, rec }) => (
                <li key={concept.id}>
                  <Link
                    to="/review"
                    className="flex items-center gap-3 rounded-xl border border-border px-3.5 py-3 transition-colors hover:bg-secondary"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{concept.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {Math.round(forgettingRisk(rec) * 100)}% decayed since last review
                      </span>
                    </span>
                    <StatusPill status={statusOf(state, concept)} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[13px] text-muted-foreground">You're caught up.</p>
          )}
        </Panel>

        {/* Exam readiness */}
        <Panel className="p-5">
          <SectionTitle eyebrow="Exam readiness" title={course?.name ?? "No course"} />
          <div className="mt-3 flex items-end gap-4">
            <p className="text-4xl font-semibold tabular-nums tracking-tight">{readiness}%</p>
            <div className="mb-1 min-w-0 flex-1">
              <p className="text-[13px] text-muted-foreground">
                Estimated readiness · current model
              </p>
              {daysToExam !== null ? (
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarRange className="h-3.5 w-3.5" />
                  {daysToExam} days remaining
                </p>
              ) : null}
            </div>
          </div>
          <div className="mt-3">
            <MasteryBar value={readiness / 100} />
          </div>
        </Panel>

        {/* Recent progress */}
        <Panel className="p-5">
          <SectionTitle eyebrow="Recent progress" title="Mastery over 14 days" />
          <div className="mt-4">
            <Sparkline points={trend} />
          </div>
        </Panel>
      </div>

      <Sheet
        open={whyOpen}
        onClose={() => setWhyOpen(false)}
        eyebrow="Recommendation"
        title={topConcept ? `Why ${topConcept.name}?` : "Why this?"}
        footer={
          top ? (
            <Link
              to="/learn"
              search={{ concept: top.conceptId }}
              onClick={() => setWhyOpen(false)}
              className="accent-gradient flex min-h-[50px] w-full items-center justify-center rounded-2xl text-[15px] font-semibold text-primary-foreground"
            >
              Start {top.minutes} min
            </Link>
          ) : undefined
        }
      >
        <p className="pt-1 text-[13px] text-muted-foreground">
          StudyGraph selected this because:
        </p>
        <ul className="mt-3 space-y-2.5">
          {(top?.reasons ?? []).map((reason) => (
            <li key={reason} className="flex items-start gap-2.5 text-[14px] leading-relaxed">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>{reason}</span>
            </li>
          ))}
        </ul>
        {topConcept ? (
          <div className="mt-5 grid grid-cols-2 gap-2 text-[13px]">
            <div className="rounded-xl border border-border px-3.5 py-3">
              <p className="text-xs text-muted-foreground">Difficulty</p>
              <p className="mt-1 font-semibold tabular-nums">{topConcept.difficulty}/5</p>
            </div>
            <div className="rounded-xl border border-border px-3.5 py-3">
              <p className="text-xs text-muted-foreground">Exam weight</p>
              <p className="mt-1 font-semibold tabular-nums">{topConcept.importance}/5</p>
            </div>
          </div>
        ) : null}
      </Sheet>
    </AppLayout>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary/60 px-2 py-2.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-base font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function PlanChip({ label, minutes }: { label: string; minutes: number }) {
  return (
    <div className="rounded-xl border border-border px-2 py-2.5 text-center">
      <p className="text-base font-semibold tabular-nums">{minutes}m</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
