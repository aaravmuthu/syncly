import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, Check, CheckCircle2, Lightbulb, Network, X } from "lucide-react";
import { AppLayout } from "@/components/studygraph/AppLayout";
import { MasteryBar, Panel, StatusPill } from "@/components/studygraph/ui";
import { Sheet } from "@/components/studygraph/Sheet";
import { useStudyGraph } from "@/lib/studygraph/store";
import { CONCEPT_BY_ID, conceptsForCourse, questionsForConcept } from "@/lib/studygraph/curriculum";
import {
  diagnose,
  nextQuestion,
  recommend,
  recordFor,
  retention,
  statusOf,
  weakPrereqs,
} from "@/lib/studygraph/engine";
import type { Question } from "@/lib/studygraph/types";

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
          "A distraction-free five-stage lesson: learn, example, check, think, apply — then a mastery update you can see.",
      },
      { property: "og:title", content: "Learn — StudyGraph" },
      {
        property: "og:description",
        content: "Full-screen concept lessons with worked examples and prerequisite-aware guidance.",
      },
    ],
  }),
  component: LearnPage,
});

type Stage = "learn" | "example" | "check" | "think" | "apply" | "done";
const STAGES: Stage[] = ["learn", "example", "check", "think", "apply"];
const STAGE_LABEL: Record<Stage, string> = {
  learn: "Learn",
  example: "Example",
  check: "Check",
  think: "Think",
  apply: "Apply",
  done: "Complete",
};

