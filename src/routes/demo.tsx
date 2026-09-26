import { createFileRoute, Link } from "@tanstack/react-router";
import { useId, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, MotionConfig, motion, useInView } from "motion/react";
import { ArrowRight, Check, ChevronDown, Lock, RotateCcw, X } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { Wordmark } from "@/components/quorum/Wordmark";
import { Card, Pill } from "@/components/quorum/ui";
import { buildTransportPlan } from "@/lib/quorum/engine";
import { estimateCost } from "@/lib/quorum/cost";
import { DEMO_MEMBERS, rankDemo, withAnswers } from "@/lib/quorum/demoSample";
import {
  TOP_LEVEL_CATEGORIES,
  type ConstraintPayload,
  type PlanCategory,
} from "@/lib/quorum/types";

const TITLE = `Try ${BRAND.name} — interactive demo, no account needed`;
const DESCRIPTION =
  "Play with a sample group: change private budgets, curfews, rides and diets and watch Syncly re-rank plans that work for everyone.";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
      { property: "og:url", content: "https://syncly.website/demo" },
    ],
    links: [{ rel: "canonical", href: "https://syncly.website/demo" }],
  }),
  component: DemoPage,
});

const TAG_CHOICES = ["active", "indoor", "outdoor", "games", "cozy", "group", "late-night"];
const DIET_CHOICES = ["vegetarian", "vegan", "gluten-free", "halal", "nut-free"];
const CURFEWS = ["20:30", "21:30", "22:30", "23:30"];
const CATEGORY_CHOICES = TOP_LEVEL_CATEGORIES.filter((c) => c.id !== "custom");

const EASE = [0.23, 1, 0.32, 1] as const;

/*
 * One path through the demo, top to bottom: pick a friend, change what they
 * can do (budget and curfew first; everything else waits behind "More
 * limits"), and watch the plan for the whole group answer back. The plan
 * stays in view beside the controls on wide screens, and a bar at the bottom
 * of the screen carries it on phones.
 */
