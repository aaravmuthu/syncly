import { MobileActions } from "@/components/quorum/MobileActions";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, Car, Check, Clock, Lock, Wallet, X } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";
import type { SyncMood } from "@/components/quorum/auth/SyncAvatar";
import { rankOptions, buildTransportPlan, type MemberInput } from "@/lib/quorum/engine";
import { estimateCost } from "@/lib/quorum/cost";
import { DEMO_GROUP, DEMO_POOL, type DemoMember } from "@/lib/quorum/demo-group";
import { SyncGuide } from "./SyncGuide";

/**
 * The guided opening of /demo: the same four friends and the same engine
 * results as the playground, one idea per step, and every step is something
 * the visitor does. Sync, the app's companion, flies to whatever needs a tap
 * and says what to do. The last step hands a chosen twist to the playground.
 *
 * Privacy holds here too: an option that drops out "doesn't work for
 * everyone" — neither the walkthrough nor Sync says whose limit or why.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

export const TWISTS = [
  { id: "halal", quote: "“I only eat halal”" },
  { id: "curfew", quote: "“I have to be home by 8:30”" },
  { id: "broke", quote: "“I can only spend $5”" },
] as const;
export type TwistId = (typeof TWISTS)[number]["id"];

function clock(t: string) {
  const [h, m] = t.split(":").map(Number);
  const base = m ? `${h % 12 || 12}:${String(m).padStart(2, "0")}` : `${h % 12 || 12}`;
  return `${base} ${h < 12 ? "am" : "pm"}`;
}

function answerLines(m: DemoMember) {
  const c = m.constraints;
  const lines: { icon: ReactNode; text: string }[] = [];
  if (c.maxSpend != null) lines.push({ icon: <Wallet />, text: `Up to $${c.maxSpend}` });
  if (c.latestEnd) lines.push({ icon: <Clock />, text: `Home by ${clock(c.latestEnd)}` });
  if (c.needsRide) lines.push({ icon: <Car />, text: "Needs a ride" });
  else if (c.canDrive) lines.push({ icon: <Car />, text: `Can drive ${c.seats ?? 3}` });
  if (c.dietary?.length) {
    const diet = c.dietary.join(", ");
    lines.push({ icon: <Check />, text: diet[0].toUpperCase() + diet.slice(1) });
  }
  return lines;
}

const STEPS = ["squad", "private", "filter", "rank", "plan", "you"] as const;
type Step = (typeof STEPS)[number];

const COPY: Record<Step, { title: string; body: string }> = {
  squad: {
    title: "Four friends. One Friday night.",
    body: "Maya, Dev, Sofia and Theo want to hang out. Normally this is where the group chat goes in circles.",
  },
  private: {
    title: "Everyone answers privately.",
    body: "Budget, curfew, rides, food. Each person sees only their own answers. The group never does.",
  },
  filter: {
    title: "Every option gets checked against everyone.",
    body: "Anything that breaks someone's limit drops out. Nobody is told whose limit, or why.",
  },
  rank: {
    title: "What's left gets ranked, fairly.",
    body: "Preferences decide the order, and fairness makes sure the same person isn't always the one compromising.",
  },
  plan: {
    title: "One plan that works for all four.",
    body: "Time, cost and rides are already solved, so the only thing left to do is say yes.",
  },
  you: {
    title: "Now change their minds.",
    body: "Pick a twist and you'll land in the playground with it applied. Then play any of the four and push the plan around.",
  },
};

/** What Sync says and points at, for each step and how far the visitor got. */
type Guide = { target: string; line: string; mood: SyncMood };

type Ranked = ReturnType<typeof rankOptions>;