function LearnPage() {
  const { state, logStudy, answer } = useStudyGraph();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const courseId = state.profile.courseId;
  const pool = conceptsForCourse(courseId);
  const fallback = recommend(state, courseId, 1)[0]?.conceptId ?? pool[0]?.id;
  const activeId = search.concept ?? fallback;
  const concept = activeId ? CONCEPT_BY_ID.get(activeId) : null;

  const [stage, setStage] = useState<Stage>("learn");
  const [gapsOpen, setGapsOpen] = useState(false);
  const [reflection, setReflection] = useState("");
  const [masteryBefore] = useState(() =>
    activeId ? retention(recordFor(state, activeId)) : 0,
  );
  const [confidenceBefore] = useState(() =>
    activeId ? recordFor(state, activeId).confidence : 0,
  );

  const questions = useMemo(
    () => (activeId ? questionsForConcept(activeId) : []),
    [activeId],
  );
  const checkQ = useMemo(
    () => (activeId ? nextQuestion(state, questions, activeId) : null),
    // deliberately frozen on mount-ish: recompute only when concept changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeId, questions.length],
  );
  const applyQ = useMemo(
    () => questions.find((q) => q.id !== checkQ?.id) ?? checkQ,
    [questions, checkQ],
  );

  if (!concept) {
    return (
      <AppLayout title="Learn">
        <Panel className="p-8 text-center text-sm text-muted-foreground">
          Choose a course to build your knowledge graph.
        </Panel>
      </AppLayout>
    );
  }

  const gaps = weakPrereqs(state, concept);
  const r = retention(recordFor(state, concept.id));
  const analysis = diagnose(state, concept.id);
  const stageIndex = stage === "done" ? STAGES.length : STAGES.indexOf(stage);
  const progress = stageIndex / STAGES.length;

  const advance = () => {
    const i = STAGES.indexOf(stage);
    if (i === STAGES.length - 1) {
      logStudy(concept.id, Math.max(6, Math.round(concept.estMinutes * 0.6)), "lesson");
      setStage("done");
      haptic();
    } else {
      setStage(STAGES[i + 1]!);
    }
  };

  const nextRec = recommend(state, courseId, 4).find((x) => x.conceptId !== concept.id);

  return (
    <AppLayout bare>
      <div className="mx-auto w-full max-w-2xl">
        {/* Session chrome */}
        <div className="sticky top-0 z-20 -mx-4 bg-background/85 px-4 pb-3 pt-2 backdrop-blur-xl sm:-mx-5 sm:px-5">
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard"
              aria-label="Close lesson"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Link>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold tracking-tight">{concept.name}</p>
              <p className="text-[11px] text-muted-foreground">
                {stage === "done" ? "Session complete" : `${STAGE_LABEL[stage]} · step ${stageIndex + 1} of ${STAGES.length}`}
              </p>
            </div>
            <StatusPill status={statusOf(state, concept)} />
          </div>
          <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-muted">
            <div
              className="accent-gradient h-full rounded-full transition-[width] duration-500 ease-out"
              style={{ width: `${Math.max(4, progress * 100)}%` }}
            />
          </div>
        </div>

        {gaps.length && stage !== "done" ? (
          <button
            onClick={() => setGapsOpen(true)}
            className="mt-3 flex w-full items-start gap-2.5 rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3 text-left"
          >
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <span className="min-w-0 text-[13px] leading-relaxed">
              This depends on {CONCEPT_BY_ID.get(gaps[0]!.id)?.name}, which is only{" "}
              {Math.round(gaps[0]!.r * 100)}% retained.{" "}
              <span className="font-medium text-warning">Fix the root cause →</span>
            </span>
          </button>
        ) : null}

        <div key={stage} className="animate-rise mt-3 space-y-4">
          {stage === "learn" ? (
            <Panel className="p-5">
              <p className="text-[15px] leading-relaxed text-muted-foreground">{concept.summary}</p>
              <ul className="mt-5 space-y-2.5">
                {concept.keyIdeas.map((idea) => (
                  <li key={idea} className="flex items-start gap-2.5 text-[14px] leading-relaxed">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{idea}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          {stage === "example" ? (
            <Panel className="p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {concept.worked.title}
              </p>
              <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed">
                {concept.worked.body}
              </p>
            </Panel>
          ) : null}

          {stage === "check" || stage === "apply" ? (
            <QuestionStage
              key={stage}
              question={(stage === "check" ? checkQ : applyQ) ?? null}
              concept={concept.name}
              onAnswered={(q, resp, ms) => answer(q, resp, ms, false)}
              onContinue={advance}
            />
          ) : null}

          {stage === "think" ? (
            <Panel className="p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Explain it back
              </p>
              <p className="mt-2 text-[15px] leading-relaxed">
                In your own words: why does {concept.name.toLowerCase()} work the way it does?
              </p>
              <textarea
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                rows={5}
                placeholder="Retrieval beats rereading. Write it from memory."
                className="mt-3 w-full resize-none rounded-2xl border border-input bg-background/40 p-4 text-[15px] outline-none focus:border-primary"
              />
              <div className="mt-3 space-y-1.5 text-[13px] text-muted-foreground">
                {analysis.causes.slice(0, 2).map((c) => (
                  <p key={c}>· {c}</p>
                ))}
              </div>
            </Panel>
          ) : null}

          {stage === "done" ? (
            <SessionComplete
              conceptId={concept.id}
              masteryBefore={masteryBefore}
              confidenceBefore={confidenceBefore}
              nextId={nextRec?.conceptId}
            />
          ) : null}
        </div>

        {stage !== "done" && stage !== "check" && stage !== "apply" ? (
          <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] mt-4 lg:bottom-4">
            <button
              onClick={advance}
              className="accent-gradient flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold text-primary-foreground transition-transform active:scale-[0.98]"
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        {stage !== "done" ? (
          <div className="mt-6 rounded-2xl border border-border p-4">
            <p className="text-xs text-muted-foreground">Your mastery</p>
            <div className="mt-2 flex items-center gap-3">
              <span className="text-2xl font-semibold tabular-nums">{Math.round(r * 100)}%</span>
              <div className="min-w-0 flex-1">
                <MasteryBar value={r} />
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <Sheet
        open={gapsOpen}
        onClose={() => setGapsOpen(false)}
        eyebrow="Root cause"
        title="Weak prerequisites"
      >
        <div className="space-y-2 pt-1">
          {gaps.map((g) => {
            const c = CONCEPT_BY_ID.get(g.id);
            if (!c) return null;
            return (
              <Link
                key={g.id}
                to="/learn"
                search={{ concept: g.id }}
                onClick={() => {
                  setGapsOpen(false);
                  setStage("learn");
                }}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3.5 transition-colors hover:bg-secondary"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{c.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {Math.round(g.r * 100)}% retained · ~{c.estMinutes} min to repair
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-primary" />
              </Link>
            );
          })}
        </div>
      </Sheet>
    </AppLayout>
  );
}

function QuestionStage({
  question,
  concept,
  onAnswered,
  onContinue,
}: {
  question: Question | null;
  concept: string;
  onAnswered: (q: Question, response: number[] | string, ms: number) => boolean;
  onContinue: () => void;
}) {
  const [choice, setChoice] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [result, setResult] = useState<boolean | null>(null);
  const [start] = useState(() => Date.now());

  if (!question) {
    return (
      <Panel className="p-5">
        <p className="text-[15px]">No question available for this step.</p>
        <button
          onClick={onContinue}
          className="mt-4 min-h-[48px] w-full rounded-2xl border border-border text-[15px] font-medium"
        >
          Continue
        </button>
      </Panel>
    );
  }

  const isChoice = Boolean(question.choices?.length);

  const submit = () => {
    const response: number[] | string = isChoice ? [choice ?? -1] : text;
    const ok = onAnswered(question, response, Date.now() - start);
    setResult(ok);
    haptic(ok ? 10 : 30);
  };

  return (
    <Panel className="p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {concept}
      </p>
      <p className="mt-2 text-[16px] leading-relaxed">{question.prompt}</p>

      {isChoice ? (
        <div className="mt-4 space-y-2">
          {question.choices!.map((c, i) => {
            const chosen = choice === i;
            const correctIdx = Array.isArray(question.answer) ? question.answer.includes(i) : false;
            const showState = result !== null;
            return (
              <button
                key={c}
                disabled={result !== null}
                onClick={() => setChoice(i)}
                className={`flex min-h-[52px] w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-[14px] transition-colors ${
                  showState && correctIdx
                    ? "border-success bg-success/10"
                    : showState && chosen
                      ? "border-destructive bg-destructive/10"
                      : chosen
                        ? "border-primary bg-secondary"
                        : "border-border hover:bg-secondary"
                }`}
              >
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] font-semibold ${
                    chosen ? "border-primary text-primary" : "border-border text-muted-foreground"
                  }`}
                >
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="min-w-0">{c}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <input
          value={text}
          disabled={result !== null}
          onChange={(e) => setText(e.target.value)}
          inputMode={question.type === "numeric" ? "decimal" : "text"}
          placeholder="Your answer"
          className="mt-4 min-h-[52px] w-full rounded-2xl border border-input bg-background/40 px-4 text-[15px] outline-none focus:border-primary"
        />
      )}

      {result !== null ? (
        <div
          className={`mt-4 rounded-2xl border p-4 ${
            result ? "border-success/40 bg-success/10" : "border-destructive/40 bg-destructive/10"
          }`}
        >
          <p className="flex items-center gap-2 text-sm font-semibold">
            {result ? <Check className="h-4 w-4 text-success" /> : <X className="h-4 w-4 text-destructive" />}
            {result ? "Correct" : "Not quite"}
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            {question.explanation}
          </p>
          {!result ? (
            <p className="mt-2 text-[13px] leading-relaxed text-warning">
              Common trap: {question.misconception}
            </p>
          ) : null}
        </div>
      ) : null}

      <button
        onClick={result === null ? submit : onContinue}
        disabled={result === null && (isChoice ? choice === null : !text.trim())}
        className="accent-gradient mt-4 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-40"
      >
        {result === null ? "Check answer" : "Continue"}
        {result !== null ? <ArrowRight className="h-4 w-4" /> : null}
      </button>
    </Panel>
  );
}

function SessionComplete({
  conceptId,
  masteryBefore,
  confidenceBefore,
  nextId,
}: {
  conceptId: string;
  masteryBefore: number;
  confidenceBefore: number;
  nextId?: string;
}) {
  const { state } = useStudyGraph();
  const rec = recordFor(state, conceptId);
  const after = retention(rec);
  const delta = after - masteryBefore;
  const confDelta = rec.confidence - confidenceBefore;
  const nextConcept = nextId ? CONCEPT_BY_ID.get(nextId) : null;

  return (
    <Panel className="animate-rise p-6 text-center">
      <div className="accent-gradient mx-auto grid h-14 w-14 place-items-center rounded-2xl text-primary-foreground">
        <Check className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-xl font-semibold tracking-tight">Session complete</h2>
      <p className="mt-1 text-[13px] text-muted-foreground">
        {CONCEPT_BY_ID.get(conceptId)?.name} strengthened
      </p>

      <div className="mt-5 grid grid-cols-3 gap-2">
        <Delta label="Before" value={`${Math.round(masteryBefore * 100)}%`} />
        <Delta label="After" value={`${Math.round(after * 100)}%`} accent />
        <Delta
          label="Confidence"
          value={`${confDelta >= 0 ? "+" : ""}${Math.round(confDelta * 100)}`}
        />
      </div>
      <p className="mt-3 text-[13px] text-muted-foreground">
        {delta >= 0
          ? `Mastery moved ${Math.round(delta * 100)} points. Your graph and review schedule have updated.`
          : "Mastery adjusted downward — the model now has better evidence about this concept."}
      </p>

      <div className="mt-5 space-y-2">
        {nextConcept ? (
          <Link
            to="/learn"
            search={{ concept: nextConcept.id }}
            className="accent-gradient flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold text-primary-foreground"
          >
            Continue with {nextConcept.name}
          </Link>
        ) : (
          <Link
            to="/dashboard"
            className="accent-gradient flex min-h-[52px] w-full items-center justify-center rounded-2xl text-[15px] font-semibold text-primary-foreground"
          >
            Continue
          </Link>
        )}
        <Link
          to="/graph"
          search={{ concept: conceptId }}
          className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl border border-border text-[15px] font-medium transition-colors hover:bg-secondary"
        >
          <Network className="h-4 w-4" />
          See my graph
        </Link>
      </div>
    </Panel>
  );
}

function Delta({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl px-2 py-3 ${accent ? "bg-primary/15" : "bg-secondary/60"}`}>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function haptic(ms = 12) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(ms);
    } catch {
      /* unsupported */
    }
  }
}
