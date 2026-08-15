import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { ArrowRight, Brain, Check, RotateCcw, Wrench } from "lucide-react";
import { AppLayout } from "@/components/studygraph/AppLayout";
import { MasteryBar, Panel, SectionTitle } from "@/components/studygraph/ui";
import { Sheet } from "@/components/studygraph/Sheet";
import { useStudyGraph } from "@/lib/studygraph/store";
import { CONCEPT_BY_ID } from "@/lib/studygraph/curriculum";
import { dueForReview, forgettingRisk, recordFor, retention } from "@/lib/studygraph/engine";

export const Route = createFileRoute("/review")({
  head: () => ({
    meta: [
      { title: "Review — StudyGraph" },
      {
        name: "description",
        content:
          "Swipeable spaced review: concepts and cards resurface exactly when your retention starts to fade.",
      },
      { property: "og:title", content: "Review — StudyGraph" },
      {
        property: "og:description",
        content: "Forgetting-curve scheduling for concepts, cards and past mistakes.",
      },
    ],
  }),
  component: ReviewPage,
});

type Tab = "due" | "risk" | "missed" | "foundations";

const RETENTION_LABEL = (r: number) =>
  r >= 0.8 ? "Strong" : r >= 0.6 ? "Stable" : r >= 0.35 ? "Fading" : "At risk";