export function DemoWalkthrough({ onFinish }: { onFinish: (twist?: TwistId) => void }) {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const step = STEPS[index];
  const [guide, setGuide] = useState<Guide>({
    target: "friend-m1",
    line: "Hi, I'm Sync! Tap Maya to start the group.",
    mood: "smile",
  });
  const [done, setDone] = useState(false);
  const stageRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  const [small, setSmall] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const sync = () => setSmall(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const ranked = useMemo(() => {
    const inputs: MemberInput[] = DEMO_GROUP.map((m) => ({
      profileId: m.id,
      constraints: m.constraints,
      sacrificeLoad: m.sacrificeLoad,
    }));
    return rankOptions(DEMO_POOL, inputs);
  }, []);

  const go = useCallback(
    (to: number) => {
      if (to >= STEPS.length) return onFinish();
      if (to < 0) return;
      setDir(to > index ? 1 : -1);
      setDone(false);
      setIndex(to);
    },
    [index, onFinish],
  );

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    // On phones Continue sits below a tall step; start the next one at the top.
    window.scrollTo({ top: 0, behavior: "instant" });
    headingRef.current?.focus({ preventScroll: true });
  }, [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, button, a, [contenteditable]")) return;
      if (e.key === "ArrowRight") go(index + 1);
      else if (e.key === "ArrowLeft") go(index - 1);
      else if (e.key === "Escape") onFinish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index, onFinish]);

  const report = useCallback((g: Guide, finished = false) => {
    setGuide(g);
    if (finished) setDone(true);
  }, []);

  const slide = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, x: dir * 48, filter: "blur(6px)" },
        animate: { opacity: 1, x: 0, filter: "blur(0px)" },
        exit: { opacity: 0, x: dir * -48, filter: "blur(6px)" },
      };

  const last = index === STEPS.length - 1;

  return (
    <section
      ref={stageRef}
      aria-roledescription="walkthrough"
      aria-label={`${BRAND.name} demo walkthrough`}
      className="walkthrough [--mobile-actions-surface:var(--background)] relative mx-auto flex w-full max-w-6xl flex-col px-4 sm:px-5"
    >
      <div className="flex items-center gap-3 pt-5 sm:pt-7">
        <ol className="flex flex-1 gap-1.5" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li key={s} className="h-1 flex-1 overflow-hidden rounded-full bg-foreground/10">
              <motion.span
                className="block h-full rounded-full bg-primary"
                initial={false}
                animate={{ scaleX: i < index || (i === index && done) ? 1 : i === index ? 0.4 : 0 }}
                style={{ originX: 0 }}
                transition={{ duration: reduce ? 0 : 0.5, ease: EASE }}
              />
              <span className="sr-only">
                Step {i + 1} of {STEPS.length}
                {i === index ? " (current)" : ""}
              </span>
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={() => onFinish()}
          className="tap-target inline-flex items-center gap-1 rounded-full px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Skip to playground
        </button>
      </div>

      <div className="relative flex flex-1 flex-col justify-center py-5 pb-20 sm:py-10">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            {...slide}
            transition={{ duration: reduce ? 0.15 : 0.45, ease: EASE }}
            className="grid items-center gap-5 sm:gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16"
          >
            <div>
              <p className="text-sm font-semibold text-primary tabular-nums">
                {index + 1} / {STEPS.length}
              </p>
              <h1
                ref={headingRef}
                tabIndex={-1}
                className="mt-3 max-w-[16ch] text-[2.1rem] leading-[1.06] font-semibold tracking-tight text-balance outline-none sm:text-5xl"
              >
                {COPY[step].title}
              </h1>
              <p className="mt-4 max-w-[44ch] text-base text-pretty text-muted-foreground sm:text-lg">
                {COPY[step].body}
              </p>
              <p className="sr-only" aria-live="polite">
                {guide.line}
              </p>
            </div>
            <div className="min-h-[300px] sm:min-h-[360px] lg:pr-[300px]">
              <div data-guide-lane>
                <Stage
                  step={step}
                  ranked={ranked}
                  reduce={!!reduce}
                  report={report}
                  onTwist={onFinish}
                />
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <MobileActions className="border-t border-border pt-4 pb-6">
        <button
          type="button"
          onClick={() => go(index - 1)}
          disabled={index === 0}
          className="tap-target inline-flex items-center gap-2 rounded-full px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-0"
        >
          <ArrowLeft className="size-4" aria-hidden /> Back
        </button>
        <motion.button
          type="button"
          data-guide="continue"
          onClick={() => go(index + 1)}
          whileTap={{ scale: 0.97 }}
          animate={done && !reduce ? { scale: [1, 1.06, 1] } : { scale: 1 }}
          transition={done ? { duration: 0.6, repeat: 2, ease: "easeInOut" } : undefined}
          className={cn(
            "pressable inline-flex min-h-11 items-center gap-2 rounded-full px-6 text-base font-semibold transition-colors",
            done || last
              ? "bg-primary text-primary-foreground"
              : "border border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {last ? "Just open the playground" : done ? "Continue" : "Skip this step"}
          <ArrowRight className="size-4" aria-hidden />
        </motion.button>
      </MobileActions>

      <SyncGuide
        stage={stageRef}
        target={guide.target}
        line={guide.line}
        mood={guide.mood}
        size={small ? 52 : 68}
      />
    </section>
  );
}

type StageProps = {
  ranked: Ranked;
  reduce: boolean;
  report: (g: Guide, finished?: boolean) => void;
};

function Stage({
  step,
  onTwist,
  ...props
}: StageProps & { step: Step; onTwist: (twist: TwistId) => void }) {
  switch (step) {
    case "squad":
      return <Squad {...props} />;
    case "private":
      return <PrivateAnswers {...props} />;
    case "filter":
      return <Filter {...props} />;
    case "rank":
      return <Rank {...props} />;
    case "plan":
      return <ThePlan {...props} />;
    case "you":
      return <YourTurn {...props} onTwist={onTwist} />;
  }
}

/* 1. Tap each friend to bring them into the group. */
function Squad({ reduce, report }: StageProps) {
  const [joined, setJoined] = useState<string[]>([]);
  const next = DEMO_GROUP.find((m) => !joined.includes(m.id));

  useEffect(() => {
    if (next) {
      report({
        target: `friend-${next.id}`,
        line: joined.length
          ? `Nice. Now tap ${next.name}.`
          : `Hi, I'm Sync! Tap ${next.name} to start the group.`,
        mood: joined.length ? "happy" : "smile",
      });
    } else {
      report(
        { target: "continue", line: "That's the squad! Hit Continue.", mood: "celebrate" },
        true,
      );
    }
  }, [joined, next, report]);

  return (
    <ul className="grid grid-cols-2 place-items-center gap-x-6 gap-y-8 py-6 sm:gap-x-12">
      {DEMO_GROUP.map((m, i) => {
        const inGroup = joined.includes(m.id);
        return (
          <motion.li
            key={m.id}
            initial={reduce ? false : { opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 160, damping: 18, delay: 0.1 + i * 0.08 }}
          >
            <motion.button
              type="button"
              data-guide={`friend-${m.id}`}
              aria-pressed={inGroup}
              onClick={() => setJoined((j) => (j.includes(m.id) ? j : [...j, m.id]))}
              whileTap={{ scale: 0.9 }}
              animate={
                inGroup
                  ? { scale: [1, 1.15, 1], filter: "grayscale(0)", opacity: 1 }
                  : { filter: "grayscale(1)", opacity: 0.55 }
              }
              transition={{ duration: 0.4, ease: EASE }}
              className="flex flex-col items-center gap-2 rounded-3xl p-2 outline-offset-4"
            >
              <span
                className={cn(
                  "grid size-16 place-items-center rounded-full border bg-card text-2xl shadow-[0_12px_28px_-18px_rgb(0_0_0/0.45)] transition-colors sm:size-20 sm:text-3xl",
                  inGroup ? "border-primary/60" : "border-dashed border-border",
                )}
                aria-hidden
              >
                {m.emoji}
              </span>
              <span className="font-semibold">{m.name}</span>
              <span className="text-xs text-muted-foreground">
                {inGroup ? "In" : "Tap to invite"}
              </span>
            </motion.button>
          </motion.li>
        );
      })}
    </ul>
  );
}

/* 2. Tap each sealed card to answer as that friend. Sync looks away. */
function PrivateAnswers({ reduce, report }: StageProps) {
  const [answered, setAnswered] = useState<string[]>([]);
  const [peeking, setPeeking] = useState(false);
  const next = DEMO_GROUP.find((m) => !answered.includes(m.id));

  useEffect(() => {
    if (peeking) {
      report({
        target: `card-${answered.at(-1)}`,
        line: "I'm not looking. Promise.",
        mood: "private",
      });
    } else if (next) {
      report({
        target: `card-${next.id}`,
        line: answered.length
          ? `Sealed. Now answer as ${next.name}.`
          : `Tap ${next.name}'s card to answer as ${next.name}.`,
        mood: answered.length ? "wink" : "curious",
      });
    } else {
      report(
        {
          target: "continue",
          line: "Four answers, and nobody saw anyone else's. Not even me.",
          mood: "happy",
        },
        true,
      );
    }
  }, [answered, peeking, next, report]);

  const answer = (id: string) => {
    if (answered.includes(id)) return;
    setAnswered((a) => [...a, id]);
    setPeeking(true);
    window.setTimeout(() => setPeeking(false), reduce ? 400 : 1500);
  };

  return (
    <ul className="grid grid-cols-2 gap-2.5 sm:gap-3">
      {DEMO_GROUP.map((m, i) => {
        const open = answered.includes(m.id);
        return (
          <motion.li
            key={m.id}
            initial={reduce ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: EASE, delay: 0.1 + i * 0.08 }}
          >
            <button
              type="button"
              data-guide={`card-${m.id}`}
              onClick={() => answer(m.id)}
              aria-label={open ? `${m.name}'s answers, sealed` : `Answer as ${m.name}`}
              className={cn(
                "card-surface relative block h-full w-full overflow-hidden p-3 text-left transition-shadow sm:p-4",
                !open && "hover:shadow-[0_18px_40px_-24px_var(--primary)]",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-semibold">
                  <span aria-hidden>{m.emoji}</span> {m.name}
                </span>
                {open && (
                  <motion.span
                    className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary"
                    initial={reduce ? false : { opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: "spring", stiffness: 420, damping: 22, delay: 0.5 }}
                  >
                    <Lock className="size-3" aria-hidden />
                    <span className="sr-only sm:not-sr-only">Only {m.name}</span>
                  </motion.span>
                )}
              </div>
              {open ? (
                <ul className="mt-3 space-y-1.5 text-[13px] text-muted-foreground sm:text-sm">
                  {answerLines(m).map((l, j) => (
                    <motion.li
                      key={l.text}
                      className="flex items-center gap-2 [&_svg]:size-3.5 [&_svg]:shrink-0"
                      initial={reduce ? false : { opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, ease: EASE, delay: 0.05 + j * 0.1 }}
                    >
                      {l.icon}
                      <span>{l.text}</span>
                    </motion.li>
                  ))}
                </ul>
              ) : (
                <div className="mt-3 space-y-2" aria-hidden>
                  {[80, 64, 72].map((w) => (
                    <span
                      key={w}
                      className="block h-2.5 rounded-full bg-foreground/8"
                      style={{ width: `${w}%` }}
                    />
                  ))}
                  <span className="mt-3 block text-xs font-semibold text-primary">
                    Tap to answer
                  </span>
                </div>
              )}
            </button>
          </motion.li>
        );
      })}
    </ul>
  );
}

/* 3. Press Check: every option is tested, and the misfits drop out. */
function Filter({ ranked, reduce, report }: StageProps) {
  const pool = useMemo(
    () => DEMO_POOL.map((o) => ranked.find((r) => r.option.key === o.key)!),
    [ranked],
  );
  const [phase, setPhase] = useState<"idle" | "checking" | "done">("idle");
  const [scan, setScan] = useState(-1);
  const timers = useRef<number[]>([]);
  const fit = pool.filter((r) => r.feasible).length;

  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  useEffect(() => {
    if (phase === "idle")
      report({
        target: "check",
        line: `${pool.length} places could work. Press Check and watch what drops out.`,
        mood: "curious",
      });
    else if (phase === "checking")
      report({ target: "options", line: "Checking each one against all four…", mood: "thinking" });
    else
      report(
        {
          target: "fit-count",
          line: `${fit} survive. See how I never say whose limit it was?`,
          mood: "happy",
        },
        true,
      );
  }, [phase, pool.length, fit, report]);

  const run = () => {
    if (phase !== "idle") return;
    if (reduce) {
      setScan(pool.length);
      setPhase("done");
      return;
    }
    setPhase("checking");
    timers.current = pool.map((_, i) => window.setTimeout(() => setScan(i), 160 * i));
    timers.current.push(
      window.setTimeout(
        () => {
          setScan(pool.length);
          setPhase("done");
        },
        160 * pool.length + 250,
      ),
    );
  };

  return (
    <div>
      <ul data-guide="options" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {pool.map((r, i) => {
          const tested = scan >= i;
          const out = tested && !r.feasible;
          const active = phase === "checking" && scan === i;
          return (
            <motion.li
              key={r.option.key}
              className={cn(
                "relative overflow-hidden rounded-2xl border bg-card px-3 py-2.5 transition-colors",
                active
                  ? "border-primary"
                  : tested && r.feasible
                    ? "border-primary/40"
                    : "border-border",
              )}
              initial={reduce ? false : { opacity: 0, scale: 0.9 }}
              animate={{
                opacity: out ? 0.38 : 1,
                scale: active ? 1.04 : out ? 0.96 : 1,
                filter: out ? "grayscale(1)" : "grayscale(0)",
              }}
              transition={{
                duration: 0.35,
                ease: EASE,
                delay: phase === "idle" ? 0.05 + i * 0.04 : 0,
              }}
            >
              <p className="truncate text-sm font-semibold">{r.option.title}</p>
              <p className="mt-0.5 hidden truncate text-xs text-muted-foreground sm:block">
                ${r.option.costMin}–{r.option.costMax} · {clock(r.option.start)}
              </p>
              {tested && (
                <motion.span
                  className={cn(
                    "mt-1 inline-flex items-center gap-1 text-[11px] font-medium",
                    r.feasible ? "text-success" : "text-muted-foreground",
                  )}
                  initial={reduce ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {r.feasible ? (
                    <>
                      <Check className="size-3" aria-hidden /> Works for all 4
                    </>
                  ) : (
                    <>
                      <X className="size-3" aria-hidden /> Doesn't work for everyone
                    </>
                  )}
                </motion.span>
              )}
            </motion.li>
          );
        })}
      </ul>
      <div className="mt-5 flex min-h-11 items-center gap-4">
        {phase === "idle" ? (
          <motion.button
            type="button"
            data-guide="check"
            onClick={run}
            whileTap={{ scale: 0.96 }}
            className="pressable inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 font-semibold text-primary-foreground"
          >
            <Check className="size-4" aria-hidden /> Check all {pool.length}
          </motion.button>
        ) : (
          <p data-guide="fit-count" className="text-sm font-medium tabular-nums">
            {phase === "done" ? (
              <>
                <span className="text-primary">{fit}</span> of {pool.length} work for all four
              </>
            ) : (
              <span className="text-muted-foreground">
                Checking {Math.min(scan + 1, pool.length)} of {pool.length}…
              </span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

/* 4. Guess the winner, then watch the real ranking settle. */
function Rank({ ranked, reduce, report }: StageProps) {
  const fits = useMemo(() => ranked.filter((r) => r.feasible), [ranked]);
  const shuffled = useMemo(
    () => DEMO_POOL.map((o) => fits.find((f) => f.option.key === o.key)).filter(Boolean) as Ranked,
    [fits],
  );
  const [guess, setGuess] = useState<string | null>(null);
  const sorted = guess !== null;
  const winner = fits[0];
  const list = sorted ? fits : shuffled;
  const best = winner?.score || 1;

  useEffect(() => {
    if (!guess) {
      report({
        target: `rank-${shuffled[0]?.option.key}`,
        line: "These four all fit. Which one wins? Tap your guess.",
        mood: "curious",
      });
      return;
    }
    const right = guess === winner.option.key;
    const t = window.setTimeout(
      () =>
        report(
          {
            target: `rank-${winner.option.key}`,
            line: right
              ? `Nailed it! ${winner.option.title} is the fairest fit for everyone.`
              : `So close! ${winner.option.title} edges it: it's fairer to whoever compromised last time.`,
            mood: right ? "celebrate" : "surprised",
          },
          true,
        ),
      reduce ? 0 : 650,
    );
    return () => window.clearTimeout(t);
  }, [guess, shuffled, winner, reduce, report]);

  return (
    <LayoutGroup>
      <ol className="space-y-2.5">
        {list.map((r, i) => {
          const top = sorted && i === 0;
          const picked = guess === r.option.key;
          return (
            <motion.li
              layout={!reduce}
              key={r.option.key}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0, scale: top ? 1.02 : 1 }}
              transition={{ type: "spring", stiffness: 240, damping: 26 }}
            >
              <button
                type="button"
                data-guide={`rank-${r.option.key}`}
                disabled={sorted}
                onClick={() => setGuess(r.option.key)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl border bg-card px-4 py-3 text-left transition-shadow",
                  top
                    ? "border-primary/50 shadow-[0_18px_40px_-24px_var(--primary)]"
                    : "border-border",
                  !sorted && "hover:border-primary/40",
                )}
              >
                <span className="w-5 text-sm font-semibold text-muted-foreground tabular-nums">
                  {sorted ? i + 1 : "?"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{r.option.title}</span>
                  <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-foreground/10">
                    <motion.span
                      className="block h-full rounded-full bg-primary"
                      style={{ originX: 0 }}
                      initial={false}
                      animate={{ scaleX: sorted ? Math.max(0.08, r.score / best) : 0.04 }}
                      transition={{ duration: 0.7, ease: EASE, delay: 0.2 + i * 0.08 }}
                    />
                  </span>
                </span>
                {picked && (
                  <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                    Your guess
                  </span>
                )}
                {top && (
                  <motion.span
                    className="shrink-0 rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground"
                    initial={reduce ? false : { opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: "spring", stiffness: 420, damping: 20, delay: 0.6 }}
                  >
                    Top pick
                  </motion.span>
                )}
              </button>
            </motion.li>
          );
        })}
      </ol>
    </LayoutGroup>
  );
}

/* 5. Lock it in: the plan's details assemble and everyone joins. */
function ThePlan({ ranked, reduce, report }: StageProps) {
  const o = ranked[0].option;
  const [locked, setLocked] = useState(false);
  const cost = estimateCost({
    costMin: o.costMin,
    costMax: o.costMax,
    travelMinutes: o.travelMinutes,
    category: "hangout",
    headcount: DEMO_GROUP.length,
    requiresDriving: o.requiresDriving,
  });
  const transport = o.requiresDriving
    ? buildTransportPlan(
        o,
        DEMO_GROUP.map((m) => ({ profileId: m.id, name: m.name, constraints: m.constraints })),
      )
    : null;
  const rides =
    transport?.cars
      .filter((c) => c.passengers.length)
      .map((c) => `${c.driver} drives ${c.passengers.join(" & ")}`)
      .join(" · ") || "Close enough that everyone gets there on their own";

  useEffect(() => {
    if (!locked) {
      report({
        target: "lock",
        line: "Tap Lock it in and I'll sort out the details.",
        mood: "smile",
      });
      return;
    }
    const t = window.setTimeout(
      () =>
        report(
          { target: "crew", line: "Time, cost and rides: done. Everyone's in!", mood: "celebrate" },
          true,
        ),
      reduce ? 0 : 1300,
    );
    return () => window.clearTimeout(t);
  }, [locked, reduce, report]);

  const rows: { icon: ReactNode; label: string; value: string }[] = [
    { icon: <Clock />, label: "When", value: `${clock(o.start)} – ${clock(o.end)}` },
    { icon: <Wallet />, label: "Each", value: `$${cost.perPersonMin}–${cost.perPersonMax}` },
    { icon: <Car />, label: "Rides", value: rides },
  ];

  return (
    <motion.article
      className="card-surface overflow-hidden p-6 sm:p-7"
      initial={reduce ? false : { opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: EASE }}
    >
      <span className="inline-flex items-center gap-1.5 rounded-full bg-success/12 px-2.5 py-1 text-xs font-semibold text-success">
        Works for all 4
      </span>
      <h2 className="mt-3 text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
        {o.title}
      </h2>
      <p className="mt-1 text-muted-foreground">{o.subtitle}</p>

      {locked ? (
        <>
          <dl className="mt-6 divide-y divide-border border-t border-border">
            {rows.map((r, i) => (
              <motion.div
                key={r.label}
                className="flex items-start gap-3 py-3 text-sm [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-primary"
                initial={reduce ? false : { opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, ease: EASE, delay: 0.1 + i * 0.22 }}
              >
                {r.icon}
                <dt className="w-14 shrink-0 text-muted-foreground">{r.label}</dt>
                <dd className="font-medium">{r.value}</dd>
              </motion.div>
            ))}
          </dl>
          <div data-guide="crew" className="mt-5 flex w-fit -space-x-2">
            {DEMO_GROUP.map((m, i) => (
              <motion.span
                key={m.id}
                className="grid size-9 place-items-center rounded-full border-2 border-card bg-surface text-base"
                initial={reduce ? false : { opacity: 0, scale: 0.4, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 16, delay: 0.85 + i * 0.12 }}
                aria-hidden
              >
                {m.emoji}
              </motion.span>
            ))}
            <span className="sr-only">Maya, Dev, Sofia and Theo are all in.</span>
          </div>
        </>
      ) : (
        <motion.button
          type="button"
          data-guide="lock"
          onClick={() => setLocked(true)}
          whileTap={{ scale: 0.96 }}
          className="pressable mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 font-semibold text-primary-foreground"
        >
          <Lock className="size-4" aria-hidden /> Lock it in
        </motion.button>
      )}
    </motion.article>
  );
}

/* 6. Pick a twist; the playground opens with it applied. */
function YourTurn({ reduce, report, onTwist }: StageProps & { onTwist: (t: TwistId) => void }) {
  useEffect(() => {
    report({
      target: `twist-${TWISTS[0].id}`,
      line: "Your turn. Pick a twist and I'll show you what changes.",
      mood: "wink",
    });
  }, [report]);

  return (
    <div className="grid place-items-center py-6">
      <ul className="flex w-full max-w-sm flex-col gap-3">
        {TWISTS.map((t, i) => (
          <motion.li
            key={t.id}
            initial={reduce ? false : { opacity: 0, y: 16, rotate: i % 2 ? 2 : -2 }}
            animate={{ opacity: 1, y: 0, rotate: i % 2 ? 1 : -1 }}
            transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.15 + i * 0.15 }}
          >
            <motion.button
              type="button"
              data-guide={`twist-${t.id}`}
              onClick={() => onTwist(t.id)}
              whileHover={reduce ? undefined : { scale: 1.03, rotate: 0 }}
              whileTap={{ scale: 0.96 }}
              className="glass-pill w-full rounded-full border border-border px-5 py-3 text-center font-medium transition-colors hover:border-primary/50"
            >
              {t.quote}
            </motion.button>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
