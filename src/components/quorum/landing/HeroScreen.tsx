import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useInView,
  useMotionValueEvent,
  type MotionValue,
} from "motion/react";
import { Check, Lock } from "lucide-react";
import { ThinkingOrb } from "thinking-orbs";
import { DEMO_MEMBERS, rankDemo, withAnswers } from "@/lib/quorum/demoSample";

/*
 * The landing iPad's screen, rendered live instead of a screenshot: the sample
 * group from /demo answers privately, the real engine ranks, and then an
 * answer changes and the list re-ranks, on a loop. The layout is drawn at a
 * fixed base size and scaled to the glass, so it keeps its proportions at any
 * device size; a portrait glass (phones) gets a single-column layout.
 */

const BASE = {
  landscape: { w: 880, h: 612 },
  portrait: { w: 440, h: 633 },
} as const;
type Orientation = keyof typeof BASE;

const EASE = [0.23, 1, 0.32, 1] as const;

// Each scenario is one private change to the sample group, checked against
// the engine to reorder the shortlist visibly. The group is never told whose
// answer changed or what it was, so neither is the screen.
const SCENARIOS = [
  DEMO_MEMBERS,
  withAnswers(DEMO_MEMBERS, "m1", { latestEnd: "23:30", maxSpend: 40 }),
  withAnswers(DEMO_MEMBERS, "m3", { latestEnd: "20:30" }),
];
const RESULTS = SCENARIOS.map((members) =>
  rankDemo("hangout", members)
    .filter((r) => r.feasible)
    .slice(0, 3),
);

type Phase = "off" | "answering" | "solving" | "ranked" | "changed";

// Milliseconds from the screen waking.
const ANSWERED_AT = [450, 850, 1250, 1650];
const SOLVE_AT = 1900;
const RANKED_AT = 3100;
const HOLD = 3600;
const RESOLVE = 1000;

