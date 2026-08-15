import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Search, X } from "lucide-react";
import { AppLayout } from "@/components/studygraph/AppLayout";
import { GraphCanvas } from "@/components/studygraph/GraphCanvas";
import { MasteryBar, Panel, StatusPill } from "@/components/studygraph/ui";
import { Sheet } from "@/components/studygraph/Sheet";
import { useStudyGraph } from "@/lib/studygraph/store";
import { CONCEPT_BY_ID, dependentsOf } from "@/lib/studygraph/curriculum";
import {
  diagnose,
  pathTo,
  recordFor,
  retention,
  statusOf,
  unlockCount,
} from "@/lib/studygraph/engine";
import type { Concept, ConceptStatus } from "@/lib/studygraph/types";

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
  const [searchOpen, setSearchOpen] = useState(false);
  const courseId = state.profile.courseId;
  const selectedId = search.concept ?? null;
  const concept = selectedId ? CONCEPT_BY_ID.get(selectedId) : null;
  const path = selectedId ? pathTo(state, selectedId) : [];

  const select = (id: string | null) =>
    navigate({ to: "/graph", search: { concept: id ?? undefined }, replace: true });

  return (
    <AppLayout
      title="Knowledge Graph"
      subtitle="Tap a node · pinch to zoom · drag to pan"
      actions={
        <button
          onClick={() => setSearchOpen((s) => !s)}
          aria-label="Search concepts"
          className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-muted-foreground transition-colors hover:text-foreground"
        >
          {searchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
        </button>
      }
    >
      {searchOpen ? (
        <div className="animate-rise mb-3 flex items-center gap-2 rounded-2xl border border-input bg-background/50 px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search concepts"
            className="min-h-[48px] w-full bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
          />
        </div>
      ) : null}

      <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`min-h-[38px] shrink-0 rounded-full border px-4 text-[13px] font-medium transition-colors ${
              filter === f
                ? "border-primary bg-secondary text-foreground"
                : "border-border text-muted-foreground hover:bg-secondary"
            }`}
          >
            {f === "all" ? "All" : f[0]!.toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <GraphCanvas
          courseId={courseId}
          selectedId={selectedId}
          onSelect={(id) => select(id)}
          filter={filter}
          query={query}
          highlightPath={path}
        />

        <Panel className="hidden h-fit p-6 xl:block">
          {concept ? (
            <ConceptDetail concept={concept} path={path} onSelect={select} />
          ) : (
            <div className="py-10 text-center">
              <p className="text-sm font-semibold">Select a node</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Choose any concept to inspect mastery, prerequisites, downstream impact and the
                fastest path to mastering it.
              </p>
            </div>
          )}
        </Panel>
      </div>

      {/* Mobile / tablet: detail arrives as a bottom sheet */}
      <div className="xl:hidden">
        <Sheet
          open={Boolean(concept)}
          onClose={() => select(null)}
          eyebrow="Concept"
          title={concept?.name}
          footer={
            concept ? (
              <div className="grid grid-cols-2 gap-2">
                <Link
                  to="/learn"
                  search={{ concept: concept.id }}
                  className="accent-gradient flex min-h-[50px] items-center justify-center rounded-2xl text-[15px] font-semibold text-primary-foreground"
                >
                  Learn
                </Link>
                <Link
                  to="/practice"
                  search={{ concept: concept.id }}
                  className="flex min-h-[50px] items-center justify-center rounded-2xl border border-border text-[15px] font-medium"
                >
                  Practice
                </Link>
              </div>
            ) : null
          }
        >
          {concept ? (
            <ConceptDetail concept={concept} path={path} onSelect={select} compact />
          ) : null}
        </Sheet>
      </div>
    </AppLayout>
  );
}

function ConceptDetail({
  concept,
  path,
  onSelect,
  compact = false,
}: {
  concept: Concept;
  path: string[];
  onSelect: (id: string) => void;
  compact?: boolean;
}) {
  const { state } = useStudyGraph();
  const r = retention(recordFor(state, concept.id));

  return (
    <div className="space-y-5 pt-1">
      <div>
        {!compact ? <StatusPill status={statusOf(state, concept)} /> : null}
        {!compact ? (
          <h2 className="mt-3 text-xl font-semibold tracking-tight">{concept.name}</h2>
        ) : (
          <StatusPill status={statusOf(state, concept)} />
        )}
        <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{concept.summary}</p>
      </div>

      <div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Retention</span>
          <span className="tabular-nums">{Math.round(r * 100)}%</span>
        </div>
        <div className="mt-2">
          <MasteryBar value={r} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <Metric label="Difficulty" value={`${concept.difficulty}/5`} />
        <Metric label="Exam weight" value={`${concept.importance}/5`} />
        <Metric label="Unlocks" value={String(unlockCount(concept.id))} />
      </div>

      <Group label="Prerequisites">
        {concept.prerequisites.length ? (
          concept.prerequisites.map((p) => (
            <Chip key={p} onClick={() => onSelect(p)}>
              {CONCEPT_BY_ID.get(p)?.name} · {Math.round(retention(recordFor(state, p)) * 100)}%
            </Chip>
          ))
        ) : (
          <span className="text-xs text-muted-foreground">Foundational — none</span>
        )}
      </Group>

      <Group label="Unlocks next">
        {dependentsOf(concept.id).length ? (
          dependentsOf(concept.id).map((d) => (
            <Chip key={d.id} onClick={() => onSelect(d.id)}>
              {d.name}
            </Chip>
          ))
        ) : (
          <span className="text-xs text-muted-foreground">Terminal concept</span>
        )}
      </Group>

      <div className="rounded-2xl border border-border p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Why this is hard right now
        </p>
        <ul className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-muted-foreground">
          {diagnose(state, concept.id).causes.map((c) => (
            <li key={c}>• {c}</li>
          ))}
        </ul>
      </div>

      {path.length > 1 ? (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Path to mastery
          </p>
          <ol className="mt-2 space-y-1 text-[13px] text-muted-foreground">
            {path.map((id, i) => (
              <li key={id}>
                {i + 1}. {CONCEPT_BY_ID.get(id)?.name}
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {!compact ? (
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
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary/60 py-2.5">
      <p className="text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Chip({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="min-h-[36px] rounded-xl border border-border px-3 text-xs transition-colors hover:bg-secondary"
    >
      {children}
    </button>
  );
}
