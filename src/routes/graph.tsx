import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Search } from "lucide-react";
import { AppLayout } from "@/components/studygraph/AppLayout";
import { GraphCanvas } from "@/components/studygraph/GraphCanvas";
import { GhostButton, MasteryBar, Panel, StatusPill } from "@/components/studygraph/ui";
import { useStudyGraph } from "@/lib/studygraph/store";
import { CONCEPT_BY_ID, COURSES, dependentsOf } from "@/lib/studygraph/curriculum";
import {
  diagnose,
  pathTo,
  recordFor,
  retention,
  statusOf,
  unlockCount,
} from "@/lib/studygraph/engine";
import type { ConceptStatus } from "@/lib/studygraph/types";

export const Route = createFileRoute("/graph")({
  validateSearch: (s: Record<string, unknown>) => ({
    concept: typeof s.concept === "string" ? s.concept : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Knowledge Graph — StudyGraph" },
      {
        name: "description",
        content:
          "An interactive prerequisite map of your subject: node color shows mastery, edges show what depends on what.",
      },
      { property: "og:title", content: "Knowledge Graph — StudyGraph" },
      {
        property: "og:description",
        content: "Interactive prerequisite map with live mastery coloring and gap tracing.",
      },
    ],
  }),
  component: GraphPage,
});

const FILTERS: (ConceptStatus | "all")[] = [
  "all",
  "weak",
  "developing",
  "strong",
  "mastered",
  "locked",
];

function GraphPage() {
  const { state } = useStudyGraph();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<ConceptStatus | "all">("all");
  const [query, setQuery] = useState("");
  const courseId = state.profile.courseId;
  const selectedId = search.concept ?? null;
  const concept = selectedId ? CONCEPT_BY_ID.get(selectedId) : null;
  const path = selectedId ? pathTo(state, selectedId) : [];

  const select = (id: string) =>
    navigate({ to: "/graph", search: { concept: id }, replace: true });

  return (
    <AppLayout
      title="Knowledge Graph"
      subtitle="Nodes are concepts, edges are prerequisites. Size reflects exam weight."
      actions={
        <div className="hidden items-center gap-2 md:flex">
          {COURSES.map((c) => (
            <span
              key={c.id}
              className={`rounded-xl border border-border px-3 py-1.5 text-xs ${
                c.id === courseId ? "bg-secondary text-foreground" : "text-muted-foreground"
              }`}
            >
              {c.name}
            </span>
          ))}
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="glass flex items-center gap-2 rounded-xl px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search concepts"
            className="w-44 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        {FILTERS.map((f) => (
          <GhostButton key={f} active={filter === f} onClick={() => setFilter(f)}>
            {f === "all" ? "All" : f[0]!.toUpperCase() + f.slice(1)}
          </GhostButton>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_360px]">
        <GraphCanvas
          courseId={courseId}
          selectedId={selectedId}
          onSelect={select}
          filter={filter}
          query={query}
          highlightPath={path}
        />

        <Panel className="h-fit p-6">
          {concept ? (
            <div className="space-y-5">
              <div>
                <StatusPill status={statusOf(state, concept)} />
                <h2 className="mt-3 text-xl font-semibold tracking-tight">{concept.name}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {concept.summary}
                </p>
              </div>

              <div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Retention</span>
                  <span>{Math.round(retention(recordFor(state, concept.id)) * 100)}%</span>
                </div>
                <div className="mt-2">
                  <MasteryBar value={retention(recordFor(state, concept.id))} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="glass-soft rounded-xl py-2">
                  <p className="text-muted-foreground">Difficulty</p>
                  <p className="text-sm font-semibold">{concept.difficulty}/5</p>
                </div>
                <div className="glass-soft rounded-xl py-2">
                  <p className="text-muted-foreground">Weight</p>
                  <p className="text-sm font-semibold">{concept.importance}/5</p>
                </div>
                <div className="glass-soft rounded-xl py-2">
                  <p className="text-muted-foreground">Unlocks</p>
                  <p className="text-sm font-semibold">{unlockCount(concept.id)}</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Prerequisites
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {concept.prerequisites.length ? (
                    concept.prerequisites.map((p) => (
                      <button
                        key={p}
                        onClick={() => select(p)}
                        className="rounded-lg border border-border px-2.5 py-1 text-xs hover:bg-secondary"
                      >
                        {CONCEPT_BY_ID.get(p)?.name} · {Math.round(retention(recordFor(state, p)) * 100)}%
                      </button>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">Foundational — none</span>
                  )}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Unlocks next
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {dependentsOf(concept.id).length ? (
                    dependentsOf(concept.id).map((d) => (
                      <button
                        key={d.id}
                        onClick={() => select(d.id)}
                        className="rounded-lg border border-border px-2.5 py-1 text-xs hover:bg-secondary"
                      >
                        {d.name}
                      </button>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">Terminal concept</span>
                  )}
                </div>
              </div>

              <div className="glass-soft rounded-2xl p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Why this is hard right now
                </p>
                <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                  {diagnose(state, concept.id).causes.map((c) => (
                    <li key={c}>• {c}</li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  to="/learn"
                  search={{ concept: concept.id }}
                  className="accent-gradient inline-flex items-center rounded-xl px-3.5 py-2 text-sm font-semibold text-primary-foreground"
                >
                  Learn
                </Link>
                <Link
                  to="/practice"
                  search={{ concept: concept.id }}
                  className="inline-flex items-center rounded-xl border border-border px-3.5 py-2 text-sm hover:bg-secondary"
                >
                  Practice
                </Link>
              </div>

              {path.length > 1 ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Path to mastery
                  </p>
                  <ol className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {path.map((id, i) => (
                      <li key={id}>
                        {i + 1}. {CONCEPT_BY_ID.get(id)?.name}
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="py-10 text-center">
              <p className="text-sm font-semibold">Select a node</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Click any concept to inspect mastery, prerequisites, downstream impact and the
                fastest path to mastering it.
              </p>
            </div>
          )}
        </Panel>
      </div>
    </AppLayout>
  );
}
