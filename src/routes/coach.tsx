import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { AppLayout } from "@/components/studygraph/AppLayout";
import { GhostButton, Panel, SectionTitle } from "@/components/studygraph/ui";
import { useStudyGraph } from "@/lib/studygraph/store";
import { askCoach } from "@/lib/studygraph/coach.functions";
import { CONCEPT_BY_ID, COURSE_BY_ID } from "@/lib/studygraph/curriculum";
import {
  bottlenecks,
  courseMastery,
  diagnose,
  recommend,
  recordFor,
  retention,
} from "@/lib/studygraph/engine";

export const Route = createFileRoute("/coach")({
  head: () => ({
    meta: [
      { title: "AI Study Coach — StudyGraph" },
      {
        name: "description",
        content:
          "A Socratic AI coach that reads your knowledge graph, explains concepts at your level and names the prerequisite behind every struggle.",
      },
      { property: "og:title", content: "AI Study Coach — StudyGraph" },
      {
        property: "og:description",
        content: "Graph-aware AI tutoring that always reasons about prerequisites first.",
      },
    ],
  }),
  component: CoachPage,
});

const SUGGESTIONS = [
  "Why do I keep getting buffer problems wrong?",
  "Explain equilibrium like I'm new to it",
  "What should I study in the next hour?",
  "Quiz me on the weakest thing I know",
];

interface Msg {
  role: "user" | "assistant";
  content: string;
}

function CoachPage() {
  const { state } = useStudyGraph();
  const call = useServerFn(askCoach);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "I can see your knowledge graph. Ask me anything — I'll always check your prerequisites before explaining.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const courseId = state.profile.courseId;

  const buildContext = () => {
    const recs = recommend(state, courseId, 4);
    const blocks = bottlenecks(state, courseId);
    const weakest = Object.values(state.mastery)
      .sort((a, b) => retention(a) - retention(b))
      .slice(0, 6)
      .map((rec) => `${CONCEPT_BY_ID.get(rec.conceptId)?.name}: ${Math.round(retention(rec) * 100)}%`);
    const misconceptions = [...new Set(state.mistakes.filter((m) => !m.resolved).map((m) => m.misconception))].slice(0, 4);
    return [
      `Course: ${COURSE_BY_ID.get(courseId)?.name}`,
      `Overall graph mastery: ${Math.round(courseMastery(state, courseId) * 100)}%`,
      `Weakest concepts: ${weakest.join("; ")}`,
      `Prerequisite bottlenecks: ${blocks.map((b) => b.concept.name).join(", ") || "none"}`,
      `Recommended next: ${recs.map((r) => `${CONCEPT_BY_ID.get(r.conceptId)?.name} (${r.headline})`).join("; ")}`,
      `Open misconceptions: ${misconceptions.join("; ") || "none"}`,
    ].join("\n");
  };

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    setBusy(true);
    try {
      const res = await call({ data: { question: text, context: buildContext() } });
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: res.error
            ? `${res.error} In the meantime: ${localFallback(text)}`
            : res.text || localFallback(text),
        },
      ]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: localFallback(text) }]);
    } finally {
      setBusy(false);
    }
  };

  const localFallback = (text: string) => {
    const rec = recommend(state, courseId, 1)[0];
    if (!rec) return "Your graph looks solid — try a mixed review session.";
    const concept = CONCEPT_BY_ID.get(rec.conceptId)!;
    const d = diagnose(state, rec.conceptId);
    return `Based on your graph, focus on ${concept.name}. ${d.causes[0]} ${d.fix[0]}`;
  };

  return (
    <AppLayout title="AI Study Coach" subtitle="Graph-aware tutoring, prerequisites first">
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Panel className="flex h-[70vh] min-h-[520px] flex-col p-0">
          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "ml-auto bg-secondary"
                    : "glass-soft"
                }`}
              >
                {m.content}
              </div>
            ))}
            {busy ? (
              <div className="glass-soft max-w-[60%] rounded-2xl px-4 py-3 text-sm text-muted-foreground">
                Thinking through your prerequisites…
              </div>
            ) : null}
          </div>
          <div className="border-t border-border p-4">
            <div className="mb-3 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <GhostButton key={s} onClick={() => void send(s)} className="text-xs">
                  {s}
                </GhostButton>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send(input);
              }}
              className="flex items-center gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about any concept, mistake or plan…"
                className="flex-1 rounded-xl border border-border bg-transparent px-4 py-3 text-sm outline-none focus:border-primary"
              />
              <button
                type="submit"
                disabled={busy}
                className="accent-gradient grid h-11 w-11 place-items-center rounded-xl text-primary-foreground disabled:opacity-50"
                aria-label="Send"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel className="p-5">
            <SectionTitle eyebrow="Context" title="What the coach can see" />
            <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
              <li>• Mastery and confidence for every concept</li>
              <li>• Prerequisite bottlenecks blocking progress</li>
              <li>• Unresolved misconceptions from your mistakes</li>
              <li>• The current recommendation queue</li>
            </ul>
          </Panel>

          <Panel className="p-5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Right now</p>
            </div>
            <div className="mt-3 space-y-2">
              {recommend(state, courseId, 3).map((rec) => (
                <div key={rec.conceptId} className="rounded-xl border border-border px-3 py-2">
                  <p className="text-sm font-medium">{CONCEPT_BY_ID.get(rec.conceptId)?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {Math.round(retention(recordFor(state, rec.conceptId)) * 100)}% · {rec.headline}
                  </p>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </AppLayout>
  );
}
