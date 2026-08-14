import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { BookOpen, CheckCircle2, Lightbulb, Timer } from "lucide-react";
import { AppLayout } from "@/components/studygraph/AppLayout";
import {
  GhostButton,
  MasteryBar,
  Panel,
  PrimaryButton,
  SectionTitle,
  StatusPill,
} from "@/components/studygraph/ui";
import { useStudyGraph } from "@/lib/studygraph/store";
import { CONCEPT_BY_ID, conceptsForCourse } from "@/lib/studygraph/curriculum";
import {
  diagnose,
  recommend,
  recordFor,
  retention,
  statusOf,
  weakPrereqs,
} from "@/lib/studygraph/engine";

export const Route = createFileRoute("/learn")({
  validateSearch: (s: Record<string, unknown>) => ({
    concept: typeof s.concept === "string" ? s.concept : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Learn — StudyGraph" },
      {
        name: "description",
        content:
          "Focused concept lessons with key ideas, worked examples, prerequisite warnings and instant practice hand-off.",
      },
      { property: "og:title", content: "Learn — StudyGraph" },
      {
        property: "og:description",
        content: "Concept lessons with worked examples and prerequisite-aware guidance.",
      },
    ],
  }),
  component: LearnPage,
});

function LearnPage() {
  const { state, logStudy } = useStudyGraph();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const courseId = state.profile.courseId;
  const pool = conceptsForCourse(courseId);
  const fallback = recommend(state, courseId, 1)[0]?.conceptId ?? pool[0]?.id;
  const activeId = search.concept ?? fallback;
  const concept = activeId ? CONCEPT_BY_ID.get(activeId) : null;
  const [logged, setLogged] = useState(false);

  if (!concept) {
    return (
      <AppLayout title="Learn">
        <Panel className="p-8 text-sm text-muted-foreground">No concepts available.</Panel>
      </AppLayout>
    );
  }

  const gaps = weakPrereqs(state, concept);
  const r = retention(recordFor(state, concept.id));
  const analysis = diagnose(state, concept.id);

  return (
    <AppLayout title="Learn" subtitle={concept.name}>
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          {gaps.length ? (
            <Panel className="border-l-2 p-5" >
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-warning">
                Prerequisite warning
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                This concept depends on{" "}
                {gaps
                  .map((g) => `${CONCEPT_BY_ID.get(g.id)?.name} (${Math.round(g.r * 100)}%)`)
                  .join(", ")}
                . Fixing that first usually cuts the time here in half.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {gaps.map((g) => (
                  <Link
                    key={g.id}
                    to="/learn"
                    search={{ concept: g.id }}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-secondary"
                  >
                    Fix {CONCEPT_BY_ID.get(g.id)?.name}
                  </Link>
                ))}
              </div>
            </Panel>
          ) : null}

          <Panel className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <StatusPill status={statusOf(state, concept)} />
              <span className="text-xs text-muted-foreground">
                <Timer className="mr-1 inline h-3.5 w-3.5" />
                ~{concept.estMinutes} min · difficulty {concept.difficulty}/5
              </span>
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight">{concept.name}</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{concept.summary}</p>

            <div className="mt-6">
              <SectionTitle eyebrow="Key ideas" title="What you must be able to do" />
              <ul className="mt-3 space-y-2">
                {concept.keyIdeas.map((idea) => (
                  <li key={idea} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{idea}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="glass-soft mt-6 rounded-2xl p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Worked example — {concept.worked.title}
              </p>
              <p className="mt-2 text-sm leading-relaxed">{concept.worked.body}</p>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <PrimaryButton
                onClick={() => {
                  logStudy(concept.id, Math.round(concept.estMinutes * 0.6), "lesson");
                  setLogged(true);
                }}
              >
                <BookOpen className="h-4 w-4" />
                {logged ? "Logged" : "Mark lesson complete"}
              </PrimaryButton>
              <GhostButton onClick={() => navigate({ to: "/practice", search: { concept: concept.id } })}>
                Practice this now
              </GhostButton>
              <GhostButton onClick={() => navigate({ to: "/graph", search: { concept: concept.id } })}>
                Show on graph
              </GhostButton>
            </div>
          </Panel>

          <Panel className="p-6">
            <SectionTitle eyebrow="Diagnosis" title="Why this might be hard for you" />
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {analysis.causes.map((c) => (
                <li key={c} className="flex items-start gap-2">
                  <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 space-y-1 text-sm">
              {analysis.fix.map((f) => (
                <p key={f} className="text-primary">
                  → {f}
                </p>
              ))}
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel className="p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Your mastery</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{Math.round(r * 100)}%</p>
            <div className="mt-3">
              <MasteryBar value={r} />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {recordFor(state, concept.id).attempts} attempts ·{" "}
              {recordFor(state, concept.id).reviewCount} reviews
            </p>
          </Panel>

          <Panel className="p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Resources</p>
            <ul className="mt-3 space-y-2 text-sm">
              {concept.resources.map((res) => (
                <li key={res.title} className="flex items-center justify-between gap-2">
                  <span className="truncate text-muted-foreground">{res.title}</span>
                  <span className="shrink-0 rounded-md border border-border px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                    {res.kind}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel className="p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Up next in the graph
            </p>
            <div className="mt-3 space-y-2">
              {recommend(state, courseId, 4)
                .filter((rec) => rec.conceptId !== concept.id)
                .slice(0, 3)
                .map((rec) => (
                  <Link
                    key={rec.conceptId}
                    to="/learn"
                    search={{ concept: rec.conceptId }}
                    className="block rounded-xl border border-border px-3 py-2 text-sm hover:bg-secondary"
                  >
                    {CONCEPT_BY_ID.get(rec.conceptId)?.name}
                  </Link>
                ))}
            </div>
          </Panel>
        </div>
      </div>
    </AppLayout>
  );
}
