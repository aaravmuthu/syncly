import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, RefreshCw, X } from "lucide-react";
import { AppLayout } from "@/components/studygraph/AppLayout";
import {
  GhostButton,
  MasteryBar,
  Panel,
  PrimaryButton,
  SectionTitle,
} from "@/components/studygraph/ui";
import { useStudyGraph } from "@/lib/studygraph/store";
import { CONCEPT_BY_ID, conceptsForCourse, questionsForConcept } from "@/lib/studygraph/curriculum";
import { nextQuestion, recommend, recordFor, retention } from "@/lib/studygraph/engine";
import type { Question } from "@/lib/studygraph/types";

export const Route = createFileRoute("/practice")({
  validateSearch: (s: Record<string, unknown>) => ({
    concept: typeof s.concept === "string" ? s.concept : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Practice — StudyGraph" },
      {
        name: "description",
        content:
          "Adaptive practice that targets a 70–80% success rate, explains every miss and updates your mastery estimate live.",
      },
      { property: "og:title", content: "Practice — StudyGraph" },
      {
        property: "og:description",
        content: "Adaptive question engine with instant explanations and live mastery updates.",
      },
    ],
  }),
  component: PracticePage,
});

function PracticePage() {
  const { state, answer } = useStudyGraph();
  const search = Route.useSearch();
  const courseId = state.profile.courseId;
  const pool = conceptsForCourse(courseId).filter((x) => questionsForConcept(x.id).length > 0);
  const fallback = recommend(state, courseId, 6).find((r) => questionsForConcept(r.conceptId).length)?.conceptId;
  const conceptId = search.concept ?? fallback ?? pool[0]?.id ?? "";
  const concept = CONCEPT_BY_ID.get(conceptId);

  const [question, setQuestion] = useState<Question | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [text, setText] = useState("");
  const [result, setResult] = useState<null | { correct: boolean; q: Question }>(null);
  const [guessed, setGuessed] = useState(false);
  const [streak, setStreak] = useState({ right: 0, total: 0 });
  const started = useRef(Date.now());

  const questions = useMemo(() => questionsForConcept(conceptId), [conceptId]);

  useEffect(() => {
    setQuestion(nextQuestion(state, questions, conceptId));
    setSelected([]);
    setText("");
    setResult(null);
    setGuessed(false);
    started.current = Date.now();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conceptId]);

  const submit = () => {
    if (!question) return;
    const response =
      question.type === "numeric" || question.type === "short-answer" ? text : selected;
    const correct = answer(question, response, Date.now() - started.current, guessed);
    setResult({ correct, q: question });
    setStreak((s) => ({ right: s.right + (correct ? 1 : 0), total: s.total + 1 }));
  };

  const advance = () => {
    setResult(null);
    setSelected([]);
    setText("");
    setGuessed(false);
    started.current = Date.now();
    setQuestion(nextQuestion(state, questions, conceptId));
  };

  const r = retention(recordFor(state, conceptId));

  return (
    <AppLayout
      title="Practice"
      subtitle={concept ? `${concept.name} · adaptive difficulty` : "Adaptive question engine"}
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Panel className="p-6">
          {question ? (
            <>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Difficulty {question.difficulty}/5</span>
                <span>
                  Session {streak.right}/{streak.total} correct
                </span>
              </div>
              <h2 className="mt-4 text-lg font-medium leading-relaxed">{question.prompt}</h2>

              <div className="mt-5 space-y-2">
                {question.choices?.map((choice, i) => {
                  const picked = selected.includes(i);
                  const isAnswer = (question.answer as number[]).includes?.(i);
                  const revealed = !!result;
                  return (
                    <button
                      key={choice}
                      disabled={revealed}
                      onClick={() =>
                        setSelected((s) =>
                          question.type === "multiple-select"
                            ? s.includes(i)
                              ? s.filter((x) => x !== i)
                              : [...s, i]
                            : [i],
                        )
                      }
                      className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${
                        revealed && isAnswer
                          ? "border-[color-mix(in_oklab,var(--success)_50%,transparent)] bg-[color-mix(in_oklab,var(--success)_12%,transparent)]"
                          : revealed && picked
                            ? "border-[color-mix(in_oklab,var(--destructive)_50%,transparent)] bg-[color-mix(in_oklab,var(--destructive)_12%,transparent)]"
                            : picked
                              ? "border-primary bg-secondary"
                              : "border-border hover:bg-secondary"
                      }`}
                    >
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg border border-border text-[11px]">
                        {String.fromCharCode(65 + i)}
                      </span>
                      {choice}
                    </button>
                  );
                })}

                {!question.choices ? (
                  <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    disabled={!!result}
                    placeholder="Your answer"
                    className="w-full rounded-2xl border border-border bg-transparent px-4 py-3 text-sm outline-none focus:border-primary"
                  />
                ) : null}
              </div>

              {!result ? (
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <PrimaryButton
                    onClick={submit}
                    disabled={selected.length === 0 && text.trim() === ""}
                  >
                    Check answer
                  </PrimaryButton>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={guessed}
                      onChange={(e) => setGuessed(e.target.checked)}
                    />
                    I guessed
                  </label>
                </div>
              ) : (
                <div className="mt-5 space-y-4">
                  <div
                    className="flex items-start gap-3 rounded-2xl px-4 py-3 text-sm"
                    style={{
                      background: `color-mix(in oklab, ${result.correct ? "var(--success)" : "var(--destructive)"} 12%, transparent)`,
                    }}
                  >
                    {result.correct ? (
                      <Check className="mt-0.5 h-4 w-4 text-success" />
                    ) : (
                      <X className="mt-0.5 h-4 w-4 text-destructive" />
                    )}
                    <div>
                      <p className="font-semibold">{result.correct ? "Correct" : "Not quite"}</p>
                      <p className="mt-1 text-muted-foreground">{result.q.explanation}</p>
                      {!result.correct ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Common cause: {result.q.misconception}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <PrimaryButton onClick={advance}>
                      <RefreshCw className="h-4 w-4" />
                      Next question
                    </PrimaryButton>
                    <Link
                      to="/learn"
                      search={{ concept: conceptId }}
                      className="inline-flex items-center rounded-xl border border-border px-3.5 py-2 text-sm hover:bg-secondary"
                    >
                      Review the lesson
                    </Link>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              No questions authored for this concept yet — try another node on the graph.
            </p>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel className="p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Live mastery
            </p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{Math.round(r * 100)}%</p>
            <div className="mt-3">
              <MasteryBar value={r} />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Updates after every answer using difficulty, speed and guess signals.
            </p>
          </Panel>

          <Panel className="p-5">
            <SectionTitle eyebrow="Switch topic" title="Practice something else" />
            <div className="mt-3 max-h-72 space-y-1.5 overflow-y-auto pr-1">
              {pool.map((cpt) => (
                <Link
                  key={cpt.id}
                  to="/practice"
                  search={{ concept: cpt.id }}
                  className={`block rounded-xl px-3 py-2 text-sm hover:bg-secondary ${
                    cpt.id === conceptId ? "bg-secondary" : ""
                  }`}
                >
                  {cpt.name}
                </Link>
              ))}
            </div>
          </Panel>

          <Panel className="p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Tip</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Marking a question as a guess reduces how much a lucky correct answer raises your
              mastery estimate. Honest input makes the graph accurate.
            </p>
            <GhostButton className="mt-3" onClick={advance}>
              Skip this question
            </GhostButton>
          </Panel>
        </div>
      </div>
    </AppLayout>
  );
}
