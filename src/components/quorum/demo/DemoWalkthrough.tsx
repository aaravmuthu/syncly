import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, Car, Clock, Lock, Wallet, X } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { rankOptions, buildTransportPlan, type MemberInput } from "@/lib/quorum/engine";
import { estimateCost } from "@/lib/quorum/cost";
import { DEMO_GROUP, DEMO_POOL, type DemoMember } from "@/lib/quorum/demo-group";

/**
 * The guided opening of /demo: the same four friends and the same engine
 * results as the playground, told one idea at a time. Each step stages its
 * own small animation; nothing appears until the step it belongs to. The
 * last step hands over to the playground.
 *
 * Privacy holds here too: an option that drops out "doesn't work for
 * everyone" — the walkthrough never says whose answer or which limit.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

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
  if (c.dietary?.length)
    lines.push({
      icon: <span aria-hidden>•</span>,
      text: c.dietary.join(", ").replace(/^./, (ch) => ch.toUpperCase()),
    });
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
    body: "Play any of the four. Tighten a budget, move a curfew, take away a ride, and watch the plan adapt live.",
  },
};

export function DemoWalkthrough({ onFinish }: { onFinish: () => void }) {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const step = STEPS[index];
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

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
      setIndex(to);
    },
    [index, onFinish],
  );

  // Move focus to the new step's heading so screen readers hear it.
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
      if (t?.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "ArrowRight") go(index + 1);
      else if (e.key === "ArrowLeft") go(index - 1);
      else if (e.key === "Escape") onFinish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index, onFinish]);

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
      aria-roledescription="walkthrough"
      aria-label={`${BRAND.name} demo walkthrough`}
      className="walkthrough mx-auto flex w-full max-w-6xl flex-col px-4 sm:px-5"
    >
      <div className="flex items-center gap-3 pt-5 sm:pt-7">
        <ol className="flex flex-1 gap-1.5" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li key={s} className="h-1 flex-1 overflow-hidden rounded-full bg-foreground/10">
              <motion.span
                className="block h-full rounded-full bg-primary"
                initial={false}
                animate={{ scaleX: i <= index ? 1 : 0 }}
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
          onClick={onFinish}
          className="tap-target inline-flex items-center gap-1 rounded-full px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Skip to playground
        </button>
      </div>

      <div className="relative flex flex-1 flex-col justify-center py-8 sm:py-10">
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.div
            key={step}
            {...slide}
            transition={{ duration: reduce ? 0.15 : 0.45, ease: EASE }}
            className="grid items-center gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14"
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
            </div>
            <div className="min-h-[300px] sm:min-h-[360px]">
              <Stage step={step} ranked={ranked} reduce={!!reduce} />
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="safe-bottom flex items-center justify-between gap-3 border-t border-border pt-4 pb-6">
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
          onClick={() => go(index + 1)}
          whileTap={{ scale: 0.97 }}
          className="pressable inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-6 text-base font-semibold text-primary-foreground"
        >
          {last ? "Open the playground" : "Continue"}
          <ArrowRight className="size-4" aria-hidden />
        </motion.button>
      </div>
    </section>
  );
}

type Ranked = ReturnType<typeof rankOptions>;

function Stage({ step, ranked, reduce }: { step: Step; ranked: Ranked; reduce: boolean }) {
  switch (step) {
    case "squad":
      return <Squad reduce={reduce} />;
    case "private":
      return <PrivateAnswers reduce={reduce} />;
    case "filter":
      return <Filter ranked={ranked} reduce={reduce} />;
    case "rank":
      return <Rank ranked={ranked} reduce={reduce} />;
    case "plan":
      return <ThePlan ranked={ranked} reduce={reduce} />;
    case "you":
      return <YourTurn reduce={reduce} />;
  }
}

function Avatar({ m, className }: { m: DemoMember; className?: string }) {
  return (
    <span
      className={cn(
        "grid size-16 place-items-center rounded-full border border-border bg-card text-2xl shadow-[0_12px_28px_-18px_rgb(0_0_0/0.45)] sm:size-20 sm:text-3xl",
        className,
      )}
      aria-hidden
    >
      {m.emoji}
    </span>
  );
}

/* 1. The four friends drift in from the corners and gather in the middle. */
function Squad({ reduce }: { reduce: boolean }) {
  const from = [
    { x: -140, y: -90 },
    { x: 140, y: -110 },
    { x: -120, y: 110 },
    { x: 150, y: 90 },
  ];
  return (
    <ul className="grid grid-cols-2 place-items-center gap-x-6 gap-y-8 py-6 sm:gap-x-12">
      {DEMO_GROUP.map((m, i) => (
        <motion.li
          key={m.id}
          className="flex flex-col items-center gap-2"
          initial={reduce ? false : { opacity: 0, x: from[i].x, y: from[i].y, scale: 0.6 }}
          animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 140, damping: 18, delay: 0.15 + i * 0.12 }}
        >
          <Avatar m={m} />
          <span className="font-semibold">{m.name}</span>
        </motion.li>
      ))}
    </ul>
  );
}

