import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUp, Check, Sparkles, TriangleAlert, Wand2 } from "lucide-react";
import { ThinkingOrb } from "thinking-orbs";
import { Pill } from "@/components/quorum/ui";
import { haptic } from "@/lib/quorum/haptics";
import { rankOptions } from "@/lib/quorum/engine";
import type { DemoMember } from "@/lib/quorum/demo-group";
import type { OptionSeed } from "@/lib/quorum/types";
import {
  ASK_STARTERS,
  MAGIC_EXAMPLES,
  answerQuestion,
  draftFromPrompt,
  findCompromise,
  inputsOf,
  type Answer,
  type MagicDraft,
} from "@/lib/quorum/demo-ai";
import { RescueTimeline } from "./RescueTimeline";
import { EASE_OUT, SPRING, Typewriter, clockRange, joinNames } from "./shared";

export type PanelProps = {
  members: DemoMember[];
  pool: OptionSeed[];
  /** Put an option in the main plan card. */
  onShow: (option: OptionSeed) => void;
};

const SIMULATED = "Sample answers from the same engine the app uses. Sign in for the live AI.";

/** How long the "thinking" beat lasts. Long enough to read as work, short enough to not drag. */
const THINK_MS = 900;

function usePending(ms = THINK_MS) {
  const reduce = useReducedMotion();
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (run: () => void, setPending: (p: boolean) => void) => {
    setPending(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(
      () => {
        setPending(false);
        run();
      },
      reduce ? 0 : ms,
    );
  };
}

function Thinking({ state, label }: { state: "searching" | "working" | "solving"; label: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex items-center gap-2.5 py-2 text-sm text-muted-foreground"
      role="status"
    >
      <ThinkingOrb state={state} size={32} aria-hidden="true" />
      {label}
    </motion.div>
  );
}

/* --------------------------------- Ask --------------------------------- */

type Turn = { q: string; a: Answer };

export function AskPanel({ members, pool, onShow }: PanelProps) {
  const reduce = useReducedMotion();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [asking, setAsking] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const think = usePending();

  const send = (q: string) => {
    const text = q.trim();
    if (!text || pending) return;
    haptic("tap");
    setDraft("");
    setAsking(text);
    think(() => {
      setTurns((t) => [...t.slice(-3), { q: text, a: answerQuestion(text, members, pool) }]);
      setAsking(null);
      setTyping(true);
    }, setPending);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(draft);
  };

  const last = turns[turns.length - 1];
  const followUps = last && !pending && !typing ? last.a.followUps : ASK_STARTERS;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight">Ask Syncly</h2>
        <Pill tone="accent">
          <Sparkles className="size-3" /> AI
        </Pill>
      </div>
      <p className="mt-1.5 text-sm text-pretty text-muted-foreground">
        Ask about {joinNames(members.map((m) => m.name))}'s night. It answers from everyone's
        private answers without saying whose they are.
      </p>

      <div className="mt-4 space-y-3" aria-live="polite">
        {turns.map((t, i) => {
          const isLast = i === turns.length - 1;
          return (
            <motion.div
              key={`${i}-${t.q}`}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: EASE_OUT }}
              className="space-y-2"
            >
              <div className="ml-auto w-fit max-w-[88%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-[0.9375rem] text-primary-foreground">
                {t.q}
              </div>
              <div className="max-w-[94%] rounded-2xl rounded-bl-md bg-secondary px-3.5 py-2.5 text-[0.9375rem] text-pretty">
                {isLast ? <Typewriter text={t.a.text} onDone={() => setTyping(false)} /> : t.a.text}
                {t.a.pick && (!isLast || !typing) && (
                  <button
                    type="button"
                    onClick={() => {
                      haptic("select");
                      onShow(t.a.pick!.option);
                    }}
                    className="pressable active:pressable-active mt-2.5 flex min-h-11 w-full items-center justify-between gap-3 rounded-xl bg-card px-3 text-left"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">
                        {t.a.pick.option.title}
                      </span>
                      <span className="block text-xs text-muted-foreground tabular-nums">
                        {clockRange(t.a.pick.option.start, t.a.pick.option.end)} · $
                        {t.a.pick.option.costMin}–{t.a.pick.option.costMax}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-medium text-primary">Show plan</span>
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
        {asking && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
            className="ml-auto w-fit max-w-[88%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-[0.9375rem] text-primary-foreground"
          >
            {asking}
          </motion.div>
        )}
        <AnimatePresence>
          {pending && (
            <Thinking state="searching" label={`Looking at ${members.length} private answers…`} />
          )}
        </AnimatePresence>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {followUps.map((s) => (
          <button
            key={s}
            type="button"
            disabled={pending}
            onClick={() => send(s)}
            className="pressable active:pressable-active min-h-11 rounded-full border border-border px-3.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="mt-3 flex items-center gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Ask about your night</span>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={120}
            placeholder="Ask anything about the plan…"
            className="min-h-12 w-full rounded-full border border-border bg-card px-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          />
        </label>
        <button
          type="submit"
          disabled={!draft.trim() || pending}
          aria-label="Send"
          className="pressable active:pressable-active grid size-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
        >
          <ArrowUp className="size-5" />
        </button>
      </form>
      <p className="mt-2.5 text-xs text-muted-foreground">{SIMULATED}</p>
    </div>
  );
}

/* -------------------------------- Describe -------------------------------- */

export function MagicPanel({ members, pool, onShow }: PanelProps) {
  const reduce = useReducedMotion();
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<MagicDraft | "none" | null>(null);
  const think = usePending(1100);

  const run = (prompt: string) => {
    if (!prompt.trim() || pending) return;
    haptic("tap");
    setText(prompt);
    setResult(null);
    think(() => setResult(draftFromPrompt(prompt, members, pool) ?? "none"), setPending);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight">Describe a night</h2>
        <Pill tone="accent">
          <Wand2 className="size-3" /> AI
        </Pill>
      </div>
      <p className="mt-1.5 text-sm text-pretty text-muted-foreground">
        Say what you're after in your own words. Syncly turns it into a plan, then checks it against
        everyone.
      </p>

      <form
        className="mt-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(text);
        }}
      >
        <label>
          <span className="sr-only">Describe your night</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            maxLength={140}
            placeholder="Cozy, indoors, nothing over $20…"
            className="w-full resize-none rounded-2xl border border-border bg-card px-4 py-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          />
        </label>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {MAGIC_EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              disabled={pending}
              onClick={() => run(ex)}
              className="pressable active:pressable-active min-h-11 rounded-full border border-border px-3.5 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
            >
              {ex}
            </button>
          ))}
        </div>
        <button
          type="submit"
          disabled={!text.trim() || pending}
          className="pressable active:pressable-active mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 text-base font-semibold text-primary-foreground disabled:opacity-40"
        >
          <Wand2 className="size-4" /> Plan it
        </button>
      </form>

      <div className="mt-4" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          {pending && <Thinking key="t" state="working" label="Reading your brief…" />}
          {!pending && result === "none" && (
            <motion.p
              key="none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl bg-secondary px-3.5 py-3 text-sm text-muted-foreground"
            >
              I couldn't pick out a vibe, budget or time in that. Try something like "cozy and
              indoors, under $20".
            </motion.p>
          )}
          {!pending && result && result !== "none" && (
            <motion.div key={result.pick.option.key + text} className="space-y-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-sm text-muted-foreground">Got it:</span>
                {result.understood.map((u, i) => (
                  <motion.span
                    key={u}
                    initial={reduce ? false : { opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: reduce ? 0 : i * 0.09, ...SPRING }}
                  >
                    <Pill tone="accent">{u}</Pill>
                  </motion.span>
                ))}
              </div>
              <motion.div
                initial={reduce ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: reduce ? 0 : 0.15 + result.understood.length * 0.09,
                  duration: 0.4,
                  ease: EASE_OUT,
                }}
                className="rounded-2xl bg-secondary p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-lg leading-tight font-semibold">
                      {result.pick.option.title}
                    </div>
                    <div className="mt-0.5 text-sm text-muted-foreground">
                      {result.pick.option.subtitle}
                    </div>
                  </div>
                  {result.worksForAll ? (
                    <Pill tone="good" className="shrink-0">
                      <Check className="size-3" /> Works for all {members.length}
                    </Pill>
                  ) : (
                    <Pill tone="warn" className="shrink-0">
                      <TriangleAlert className="size-3" /> Not for everyone
                    </Pill>
                  )}
                </div>
                <p className="mt-2 text-sm text-pretty text-muted-foreground">
                  {result.worksForAll
                    ? "Fits your brief and every private limit in the group."
                    : "Closest to your brief, but at least one limit in the group rules it out. Ask for something else, or change a limit."}
                </p>
                {result.worksForAll && (
                  <button
                    type="button"
                    onClick={() => {
                      haptic("select");
                      onShow(result.pick.option);
                    }}
                    className="pressable active:pressable-active mt-3 inline-flex min-h-11 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground"
                  >
                    Show it in the plan
                  </button>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{SIMULATED}</p>
    </div>
  );
}

/* -------------------------------- Rescue -------------------------------- */

export function RescuePanel({
  members,
  pool,
  onShow,
  onBreak,
  onReset,
  broken,
}: PanelProps & { onBreak: () => void; onReset: () => void; broken: boolean }) {
  const reduce = useReducedMotion();
  const [pending, setPending] = useState(false);
  const [asked, setAsked] = useState(false);
  const [applied, setApplied] = useState(false);
  const think = usePending(1400);

  const fix = useMemo(
    () => (broken ? findCompromise(pool, members) : null),
    [broken, pool, members],
  );
  const anyWorks = useMemo(
    () => rankOptions(pool, inputsOf(members)).some((r) => r.feasible),
    [pool, members],
  );

  // A new dead end (or a reset) is a new question.
  useEffect(() => {
    setAsked(false);
    setApplied(false);
  }, [broken]);

  const ask = () => {
    haptic("tap");
    think(() => setAsked(true), setPending);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight">Rescue a dead end</h2>
        <Pill tone="accent">
          <Sparkles className="size-3" /> AI
        </Pill>
      </div>
      <p className="mt-1.5 text-sm text-pretty text-muted-foreground">
        Sometimes nothing works. Instead of everyone arguing, Syncly looks for the smallest change
        that gets the whole group back to a plan.
      </p>

      {!broken && (
        <div className="mt-5">
          <button
            type="button"
            onClick={() => {
              haptic("warn");
              onBreak();
            }}
            className="pressable active:pressable-active inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-destructive/40 px-6 text-base font-semibold text-destructive hover:bg-destructive/8"
          >
            Make tonight fall apart
          </button>
          <p className="mt-2.5 text-sm text-muted-foreground">
            A family dinner moves up and everyone has to be home by 6. Watch what the plan does.
          </p>
        </div>
      )}

      {broken && (
        <div className="mt-5 space-y-3" aria-live="polite">
          {!asked && !pending && (
            <button
              type="button"
              onClick={ask}
              className="pressable active:pressable-active inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 text-base font-semibold text-primary-foreground"
            >
              <Sparkles className="size-4" /> Find a fix
            </button>
          )}
          <AnimatePresence>
            {pending && <Thinking state="solving" label="Trying every option a little earlier…" />}
          </AnimatePresence>

          {asked && fix && !applied && (
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={SPRING}
            >
              <RescueTimeline
                fix={fix}
                members={members}
                onUse={(shifted) => {
                  setApplied(true);
                  onShow(shifted);
                }}
              />
            </motion.div>
          )}

          {asked && !fix && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl bg-secondary px-3.5 py-3 text-sm text-pretty text-muted-foreground"
            >
              Moving the time doesn't fix this one. A limit on money or distance is ruling things
              out, and that takes someone to loosen it. I won't say whose.
            </motion.p>
          )}

          {applied && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 rounded-2xl bg-success/12 px-3.5 py-3 text-sm text-success"
            >
              <Check className="size-4" /> Plan updated. Check the card.
            </motion.p>
          )}

          {!pending && (
            <button
              type="button"
              onClick={() => {
                onReset();
                setApplied(false);
              }}
              className="tap-target inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
            >
              Put everyone's answers back
            </button>
          )}
        </div>
      )}

      {!broken && !anyWorks && (
        <p className="mt-3 text-sm text-muted-foreground">
          Nothing works right now, but it wasn't caused here. Put the answers back from the
          playground.
        </p>
      )}
      <p className="mt-3 text-xs text-muted-foreground">{SIMULATED}</p>
    </div>
  );
}