function DemoPage() {
  const [category, setCategory] = useState<PlanCategory>("hangout");
  const [members, setMembers] = useState(DEMO_MEMBERS);
  const [activeId, setActiveId] = useState(DEMO_MEMBERS[0]!.id);
  const [touched, setTouched] = useState(false);

  const active = members.find((m) => m.id === activeId)!;
  const edited = members !== DEMO_MEMBERS;

  const update = (patch: Partial<ConstraintPayload>) => {
    setTouched(true);
    setMembers((prev) => withAnswers(prev, activeId, patch));
  };

  const toggleIn = (key: "likedTags" | "dietary", value: string) => {
    const list = active.constraints[key] ?? [];
    const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
    update(key === "dietary" ? { dietary: next } : { likedTags: next });
  };

  const ranked = useMemo(() => rankDemo(category, members).slice(0, 4), [category, members]);
  const top = ranked[0];

  const resultsRef = useRef<HTMLElement>(null);
  const resultsInView = useInView(resultsRef, { amount: 0.25 });

  return (
    <MotionConfig reducedMotion="user">
      <div className="paper-field min-h-dvh pb-28 lg:pb-0">
        <header className="safe-top sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
            <Link to="/" className="inline-flex min-h-11 items-center">
              <Wordmark />
            </Link>
            <Link
              to="/auth"
              search={{ next: "/home", mode: "signup" }}
              className="pressable active:pressable-active inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
            >
              Sign up free
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-5 sm:py-10">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
              <Lock className="size-3.5" aria-hidden /> Interactive demo · nothing is saved
            </p>
            <h1 className="mt-2 text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl">
              Find a plan that works for everyone
            </h1>
            <p className="mt-3 text-base text-pretty text-muted-foreground">
              Four friends have each answered privately. Step into one friend's shoes, change what
              they can do, and watch the group's plan change.
            </p>
          </div>

          <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-8">
            {/* Steps 1–2: you, privately */}
            <Card className="p-5 sm:p-6">
              <Step n={1} title="Pick a friend">
                <div role="radiogroup" aria-label="Friend" className="mt-4 grid grid-cols-4 gap-2">
                  {members.map((m) => {
                    const on = m.id === activeId;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setActiveId(m.id)}
                        className={`pressable active:pressable-active flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-2xl border text-sm transition-colors ${
                          on
                            ? "border-primary bg-primary/10 font-semibold text-foreground"
                            : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <span className="text-2xl leading-none" aria-hidden>
                          {m.emoji}
                        </span>
                        {m.name}
                      </button>
                    );
                  })}
                </div>
              </Step>

              <div className="my-6 h-px bg-border" />

              <Step n={2} title={`Change what ${active.name} can do`}>
                <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Lock className="size-3.5 shrink-0" aria-hidden /> Only {active.name} sees these
                  answers.
                </p>

                <div className="mt-5 space-y-6">
                  <Slider
                    label="Can spend up to"
                    value={active.constraints.maxSpend ?? 20}
                    format={(v) => `$${v}`}
                    min={5}
                    max={80}
                    step={5}
                    onChange={(v) => update({ maxSpend: v })}
                  />

                  <Field label="Has to be home by">
                    {CURFEWS.map((t) => (
                      <Chip
                        key={t}
                        on={active.constraints.latestEnd === t}
                        onClick={() => update({ latestEnd: t })}
                      >
                        {to12h(t)}
                      </Chip>
                    ))}
                  </Field>

                  <Disclosure label="More limits" hint="Travel, food, interests, rides">
                    <div className="space-y-6 pt-5">
                      <Slider
                        label="Will travel up to"
                        value={active.constraints.maxTravelMinutes ?? 20}
                        format={(v) => `${v} min`}
                        min={5}
                        max={60}
                        step={5}
                        onChange={(v) => update({ maxTravelMinutes: v })}
                      />
                      <Field label="Getting there">
                        <Chip
                          on={!!active.constraints.canDrive}
                          onClick={() =>
                            update({ canDrive: !active.constraints.canDrive, needsRide: false })
                          }
                        >
                          Can drive ({active.constraints.seats ?? 3} seats)
                        </Chip>
                        <Chip
                          on={!!active.constraints.needsRide}
                          onClick={() =>
                            update({ needsRide: !active.constraints.needsRide, canDrive: false })
                          }
                        >
                          Needs a ride
                        </Chip>
                      </Field>
                      <Field label="Food needs">
                        {DIET_CHOICES.map((d) => (
                          <Chip
                            key={d}
                            on={(active.constraints.dietary ?? []).includes(d)}
                            onClick={() => toggleIn("dietary", d)}
                          >
                            {d}
                          </Chip>
                        ))}
                      </Field>
                      <Field label="Into">
                        {TAG_CHOICES.map((t) => (
                          <Chip
                            key={t}
                            on={(active.constraints.likedTags ?? []).includes(t)}
                            onClick={() => toggleIn("likedTags", t)}
                          >
                            {t}
                          </Chip>
                        ))}
                      </Field>
                    </div>
                  </Disclosure>
                </div>

                <AnimatePresence initial={false}>
                  {edited && (
                    <motion.button
                      type="button"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.2, ease: EASE }}
                      onClick={() => setMembers(DEMO_MEMBERS)}
                      className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full px-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <RotateCcw className="size-4" aria-hidden /> Undo my changes
                    </motion.button>
                  )}
                </AnimatePresence>
              </Step>
            </Card>

            {/* Step 3: what the group sees */}
            <section ref={resultsRef} className="lg:sticky lg:top-24" aria-labelledby="plan-step">
              <Step
                n={3}
                id="plan-step"
                title={`The plan for all ${members.length}`}
                aside={
                  <label className="relative inline-flex items-center">
                    <span className="sr-only">Kind of plan</span>
                    <select
                      value={category}
                      onChange={(e) => {
                        setTouched(true);
                        setCategory(e.target.value as PlanCategory);
                      }}
                      className="min-h-11 appearance-none rounded-full border border-border bg-card py-2 pr-9 pl-4 text-sm font-medium"
                    >
                      {CATEGORY_CHOICES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.emoji} {c.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      className="pointer-events-none absolute right-3 size-4 text-muted-foreground"
                      aria-hidden
                    />
                  </label>
                }
              >
                <p className="mt-1 text-sm text-muted-foreground">
                  The group only sees whether a plan works, never who needed what.
                </p>
                {top && (
                  <div className="mt-4 space-y-4">
                    <BestPlan result={top} category={category} members={members} />
                    {ranked.length > 1 && <RunnersUp results={ranked.slice(1)} />}
                  </div>
                )}
              </Step>
            </section>
          </div>

          <Card className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Do this with your actual group</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Invite links, parent approvals, weather-aware picks and saved plans.
              </p>
            </div>
            <Link
              to="/auth"
              search={{ next: "/home", mode: "signup" }}
              className="pressable active:pressable-active inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
            >
              Create a group <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Card>
        </main>

        {/* Phones: the plan answers back without scrolling away from the controls. */}
        <AnimatePresence>
          {top && touched && !resultsInView && (
            <motion.button
              type="button"
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              transition={{ duration: 0.25, ease: EASE }}
              onClick={() =>
                resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
              className="safe-bottom glass-pill fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-border bg-card/95 px-4 pt-3 text-left shadow-lg lg:hidden"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-caption font-semibold tracking-wide text-muted-foreground uppercase">
                  {top.feasible ? "Best plan for everyone" : "Nothing works for everyone"}
                </span>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={top.option.key}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2, ease: EASE }}
                    className="block truncate text-base font-semibold"
                  >
                    {top.option.title}
                  </motion.span>
                </AnimatePresence>
              </span>
              <span className="text-2xl font-semibold tabular-nums">{top.score}</span>
              <ChevronDown className="size-5 text-muted-foreground" aria-hidden />
            </motion.button>
          )}
        </AnimatePresence>

        <p className="sr-only" aria-live="polite">
          {top &&
            (top.feasible
              ? `Best plan for everyone: ${top.option.title}, ${top.score} match.`
              : "No plan works for everyone yet.")}
        </p>
      </div>
    </MotionConfig>
  );
}

type Ranked = ReturnType<typeof rankDemo>[number];

function BestPlan({
  result: r,
  category,
  members,
}: {
  result: Ranked;
  category: PlanCategory;
  members: typeof DEMO_MEMBERS;
}) {
  const cost = estimateCost({
    costMin: r.option.costMin,
    costMax: r.option.costMax,
    travelMinutes: r.option.travelMinutes,
    category,
    headcount: members.length,
    requiresDriving: r.option.requiresDriving,
  });
  const transport = r.option.requiresDriving
    ? buildTransportPlan(
        r.option,
        members.map((m) => ({ profileId: m.id, name: m.name, constraints: m.constraints })),
      )
    : null;

  return (
    <Card className={r.feasible ? "p-5 ring-1 ring-primary/40 sm:p-6" : "p-5 sm:p-6"}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={r.option.key}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.28, ease: EASE }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              {r.feasible ? (
                <Pill tone="accent">Best for everyone</Pill>
              ) : (
                <Pill tone="bad">Doesn't work for everyone yet</Pill>
              )}
              <h3 className="mt-2 text-xl font-semibold">{r.option.title}</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">{r.option.subtitle}</p>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-3xl font-semibold tabular-nums">{r.score}</div>
              <div className="text-caption text-muted-foreground">match</div>
            </div>
          </div>

          <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
            <Fact label="Each pays">
              ${cost.perPersonMin}–${cost.perPersonMax}
            </Fact>
            <Fact label="When">
              {to12h(r.option.start)}–{to12h(r.option.end)}
            </Fact>
            <Fact label="Away">{r.option.travelMinutes} min</Fact>
          </dl>

          {!r.feasible && (
            <p className="mt-3 text-sm text-muted-foreground">
              Try loosening a limit — a bigger budget or a later curfew usually opens things up.
            </p>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="mt-4">
        <Disclosure label="Why this plan?" hint="Score, fairness, cost and rides">
          <div className="space-y-5 pt-4 text-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <Meter label="Preference fit" value={r.breakdown.overallFit} />
              <Meter label="Fairness" value={r.breakdown.fairness} />
            </div>
            <ul className="space-y-1.5">
              {r.breakdown.reasons.slice(0, 4).map((reason) => (
                <li key={reason} className="flex gap-2 text-muted-foreground">
                  <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                  {reason}
                </li>
              ))}
              {r.breakdown.cautions.slice(0, 2).map((c) => (
                <li key={c} className="flex gap-2 text-muted-foreground">
                  <X className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                  {c}
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground">
              The match score is 62% preference fit, 28% fairness and 10% ride coverage. Budget,
              schedule and travel aren't scored — a plan either fits them for everyone or it isn't
              the best plan.
            </p>
            <div>
              <h4 className="font-semibold">Cost split</h4>
              <dl className="mt-2 space-y-1.5">
                {cost.lines.map((l) => (
                  <div key={l.label} className="flex justify-between text-muted-foreground">
                    <dt>{l.label}</dt>
                    <dd className="tabular-nums">{l.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            {transport && (
              <div>
                <h4 className="font-semibold">Rides</h4>
                <ul className="mt-2 space-y-1.5 text-muted-foreground">
                  {transport.cars.map((c) => (
                    <li key={c.label}>
                      <span className="font-medium text-foreground">{c.label}</span> — {c.driver}{" "}
                      driving
                      {c.passengers.length
                        ? ` with ${c.passengers.join(", ")}`
                        : " (no riders yet)"}
                    </li>
                  ))}
                  {transport.unseated.length > 0 && (
                    <li className="text-destructive">
                      Still needs a ride: {transport.unseated.join(", ")}
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        </Disclosure>
      </div>
    </Card>
  );
}

function RunnersUp({ results }: { results: Ranked[] }) {
  return (
    <div>
      <h3 className="px-1 text-sm font-semibold text-muted-foreground">Also possible</h3>
      <ol className="mt-2 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        <AnimatePresence initial={false}>
          {results.map((r) => (
            <motion.li
              key={r.option.key}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="flex min-h-14 items-center gap-3 px-4 py-2.5"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{r.option.title}</span>
                <span
                  className={`inline-flex items-center gap-1 text-caption ${
                    r.feasible ? "text-success" : "text-muted-foreground"
                  }`}
                >
                  {r.feasible ? (
                    <>
                      <Check className="size-3" aria-hidden /> Works for everyone
                    </>
                  ) : (
                    <>
                      <X className="size-3" aria-hidden /> Doesn't meet every requirement
                    </>
                  )}
                </span>
              </span>
              <span className="text-lg font-semibold tabular-nums">{r.score}</span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
    </div>
  );
}

function Step({
  n,
  id,
  title,
  aside,
  children,
}: {
  n: number;
  id?: string;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={id} className="flex items-center gap-3 text-lg font-semibold">
          <span
            aria-hidden
            className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
          >
            {n}
          </span>
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2.5 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

function Slider({
  label,
  value,
  format,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  format: (v: number) => string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const id = useId();
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <span className="text-lg font-semibold tabular-nums">{format(value)}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={format(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-11 w-full cursor-pointer accent-primary"
      />
    </div>
  );
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`pressable active:pressable-active inline-flex min-h-11 items-center rounded-full border px-4 text-sm transition-colors ${
        on
          ? "border-primary bg-primary/10 font-semibold text-primary"
          : "border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Disclosure({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="border-t border-border">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-12 w-full items-center justify-between gap-3 pt-3 text-left"
      >
        <span>
          <span className="block text-sm font-semibold">{label}</span>
          <span className="block text-caption text-muted-foreground">{hint}</span>
        </span>
        <ChevronDown
          aria-hidden
          className={`size-5 shrink-0 text-muted-foreground transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={id}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-secondary/70 px-2 py-2.5">
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold tabular-nums">{children}</dd>
    </div>
  );
}

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums">{value}%</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
        <motion.div
          className="h-full rounded-full bg-primary"
          initial={false}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.4, ease: EASE }}
        />
      </div>
    </div>
  );
}

/** "21:30" → "9:30pm" — what a teen would actually say. */
function to12h(t: string) {
  const [h = 0, m = 0] = t.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hh = h % 12 || 12;
  return m ? `${hh}:${String(m).padStart(2, "0")}${suffix}` : `${hh}${suffix}`;
}