/* 2. Each friend's answers fill in on a sealed card, one friend at a time. */
function PrivateAnswers({ reduce }: { reduce: boolean }) {
  return (
    <ul className="grid grid-cols-2 gap-2.5 sm:gap-3">
      {DEMO_GROUP.map((m, i) => {
        const base = 0.2 + i * 0.45;
        return (
          <motion.li
            key={m.id}
            className="card-surface relative overflow-hidden p-3 sm:p-4"
            initial={reduce ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE, delay: base }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 font-semibold">
                <span aria-hidden>{m.emoji}</span> {m.name}
              </span>
              <motion.span
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary"
                initial={reduce ? false : { opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 420, damping: 22, delay: base + 0.35 }}
              >
                <Lock className="size-3" aria-hidden />
                <span className="sr-only sm:not-sr-only">Only {m.name}</span>
              </motion.span>
            </div>
            <ul className="mt-3 space-y-1.5 text-[13px] text-muted-foreground sm:text-sm">
              {answerLines(m).map((l, j) => (
                <motion.li
                  key={l.text}
                  className="flex items-center gap-2 [&_svg]:size-3.5 [&_svg]:shrink-0"
                  initial={reduce ? false : { opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, ease: EASE, delay: base + 0.1 + j * 0.07 }}
                >
                  {l.icon}
                  <span>{l.text}</span>
                </motion.li>
              ))}
            </ul>
          </motion.li>
        );
      })}
    </ul>
  );
}

/* 3. All the options, then the ones that don't fit quietly drop out. */
function Filter({ ranked, reduce }: { ranked: Ranked; reduce: boolean }) {
  const pool = useMemo(
    () => DEMO_POOL.map((o) => ranked.find((r) => r.option.key === o.key)!),
    [ranked],
  );
  const [checked, setChecked] = useState(reduce);
  useEffect(() => {
    if (reduce) return;
    const t = window.setTimeout(() => setChecked(true), 1100);
    return () => window.clearTimeout(t);
  }, [reduce]);
  const fit = pool.filter((r) => r.feasible).length;

  return (
    <div>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {pool.map((r, i) => {
          const out = checked && !r.feasible;
          return (
            <motion.li
              key={r.option.key}
              className="relative overflow-hidden rounded-2xl border border-border bg-card px-3 py-2.5"
              initial={reduce ? false : { opacity: 0, scale: 0.9 }}
              animate={{
                opacity: out ? 0.38 : 1,
                scale: out ? 0.96 : 1,
                filter: out ? "grayscale(1)" : "grayscale(0)",
              }}
              transition={{
                duration: 0.45,
                ease: EASE,
                delay: checked ? (out ? i * 0.06 : 0) : 0.05 + i * 0.05,
              }}
            >
              <p className="truncate text-sm font-semibold">{r.option.title}</p>
              <p className="mt-0.5 hidden truncate text-xs text-muted-foreground sm:block">
                ${r.option.costMin}–{r.option.costMax} · {clock(r.option.start)}
              </p>
              {out && (
                <motion.span
                  className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground"
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.06 + 0.2 }}
                >
                  <X className="size-3" aria-hidden /> Doesn't work for everyone
                </motion.span>
              )}
            </motion.li>
          );
        })}
      </ul>
      <p className="mt-4 text-sm font-medium tabular-nums" aria-live="polite">
        {checked ? (
          <>
            <span className="text-primary">{fit}</span> of {pool.length} work for all four
          </>
        ) : (
          <span className="text-muted-foreground">Checking {pool.length} options…</span>
        )}
      </p>
    </div>
  );
}

