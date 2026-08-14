import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createDemoState } from "./demo";
import { QUESTIONS, questionsForConcept } from "./curriculum";
import {
  gradeAnswer,
  recordFor,
  studyGain,
  updateMastery,
} from "./engine";
import type {
  AppState,
  Attempt,
  Flashcard,
  Note,
  Profile,
  Question,
  StudySession,
} from "./types";

const KEY = "studygraph:state:v1";

interface Ctx {
  state: AppState;
  ready: boolean;
  setProfile: (patch: Partial<Profile>) => void;
  answer: (question: Question, response: number[] | string, responseMs: number, guessed: boolean) => boolean;
  logStudy: (conceptId: string, minutes: number, kind: StudySession["kind"]) => void;
  upsertNote: (note: Note) => void;
  removeNote: (id: string) => void;
  addFlashcards: (cards: Flashcard[]) => void;
  reviewFlashcard: (id: string, quality: 0 | 1 | 2) => void;
  resolveMistake: (id: string) => void;
  toggleResource: (key: string) => void;
  resetProgress: () => void;
  loadDemo: () => void;
}

const StudyGraphContext = createContext<Ctx | null>(null);

export function StudyGraphProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => createDemoState());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setState({ ...createDemoState(), ...(JSON.parse(raw) as AppState) });
    } catch {
      /* corrupted store — keep the demo baseline */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* quota — non fatal */
    }
  }, [state, ready]);

  useEffect(() => {
    if (!ready) return;
    const theme = state.profile.theme;
    const resolved =
      theme === "system"
        ? window.matchMedia("(prefers-color-scheme: light)").matches
          ? "light"
          : "dark"
        : theme;
    document.documentElement.setAttribute("data-theme", resolved);
  }, [state.profile.theme, ready]);

  const setProfile = useCallback((patch: Partial<Profile>) => {
    setState((s) => ({ ...s, profile: { ...s.profile, ...patch } }));
  }, []);

  const answer = useCallback(
    (question: Question, response: number[] | string, responseMs: number, guessed: boolean) => {
      const correct = gradeAnswer(question, response);
      setState((s) => {
        const rec = recordFor(s, question.conceptId);
        const next = updateMastery(rec, {
          correct,
          difficulty: question.difficulty,
          responseMs,
          guessed,
        });
        const attempt: Attempt = {
          id: `${question.id}-${Date.now()}`,
          questionId: question.id,
          conceptId: question.conceptId,
          correct,
          guessed,
          responseMs,
          at: new Date().toISOString(),
          chosen: Array.isArray(response) ? response.join(",") : String(response),
        };
        const mistakes = correct
          ? s.mistakes
          : [
              ...s.mistakes,
              {
                id: attempt.id,
                questionId: question.id,
                conceptId: question.conceptId,
                at: attempt.at,
                misconception: question.misconception,
                resolved: false,
              },
            ];
        return {
          ...s,
          mastery: { ...s.mastery, [question.conceptId]: next },
          attempts: [...s.attempts, attempt].slice(-400),
          mistakes: mistakes.slice(-200),
          streak: bumpStreak(s.streak),
        };
      });
      return correct;
    },
    [],
  );

  const logStudy = useCallback(
    (conceptId: string, minutes: number, kind: StudySession["kind"]) => {
      setState((s) => {
        const rec = recordFor(s, conceptId);
        const next = studyGain(rec, minutes);
        const session: StudySession = {
          id: `sess-${Date.now()}`,
          conceptId,
          kind,
          minutes,
          at: new Date().toISOString(),
          masteryBefore: rec.mastery,
          masteryAfter: next.mastery,
        };
        return {
          ...s,
          mastery: { ...s.mastery, [conceptId]: next },
          sessions: [...s.sessions, session].slice(-300),
          streak: bumpStreak(s.streak),
        };
      });
    },
    [],
  );

  const upsertNote = useCallback((note: Note) => {
    setState((s) => {
      const exists = s.notes.some((n) => n.id === note.id);
      return {
        ...s,
        notes: exists ? s.notes.map((n) => (n.id === note.id ? note : n)) : [note, ...s.notes],
      };
    });
  }, []);

  const removeNote = useCallback((id: string) => {
    setState((s) => ({ ...s, notes: s.notes.filter((n) => n.id !== id) }));
  }, []);

  const addFlashcards = useCallback((cards: Flashcard[]) => {
    setState((s) => ({ ...s, flashcards: [...cards, ...s.flashcards] }));
  }, []);

  const reviewFlashcard = useCallback((id: string, quality: 0 | 1 | 2) => {
    setState((s) => ({
      ...s,
      flashcards: s.flashcards.map((card) => {
        if (card.id !== id) return card;
        const ease = Math.max(1.3, card.ease + (quality === 2 ? 0.12 : quality === 1 ? 0 : -0.25));
        const interval =
          quality === 0 ? 1 : Math.max(1, Math.round(card.intervalDays * ease * (quality === 2 ? 1.2 : 0.9)));
        return {
          ...card,
          ease,
          intervalDays: interval,
          reviews: card.reviews + 1,
          dueAt: new Date(Date.now() + interval * 86_400_000).toISOString(),
        };
      }),
      streak: bumpStreak(s.streak),
    }));
  }, []);

  const resolveMistake = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      mistakes: s.mistakes.map((m) => (m.id === id ? { ...m, resolved: true } : m)),
    }));
  }, []);

  const toggleResource = useCallback((key: string) => {
    setState((s) => ({
      ...s,
      savedResources: s.savedResources.includes(key)
        ? s.savedResources.filter((r) => r !== key)
        : [...s.savedResources, key],
    }));
  }, []);

  const resetProgress = useCallback(() => {
    setState((s) => ({
      ...createDemoState(),
      profile: { ...s.profile },
      mastery: {},
      attempts: [],
      mistakes: [],
      sessions: [],
      streak: { current: 0, longest: 0, lastDay: null },
    }));
  }, []);

  const loadDemo = useCallback(() => setState(createDemoState()), []);

  const value = useMemo<Ctx>(
    () => ({
      state,
      ready,
      setProfile,
      answer,
      logStudy,
      upsertNote,
      removeNote,
      addFlashcards,
      reviewFlashcard,
      resolveMistake,
      toggleResource,
      resetProgress,
      loadDemo,
    }),
    [
      state,
      ready,
      setProfile,
      answer,
      logStudy,
      upsertNote,
      removeNote,
      addFlashcards,
      reviewFlashcard,
      resolveMistake,
      toggleResource,
      resetProgress,
      loadDemo,
    ],
  );

  return <StudyGraphContext.Provider value={value}>{children}</StudyGraphContext.Provider>;
}

function bumpStreak(streak: AppState["streak"]): AppState["streak"] {
  const today = new Date().toISOString().slice(0, 10);
  if (streak.lastDay === today) return streak;
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const current = streak.lastDay === yesterday ? streak.current + 1 : 1;
  return { current, longest: Math.max(current, streak.longest), lastDay: today };
}

export function useStudyGraph() {
  const ctx = useContext(StudyGraphContext);
  if (!ctx) throw new Error("useStudyGraph must be used inside StudyGraphProvider");
  return ctx;
}

export { QUESTIONS, questionsForConcept };
