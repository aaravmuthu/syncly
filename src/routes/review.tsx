import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Brain, RotateCcw, Sparkles } from "lucide-react";
import { AppLayout } from "@/components/studygraph/AppLayout";
import {
  EmptyState,
  GhostButton,
  MasteryBar,
  Panel,
  PrimaryButton,
  SectionTitle,
} from "@/components/studygraph/ui";
import { useStudyGraph } from "@/lib/studygraph/store";
import { CONCEPT_BY_ID } from "@/lib/studygraph/curriculum";
import { dueForReview, forgettingRisk, retention } from "@/lib/studygraph/engine";

export const Route = createFileRoute("/review")({
  head: () => ({
    meta: [
      { title: "Review — StudyGraph" },
      {
        name: "description",
        content:
          "Spaced repetition driven by a forgetting curve: review concepts and flashcards exactly when retention starts to slip.",
      },
      { property: "og:title", content: "Review — StudyGraph" },
      {
        property: "og:description",
        content: "Forgetting-curve scheduling for concepts, flashcards and past mistakes.",
      },
    ],
  }),
  component: ReviewPage,
});

function ReviewPage() {
  const { state, reviewFlashcard, resolveMistake, logStudy } = useStudyGraph();
  const due = dueForReview(state, state.profile.courseId);
  const cards = state.flashcards.filter((c) => new Date(c.dueAt).getTime() <= Date.now());
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = cards[index % Math.max(cards.length, 1)];
  const openMistakes = state.mistakes.filter((m) => !m.resolved);

  return (
    <AppLayout
      title="Review"
      subtitle={`${due.length} concepts decaying · ${cards.length} cards due`}
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Panel className="p-6">
            <SectionTitle eyebrow="Flashcards" title="Retrieval practice" />
            {card ? (
              <div className="mt-4">
                <button
                  onClick={() => setFlipped((f) => !f)}
                  className="glass-soft grid min-h-[190px] w-full place-items-center rounded-3xl px-6 py-8 text-center text-lg font-medium transition-transform hover:-translate-y-0.5"
                >
                  {flipped ? card.back : card.front}
                </button>
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  {flipped ? "Answer" : "Tap to reveal"} ·{" "}
                  {CONCEPT_BY_ID.get(card.conceptId)?.name}
                </p>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {(
                    [
                      { q: 0 as const, label: "Missed" },
                      { q: 1 as const, label: "Hard" },
                      { q: 2 as const, label: "Easy" },
                    ]
                  ).map((b) => (
                    <GhostButton
                      key={b.label}
                      onClick={() => {
                        reviewFlashcard(card.id, b.q);
                        setFlipped(false);
                        setIndex((i) => i + 1);
                      }}
                    >
                      {b.label}
                    </GhostButton>
                  ))}
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                No cards due right now. Next card unlocks as its interval elapses.
              </p>
            )}
          </Panel>

          <Panel className="p-6">
            <SectionTitle eyebrow="Concept decay" title="Scheduled by forgetting curve" />
            <div className="mt-4 space-y-3">
              {due.length ? (
                due.map((d) => (
                  <div key={d.concept.id} className="glass-soft rounded-2xl p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{d.concept.name}</p>
                      <span className="text-xs text-muted-foreground">
                        {Math.round(forgettingRisk(d.rec) * 100)}% decayed since last review
                      </span>
                    </div>
                    <div className="mt-3">
                      <MasteryBar value={retention(d.rec)} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <PrimaryButton
                        className="px-3 py-1.5 text-xs"
                        onClick={() => logStudy(d.concept.id, 10, "review")}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Refresh 10 min
                      </PrimaryButton>
                      <Link
                        to="/practice"
                        search={{ concept: d.concept.id }}
                        className="rounded-xl border border-border px-3 py-1.5 text-xs hover:bg-secondary"
                      >
                        Quiz me
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Retention is holding across the graph. Nothing scheduled.
                </p>
              )}
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel className="p-5">
            <SectionTitle eyebrow="Mistake bank" title="Unresolved misses" />
            <div className="mt-3 space-y-2">
              {openMistakes.length ? (
                openMistakes.slice(0, 8).map((m) => (
                  <div key={m.id} className="rounded-xl border border-border p-3">
                    <p className="text-sm font-medium">
                      {CONCEPT_BY_ID.get(m.conceptId)?.name ?? m.conceptId}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{m.misconception}</p>
                    <div className="mt-2 flex gap-2">
                      <Link
                        to="/practice"
                        search={{ concept: m.conceptId }}
                        className="rounded-lg border border-border px-2.5 py-1 text-[11px] hover:bg-secondary"
                      >
                        Retry
                      </Link>
                      <button
                        onClick={() => resolveMistake(m.id)}
                        className="rounded-lg border border-border px-2.5 py-1 text-[11px] hover:bg-secondary"
                      >
                        Mark resolved
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Mistake bank is clear.</p>
              )}
            </div>
          </Panel>

          <Panel className="p-5">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">How scheduling works</p>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Each concept has a stability value that grows with mastery and repetitions.
              Retention decays exponentially against it, and a concept surfaces here once
              predicted retention falls more than 22% below your recorded mastery.
            </p>
          </Panel>

          {cards.length === 0 && due.length === 0 ? (
            <EmptyState
              title="Nothing due"
              body="Come back tomorrow, or get ahead by practicing a weak concept."
              action={
                <Link
                  to="/practice"
                  search={{ concept: undefined }}
                  className="accent-gradient inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-primary-foreground"
                >
                  <Sparkles className="h-4 w-4" />
                  Practice anyway
                </Link>
              }
            />
          ) : null}
        </div>
      </div>
    </AppLayout>
  );
}