/* 4. The survivors shuffle into their ranked order and the top one lifts. */
function Rank({ ranked, reduce }: { ranked: Ranked; reduce: boolean }) {
  const fits = ranked.filter((r) => r.feasible);
  // Start in catalogue order, then settle into the ranking.
  const shuffled = useMemo(
    () => DEMO_POOL.map((o) => fits.find((f) => f.option.key === o.key)).filter(Boolean) as Ranked,
    [fits],
  );
  const [sorted, setSorted] = useState(reduce);
  useEffect(() => {
    if (reduce) return;
    const t = window.setTimeout(() => setSorted(true), 700);
    return () => window.clearTimeout(t);
  }, [reduce]);
  const list = sorted ? fits : shuffled;
  const best = fits[0]?.score || 1;

  return (
    <LayoutGroup>
      <ol className="space-y-2.5">
        {list.map((r, i) => {
          const top = sorted && i === 0;
          return (
            <motion.li
              layout={!reduce}
              key={r.option.key}
              className={cn(
                "flex items-center gap-3 rounded-2xl border bg-card px-4 py-3",
                top
                  ? "border-primary/50 shadow-[0_18px_40px_-24px_var(--primary)]"
                  : "border-border",
              )}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0, scale: top ? 1.02 : 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 28 }}
            >
              <span className="w-5 text-sm font-semibold text-muted-foreground tabular-nums">
                {sorted ? i + 1 : "·"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{r.option.title}</p>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-foreground/10">
                  <motion.span
                    className="block h-full rounded-full bg-primary"
                    style={{ originX: 0 }}
                    initial={reduce ? false : { scaleX: 0 }}
                    animate={{ scaleX: sorted ? Math.max(0.08, r.score / best) : 0.08 }}
                    transition={{ duration: 0.7, ease: EASE, delay: 0.1 + i * 0.08 }}
                  />
                </div>
              </div>
              {top && (
                <motion.span
                  className="rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground"
                  initial={reduce ? false : { opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 420, damping: 20, delay: 0.5 }}
                >
                  Top pick
                </motion.span>
              )}
            </motion.li>
          );
        })}
      </ol>
    </LayoutGroup>
  );
}

/* 5. The winning plan assembles itself: place, then time, cost and rides. */
function ThePlan({ ranked, reduce }: { ranked: Ranked; reduce: boolean }) {
  const top = ranked[0];
  const o = top.option;
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

  const rows: { icon: ReactNode; label: string; value: string }[] = [
    { icon: <Clock />, label: "When", value: `${clock(o.start)} – ${clock(o.end)}` },
    { icon: <Wallet />, label: "Each", value: `$${cost.perPersonMin}–${cost.perPersonMax}` },
    {
      icon: <Car />,
      label: "Rides",
      value: transport?.cars.length
        ? transport.cars
            .filter((c) => c.passengers.length)
            .map((c) => `${c.driver} drives ${c.passengers.join(" & ")}`)
            .join(" · ") || "Everyone gets there on their own"
        : "Everyone gets there on their own",
    },
  ];

  return (
    <motion.article
      className="card-surface overflow-hidden p-6 sm:p-7"
      initial={reduce ? false : { opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: EASE }}
    >
      <motion.span
        className="inline-flex items-center gap-1.5 rounded-full bg-success/12 px-2.5 py-1 text-xs font-semibold text-success"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        Works for all 4
      </motion.span>
      <h2 className="mt-3 text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
        {o.title}
      </h2>
      <p className="mt-1 text-muted-foreground">{o.subtitle}</p>
      <dl className="mt-6 divide-y divide-border border-t border-border">
        {rows.map((r, i) => (
          <motion.div
            key={r.label}
            className="flex items-start gap-3 py-3 text-sm [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-primary"
            initial={reduce ? false : { opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease: EASE, delay: 0.45 + i * 0.18 }}
          >
            {r.icon}
            <dt className="w-14 shrink-0 text-muted-foreground">{r.label}</dt>
            <dd className="font-medium">{r.value}</dd>
          </motion.div>
        ))}
      </dl>
      <div className="mt-5 flex -space-x-2">
        {DEMO_GROUP.map((m, i) => (
          <motion.span
            key={m.id}
            className="grid size-9 place-items-center rounded-full border-2 border-card bg-surface text-base"
            initial={reduce ? false : { opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 380, damping: 18, delay: 1.1 + i * 0.12 }}
            aria-hidden
          >
            {m.emoji}
          </motion.span>
        ))}
        <span className="sr-only">Maya, Dev, Sofia and Theo are all in.</span>
      </div>
    </motion.article>
  );
}

/* 6. A preview of the controls the playground hands over. */
function YourTurn({ reduce }: { reduce: boolean }) {
  const chips = ["“I only eat halal”", "“I have to be home by 8:30”", "“I can only spend $5”"];
  return (
    <div className="relative grid place-items-center py-6">
      <ul className="flex w-full max-w-sm flex-col gap-3">
        {chips.map((c, i) => (
          <motion.li
            key={c}
            className="glass-pill rounded-full border border-border px-5 py-3 text-center font-medium"
            initial={reduce ? false : { opacity: 0, y: 16, rotate: i % 2 ? 2 : -2 }}
            animate={{ opacity: 1, y: 0, rotate: i % 2 ? 1 : -1 }}
            transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.15 + i * 0.15 }}
          >
            {c}
          </motion.li>
        ))}
      </ul>
      <p className="mt-5 text-sm text-muted-foreground">One tap each. Watch what happens.</p>
    </div>
  );
}