function ReviewPage() {
  const { state, reviewFlashcard, resolveMistake } = useStudyGraph();
  const [tab, setTab] = useState<Tab>("due");
  const [mistakeId, setMistakeId] = useState<string | null>(null);

  const cards = useMemo(
    () => state.flashcards.filter((c) => new Date(c.dueAt).getTime() <= Date.now()),
    [state.flashcards],
  );
  const due = useMemo(() => dueForReview(state, state.profile.courseId), [state]);
  const openMistakes = state.mistakes.filter((m) => !m.resolved);
  const foundations = due.filter(({ concept }) => concept.prerequisites.length === 0);

  const activeMistake = openMistakes.find((m) => m.id === mistakeId) ?? null;
  const mistakeConcept = activeMistake ? CONCEPT_BY_ID.get(activeMistake.conceptId) : null;
  const rootCause = mistakeConcept?.prerequisites
    .map((p) => ({ id: p, r: retention(recordFor(state, p)) }))
    .sort((a, b) => a.r - b.r)[0];

  const TABS: { id: Tab; label: string; count: number }[] = [
    { id: "due", label: "Due now", count: cards.length },
    { id: "risk", label: "At risk", count: due.length },
    { id: "missed", label: "Recently missed", count: openMistakes.length },
    { id: "foundations", label: "Weak foundations", count: foundations.length },
  ];

  return (
    <AppLayout title="Review today" subtitle={`${due.length} concepts and ${cards.length} cards due`}>
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <Panel className="p-5 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Due now
          </p>
          <p className="mt-1 text-5xl font-semibold tabular-nums tracking-tight">{due.length}</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            concepts whose retention is slipping
          </p>
        </Panel>

        <div
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
          role="tablist"
          aria-label="Review categories"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`flex min-h-[40px] shrink-0 items-center gap-2 rounded-full border px-4 text-[13px] font-medium transition-colors ${
                tab === t.id
                  ? "border-primary bg-secondary text-foreground"
                  : "border-border text-muted-foreground hover:bg-secondary"
              }`}
            >
              {t.label}
              <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums">{t.count}</span>
            </button>
          ))}
        </div>

        {tab === "due" ? (
          cards.length ? (
            <SwipeDeck cards={cards} onRate={reviewFlashcard} />
          ) : (
            <Empty title="You're caught up." detail="No cards are due right now." />
          )
        ) : null}

        {tab === "risk" ? (
          due.length ? (
            <Panel className="p-2">
              <ul className="divide-y divide-border">
                {due.map(({ concept, rec }) => (
                  <li key={concept.id}>
                    <Link
                      to="/practice"
                      search={{ concept: concept.id }}
                      className="flex min-h-[64px] items-center gap-3 rounded-2xl px-3 py-3 transition-colors hover:bg-secondary"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{concept.name}</span>
                        <span className="mt-1.5 block">
                          <MasteryBar value={retention(rec)} />
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {RETENTION_LABEL(retention(rec))} ·{" "}
                          {Math.round(forgettingRisk(rec) * 100)}% decayed
                        </span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : (
            <Empty title="Nothing is fading." detail="Your retention is holding across the graph." />
          )
        ) : null}

        {tab === "missed" ? (
          openMistakes.length ? (
            <Panel className="p-2">
              <ul className="divide-y divide-border">
                {openMistakes.map((m) => {
                  const c = CONCEPT_BY_ID.get(m.conceptId);
                  return (
                    <li key={m.id}>
                      <button
                        onClick={() => setMistakeId(m.id)}
                        className="flex min-h-[60px] w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-secondary"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{c?.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {m.misconception}
                          </span>
                        </span>
                        <Wrench className="h-4 w-4 shrink-0 text-warning" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          ) : (
            <Empty title="Nothing to fix yet." detail="Missed questions land here with a diagnosis." />
          )
        ) : null}

        {tab === "foundations" ? (
          foundations.length ? (
            <Panel className="p-2">
              <ul className="divide-y divide-border">
                {foundations.map(({ concept, rec }) => (
                  <li key={concept.id}>
                    <Link
                      to="/learn"
                      search={{ concept: concept.id }}
                      className="flex min-h-[60px] items-center gap-3 rounded-2xl px-3 py-3 transition-colors hover:bg-secondary"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{concept.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          Foundation · {Math.round(retention(rec) * 100)}% retained
                        </span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : (
            <Empty title="Foundations are solid." detail="Every root concept is holding above target." />
          )
        ) : null}
      </div>

      <Sheet
        open={Boolean(activeMistake)}
        onClose={() => setMistakeId(null)}
        eyebrow="Mistake"
        title={mistakeConcept?.name ?? "Review"}
        footer={
          rootCause ? (
            <Link
              to="/learn"
              search={{ concept: rootCause.id }}
              onClick={() => {
                if (activeMistake) resolveMistake(activeMistake.id);
                setMistakeId(null);
              }}
              className="accent-gradient flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold text-primary-foreground"
            >
              Fix the root cause
            </Link>
          ) : (
            <button
              onClick={() => {
                if (activeMistake) resolveMistake(activeMistake.id);
                setMistakeId(null);
              }}
              className="accent-gradient flex min-h-[50px] w-full items-center justify-center rounded-2xl text-[15px] font-semibold text-primary-foreground"
            >
              Mark resolved
            </button>
          )
        }
      >
        <div className="space-y-4 pt-1 text-[14px] leading-relaxed">
          <Row label="Why you missed it" value={activeMistake?.misconception ?? ""} />
          <Row label="Concept tested" value={mistakeConcept?.name ?? ""} />
          {rootCause ? (
            <Row
              label="Underlying prerequisite"
              value={`${CONCEPT_BY_ID.get(rootCause.id)?.name} — ${Math.round(rootCause.r * 100)}% retained`}
            />
          ) : null}
          <Row
            label="Recommended review"
            value={
              rootCause && rootCause.r < 0.6
                ? `Spend ~15 min repairing ${CONCEPT_BY_ID.get(rootCause.id)?.name} before retrying.`
                : `Do 5 targeted questions on ${mistakeConcept?.name}.`
            }
          />
        </div>
      </Sheet>
    </AppLayout>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1">{value}</p>
    </div>
  );
}

function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <Panel className="p-8 text-center">
      <Brain className="mx-auto h-6 w-6 text-muted-foreground" />
      <p className="mt-3 text-base font-semibold">{title}</p>
      <p className="mt-1 text-[13px] text-muted-foreground">{detail}</p>
    </Panel>
  );
}

/** Tactile swipe deck: swipe right = knew it, left = forgot, tap = reveal. */
function SwipeDeck({
  cards,
  onRate,
}: {
  cards: { id: string; conceptId: string; front: string; back: string }[];
  onRate: (id: string, quality: 0 | 1 | 2) => void;
}) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [dx, setDx] = useState(0);
  const start = useRef<number | null>(null);
  const card = cards[index];

  if (!card) {
    return <Empty title="You're caught up." detail="Every due card has been reviewed." />;
  }

  const concept = CONCEPT_BY_ID.get(card.conceptId);

  const rate = (quality: 0 | 1 | 2) => {
    onRate(card.id, quality);
    setFlipped(false);
    setDx(0);
    setIndex((i) => i + 1);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(quality === 0 ? 25 : 10);
      } catch {
        /* unsupported */
      }
    }
  };

  return (
    <div>
      <div
        className="glass relative select-none rounded-3xl p-6 transition-transform"
        style={{ transform: `translateX(${dx}px) rotate(${dx / 28}deg)` }}
        onPointerDown={(e) => {
          start.current = e.clientX;
          (e.target as Element).setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (start.current === null) return;
          setDx(e.clientX - start.current);
        }}
        onPointerUp={() => {
          if (Math.abs(dx) > 110) rate(dx > 0 ? 2 : 0);
          else setDx(0);
          start.current = null;
        }}
        onClick={() => Math.abs(dx) < 6 && setFlipped((f) => !f)}
      >
        <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          <span className="truncate">{concept?.name}</span>
          <span className="tabular-nums">
            {index + 1}/{cards.length}
          </span>
        </div>
        <p className="mt-6 min-h-[92px] text-[19px] font-medium leading-relaxed">
          {flipped ? card.back : card.front}
        </p>
        <p className="mt-4 text-xs text-muted-foreground">
          {flipped ? "Rate your recall" : "Tap to reveal · swipe right if you knew it"}
        </p>
        {dx > 40 ? (
          <span className="absolute right-5 top-5 rounded-full bg-success/20 px-3 py-1 text-xs font-semibold text-success">
            Knew it
          </span>
        ) : null}
        {dx < -40 ? (
          <span className="absolute left-5 top-5 rounded-full bg-destructive/20 px-3 py-1 text-xs font-semibold text-destructive">
            Forgot
          </span>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <button
          onClick={() => rate(0)}
          className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border border-destructive/40 text-[14px] font-medium text-destructive transition-colors hover:bg-destructive/10"
        >
          <RotateCcw className="h-4 w-4" />
          Forgot
        </button>
        <button
          onClick={() => rate(1)}
          className="min-h-[52px] rounded-2xl border border-border text-[14px] font-medium transition-colors hover:bg-secondary"
        >
          Guessed
        </button>
        <button
          onClick={() => rate(2)}
          className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border border-success/40 text-[14px] font-medium text-success transition-colors hover:bg-success/10"
        >
          <Check className="h-4 w-4" />
          Knew it
        </button>
      </div>

      <SectionTitle
        eyebrow="Model"
        title="Reviews are scheduled from your forgetting curve"
      />
    </div>
  );
}