export function HeroScreen({ on, still }: { on: MotionValue<number>; still: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const inView = useInView(box, { amount: 0.3 });

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The screen's own clock starts when the glass lights up and rewinds when
  // it goes dark again, so scrolling back up replays it.
  const [awake, setAwake] = useState(still);
  useMotionValueEvent(on, "change", (v) => {
    if (v > 0.12) setAwake(true);
    else if (v < 0.02) setAwake(false);
  });

  const [phase, setPhase] = useState<Phase>(still ? "ranked" : "off");
  const [answered, setAnswered] = useState(still ? 4 : 0);
  const [scenario, setScenario] = useState(0);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  // Reduced motion is only known after hydration: jump to the settled frame.
  useEffect(() => {
    if (!still) return;
    setAwake(true);
    setAnswered(4);
    setPhase("ranked");
  }, [still]);

  // Intro: everyone answers, the engine thinks, the shortlist lands.
  useEffect(() => {
    if (still) return;
    if (!awake) {
      setPhase("off");
      setAnswered(0);
      setScenario(0);
      return;
    }
    if (!inView || phaseRef.current === "ranked" || phaseRef.current === "changed") return;
    setAnswered(0);
    setPhase("answering");
    const timers = [
      ...ANSWERED_AT.map((ms, i) => window.setTimeout(() => setAnswered(i + 1), ms)),
      window.setTimeout(() => setPhase("solving"), SOLVE_AT),
      window.setTimeout(() => setPhase("ranked"), RANKED_AT),
    ];
    return () => timers.forEach(clearTimeout);
  }, [awake, inView, still]);

  // Loop: hold the shortlist, then one private change re-ranks it.
  useEffect(() => {
    if (still || !awake || !inView) return;
    if (phase === "ranked") {
      const t = window.setTimeout(() => setPhase("changed"), HOLD);
      return () => clearTimeout(t);
    }
    if (phase === "changed") {
      const t = window.setTimeout(() => {
        setScenario((s) => (s + 1) % SCENARIOS.length);
        setPhase("ranked");
      }, RESOLVE);
      return () => clearTimeout(t);
    }
  }, [awake, inView, phase, still]);

  const orientation: Orientation = size && size.h > size.w ? "portrait" : "landscape";
  const base = BASE[orientation];
  const scale = size ? size.w / base.w : 0;

  return (
    <div ref={box} className="absolute inset-0 overflow-hidden">
      {size && (
        <div
          className="absolute top-0 left-0 origin-top-left bg-background text-foreground"
          style={{ width: base.w, height: base.h, transform: `scale(${scale})` }}
        >
          <Screen
            orientation={orientation}
            phase={phase}
            answered={answered}
            scenario={scenario}
            orbOn={inView && awake && !still}
          />
        </div>
      )}
    </div>
  );
}

function Screen({
  orientation,
  phase,
  answered,
  scenario,
  orbOn,
}: {
  orientation: Orientation;
  phase: Phase;
  answered: number;
  scenario: number;
  orbOn: boolean;
}) {
  const portrait = orientation === "portrait";
  const showResults = phase === "ranked" || phase === "changed";
  const solving = phase === "solving" || phase === "changed";

  return (
    <div className="flex h-full flex-col">
      <AppBar live={phase !== "off"} />
      <div
        className={
          portrait
            ? "flex min-h-0 flex-1 flex-col gap-4 p-5"
            : "grid min-h-0 flex-1 grid-cols-[300px_1fr] gap-6 p-6"
        }
      >
        <Members compact={portrait} answered={answered} phase={phase} />

        <section className="relative flex min-h-0 flex-1 flex-col">
          <div className="text-[13px] text-muted-foreground">Ranked for all 4 — best fit first</div>

          <div className="relative mt-3 min-h-0 flex-1">
            <motion.ol
              animate={{ opacity: phase === "changed" ? 0.45 : 1 }}
              transition={{ duration: 0.3 }}
              className="space-y-3"
            >
              <AnimatePresence initial={false} mode="popLayout">
                {showResults &&
                  RESULTS[scenario]!.map((r, i) => (
                    <ResultCard
                      key={r.option.key}
                      rank={i}
                      title={r.option.title}
                      subtitle={r.option.subtitle}
                      score={r.score}
                      price={`$${r.option.costMin}–$${r.option.costMax}`}
                      when={`${r.option.start}–${r.option.end}`}
                      fairness={r.breakdown.fairness}
                      compact={portrait}
                    />
                  ))}
              </AnimatePresence>
            </motion.ol>

            <AnimatePresence>
              {solving && (
                <motion.div
                  key="orb"
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className="absolute inset-x-0 top-6 flex justify-center"
                >
                  <div className="flex flex-col items-center gap-3 rounded-3xl bg-background/85 px-6 py-5 text-[13px] text-muted-foreground backdrop-blur-sm">
                    <ThinkingOrb state="solving" size={64} theme="auto" paused={!orbOn} />
                    <span>
                      {phase === "changed"
                        ? "An answer changed privately…"
                        : "Ranking plans for 4 people…"}
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>
      </div>
    </div>
  );
}

function AppBar({ live }: { live: boolean }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-5">
      <div className="flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-lg bg-primary text-[15px] font-bold text-primary-foreground">
          S
        </span>
        <span className="font-display text-[17px] font-semibold">Saturday plan</span>
      </div>
      <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
        <span className="relative flex size-2">
          {live && (
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
          )}
          <span className="relative inline-flex size-2 rounded-full bg-success" />
        </span>
        4 here
      </div>
    </header>
  );
}

function Members({
  compact,
  answered,
  phase,
}: {
  compact: boolean;
  answered: number;
  phase: Phase;
}) {
  if (compact) {
    return (
      <div className="flex shrink-0 justify-between rounded-2xl border border-border bg-card px-4 py-3">
        {DEMO_MEMBERS.map((m, i) => (
          <div key={m.id} className="flex flex-col items-center gap-1">
            <span className="relative grid size-11 place-items-center rounded-full bg-secondary text-[20px]">
              {m.emoji}
              <Status done={i < answered} pending={phase === "answering"} />
            </span>
            <span className="text-[12px] font-medium">{m.name}</span>
          </div>
        ))}
      </div>
    );
  }
  return (
    <aside className="flex flex-col gap-3">
      <div className="text-[13px] font-semibold">Private answers</div>
      <ul className="space-y-2">
        {DEMO_MEMBERS.map((m, i) => {
          const done = i < answered;
          return (
            <li
              key={m.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2.5"
            >
              <span className="relative grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-[17px]">
                {m.emoji}
                <Status done={done} pending={phase === "answering"} />
              </span>
              <div className="min-w-0">
                <div className="text-[14px] font-medium">{m.name}</div>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={done ? "done" : "typing"}
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -3 }}
                    transition={{ duration: 0.2, ease: EASE }}
                    className="flex items-center gap-1 text-[12px] text-muted-foreground"
                  >
                    {done ? (
                      <>
                        <Lock className="size-3" /> Answered privately
                      </>
                    ) : phase === "answering" ? (
                      <>
                        Answering <TypingDots />
                      </>
                    ) : (
                      "Invited"
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-auto rounded-2xl bg-primary/8 p-3 text-[12px] leading-snug text-muted-foreground">
        Only the outcome is shared. Nobody sees who needed what.
      </p>
    </aside>
  );
}

function Status({ done, pending }: { done: boolean; pending: boolean }) {
  return (
    <AnimatePresence>
      {done ? (
        <motion.span
          key="done"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", duration: 0.35, bounce: 0.4 }}
          className="absolute -right-0.5 -bottom-0.5 grid size-4 place-items-center rounded-full bg-success text-white ring-2 ring-card"
        >
          <Check className="size-2.5" strokeWidth={3} />
        </motion.span>
      ) : pending ? (
        <motion.span
          key="pending"
          exit={{ opacity: 0 }}
          className="absolute -right-0.5 -bottom-0.5 size-3 animate-pulse rounded-full bg-warning ring-2 ring-card"
        />
      ) : null}
    </AnimatePresence>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-0.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-1 rounded-full bg-current"
          animate={{ opacity: [0.25, 1, 0.25] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </span>
  );
}

function ResultCard({
  rank,
  title,
  subtitle,
  score,
  price,
  when,
  fairness,
  compact,
}: {
  rank: number;
  title: string;
  subtitle: string;
  score: number;
  price: string;
  when: string;
  fairness: number;
  compact: boolean;
}) {
  const top = rank === 0;
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, transition: { duration: 0.2 } }}
      transition={{ duration: 0.45, ease: EASE, delay: rank * 0.08 }}
      className={`rounded-2xl border bg-card px-4 py-3 ${
        top ? "border-primary/40 shadow-[0_6px_20px_-12px_var(--primary)]" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-[15px] font-semibold">{title}</span>
            <AnimatePresence>
              {top && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.25, ease: EASE, delay: 0.2 }}
                  className="shrink-0 rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-medium text-primary"
                >
                  Best for everyone
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <div className="mt-0.5 truncate text-[12px] text-muted-foreground">{subtitle}</div>
        </div>
        <CountUp value={score} className="text-[22px] leading-none font-semibold tabular-nums" />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
        <span className="rounded-full bg-secondary px-2 py-0.5">{price}</span>
        <span className="rounded-full bg-secondary px-2 py-0.5">{when}</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 font-medium text-success">
          <Check className="size-3" /> Works for all 4
        </span>
      </div>
      {top && !compact && (
        <div className="mt-2.5">
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>Fairness</span>
            <span className="tabular-nums">{fairness}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${fairness}%` }}
              transition={{ duration: 0.8, ease: EASE, delay: 0.25 }}
            />
          </div>
        </div>
      )}
    </motion.li>
  );
}

function CountUp({ value, className }: { value: number; className?: string }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const controls = animate(from.current, value, {
      duration: 0.7,
      ease: EASE,
      onUpdate: (v) => {
        from.current = v;
        setShown(Math.round(v));
      },
    });
    return () => controls.stop();
  }, [value]);
  return <span className={className}>{shown}</span>;
}
