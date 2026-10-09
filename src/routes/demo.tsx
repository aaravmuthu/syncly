import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Clock,
  Lock,
  MapPin,
  RotateCcw,
  Undo2,
  Wallet,
  X,
} from "lucide-react";
import { BRAND } from "@/lib/brand";
import { Wordmark } from "@/components/quorum/Wordmark";
import { Card, Meter, Pill } from "@/components/quorum/ui";
import { rankOptions, buildTransportPlan, type MemberInput } from "@/lib/quorum/engine";
import { estimateCost } from "@/lib/quorum/cost";
import type { ConstraintPayload } from "@/lib/quorum/types";
import { cn } from "@/lib/utils";
import { DEMO_GROUP, DEMO_POOL, type DemoMember } from "@/lib/quorum/demo-group";
import { analyze, type CoachMove } from "@/lib/quorum/demo-coach";
import { DemoCoach } from "@/components/quorum/demo/DemoCoach";
import { DemoWalkthrough } from "@/components/quorum/demo/DemoWalkthrough";

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
const minutes = (time: string) => {
  const [hours, mins] = time.split(":").map(Number);
  return hours * 60 + mins;
};
const timeFromMinutes = (value: number) =>
  `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;

// One tap each, and every one visibly moves the result (checked against the
// engine): a new top pick, an option dropping out, and nothing fitting at all.
const TRY_THESE: {
  id: string;
  memberId: string;
  quote: string;
  patch: (c: ConstraintPayload) => Partial<ConstraintPayload>;
}[] = [
  {
    id: "halal",
    memberId: "m1",
    quote: "I only eat halal",
    patch: (c) => ({ dietary: [...(c.dietary ?? []).filter((d) => d !== "halal"), "halal"] }),
  },
  {
    id: "curfew",
    memberId: "m3",
    quote: "I have to be home by 8:30",
    patch: () => ({ latestEnd: "20:30" }),
  },
  {
    id: "broke",
    memberId: "m4",
    quote: "I can only spend $5",
    patch: () => ({ maxSpend: 5 }),
  },
];

/** "21:30" -> "9:30 pm", "16:00" -> "4 pm". */
function clock(t: string, withSuffix = true) {
  const [h, m] = t.split(":").map(Number);
  const h12 = h % 12 || 12;
  const base = m ? `${h12}:${String(m).padStart(2, "0")}` : `${h12}`;
  return withSuffix ? `${base} ${h < 12 ? "am" : "pm"}` : base;
}

function clockRange(a: string, b: string) {
  const samePeriod = Number(a.split(":")[0]) < 12 === Number(b.split(":")[0]) < 12;
  return `${clock(a, !samePeriod)}–${clock(b)}`;
}

function DemoPage() {
  const reduce = useReducedMotion();
  // Visitors start with the guided walkthrough, then get the playground.
  const [stage, setStage] = useState<"tour" | "play">("tour");
  const startPlaying = () => {
    setStage("play");
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const [members, setMembers] = useState<DemoMember[]>(DEMO_GROUP);
  const [activeId, setActiveId] = useState("m1");
  // Who the visitor is playing, and the name they gave. The name is display
  // only: it stays in this browser and is never sent to the AI.
  const [youId, setYouId] = useState<string | null>(null);
  const [youName, setYouName] = useState("");
  const nameOf = (m: { id: string; name: string }) =>
    m.id === youId && youName.trim() ? youName.trim() : m.name;
  const [tried, setTried] = useState<string[]>([]);
  const [history, setHistory] = useState<
    { members: DemoMember[]; tried: string[]; activeId: string }[]
  >([]);
  const gesture = useRef(false);
  const gestureSaved = useRef(false);
  const [interacting, setInteracting] = useState(false);
  const beginGesture = () => {
    if (!gesture.current) gestureSaved.current = false;
    gesture.current = true;
    setInteracting(true);
  };
  const endGesture = () => {
    gesture.current = false;
    gestureSaved.current = false;
    setInteracting(false);
  };
  const remember = () => {
    if (gesture.current && gestureSaved.current) return;
    setHistory((prev) => [...prev.slice(-19), { members, tried, activeId }]);
    if (gesture.current) gestureSaved.current = true;
  };
  const undo = () => {
    const previous = history.at(-1);
    if (!previous) return;
    endGesture();
    setMembers(previous.members);
    setTried(previous.tried);
    setActiveId(previous.activeId);
    setHistory((prev) => prev.slice(0, -1));
  };

  const active = members.find((m) => m.id === activeId)!;
  const edited = members !== DEMO_GROUP;

  const patchMember = (id: string, patch: Partial<ConstraintPayload>) => {
    remember();
    setMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, constraints: { ...m.constraints, ...patch } } : m)),
    );
  };
  const update = (patch: Partial<ConstraintPayload>) => patchMember(activeId, patch);

  const toggleIn = (key: "likedTags" | "dietary", value: string) => {
    const list = active.constraints[key] ?? [];
    update({
      [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value],
    } as never);
  };

  const reset = () => {
    remember();
    setMembers(DEMO_GROUP);
    setTried([]);
  };

  const ranked = useMemo(() => {
    const inputs: MemberInput[] = members.map((m) => ({
      profileId: m.id,
      constraints: m.constraints,
      sacrificeLoad: m.sacrificeLoad,
    }));
    return rankOptions(DEMO_POOL, inputs);
  }, [members]);

  const coach = useMemo(() => analyze(members, DEMO_POOL, youId), [members, youId]);

  const top = ranked[0];
  const anyFeasible = top.feasible;
  const working = ranked.filter((r) => r.feasible).length;

  // Name what just happened when the pick changes, without saying whose
  // answer caused it -- the same rule the real plan screen follows.
  const [change, setChange] = useState<string | null>(null);
  const prevTop = useRef(top);
  useEffect(() => {
    const prev = prevTop.current;
    prevTop.current = top;
    if (prev.option.key === top.option.key && prev.feasible === top.feasible) {
      setChange(null);
      return;
    }
    const prevNow = ranked.find((r) => r.option.key === prev.option.key);
    if (!top.feasible) setChange(null);
    else if (prevNow && !prevNow.feasible)
      setChange(`${prev.option.title} no longer works for everyone.`);
    else if (!prev.feasible) setChange("Something works for everyone again.");
    else setChange(`${top.option.title} is now the strongest match.`);
  }, [top, ranked]);

  const cost = estimateCost({
    costMin: top.option.costMin,
    costMax: top.option.costMax,
    travelMinutes: top.option.travelMinutes,
    category: "hangout",
    headcount: members.length,
    requiresDriving: top.option.requiresDriving,
  });

  const transport = top.option.requiresDriving
    ? buildTransportPlan(
        top.option,
        members.map((m) => ({ profileId: m.id, name: nameOf(m), constraints: m.constraints })),
      )
    : null;

  // Phones stack the answer above the controls, so while someone is dragging
  // a slider the result is off-screen. A floating live pick keeps cause and
  // effect on the same screen.
  const topRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const [topVisible, setTopVisible] = useState(true);
  const [controlsVisible, setControlsVisible] = useState(false);
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.target === topRef.current) setTopVisible(e.isIntersecting);
        if (e.target === controlsRef.current) setControlsVisible(e.isIntersecting);
      }
    });
    if (topRef.current) io.observe(topRef.current);
    if (controlsRef.current) io.observe(controlsRef.current);
    return () => io.disconnect();
  }, [stage]);
  const showLiveBar = stage === "play" && controlsVisible && !topVisible;

  const scrollToTop = () =>
    topRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });

  const tryThis = (t: (typeof TRY_THESE)[number]) => {
    const m = members.find((x) => x.id === t.memberId)!;
    setActiveId(t.memberId);
    patchMember(t.memberId, t.patch(m.constraints));
    setTried((prev) => [...prev, t.id]);
  };

  const applyMove = (move: CoachMove) => {
    // A friend's answer changes without opening their controls: you can ask a
    // friend, but you don't get to read their answers.
    if (move.who !== "friend") setActiveId(move.memberId);
    patchMember(move.memberId, move.patch);
  };

  const swap = reduce
    ? { initial: false, animate: {}, exit: {} }
    : {
        initial: { opacity: 0, y: 6 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -4 },
        transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] as const },
      };

  return (
    <div className="paper-field min-h-dvh">
      <header className="safe-top sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <Link to="/" className="tap-target inline-flex items-center">
            <Wordmark />
          </Link>
          <div className="flex items-center gap-2">
            <Pill tone="accent" className="hidden sm:inline-flex">
              <Lock className="size-3" /> Demo — nothing is saved
            </Pill>
            <Link
              to="/auth"
              search={{ next: "/home", mode: "signup" }}
              className="pressable active:pressable-active tap-target inline-flex items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-92"
            >
              Use for real
            </Link>
          </div>
        </div>
      </header>

      {stage === "tour" ? (
        <DemoWalkthrough onFinish={startPlaying} />
      ) : (
        <main className="demo-enter mx-auto max-w-6xl px-4 pt-7 pb-32 sm:px-5 sm:pt-10 lg:pb-16">
          <h1 className="max-w-[18ch] text-[2rem] leading-[1.08] font-semibold tracking-tight text-balance sm:text-4xl">
            Four friends, one Friday night
          </h1>
          <p className="mt-3 max-w-[52ch] text-base text-pretty text-muted-foreground">
            Each of them answered a few questions privately. {BRAND.name} found a plan that works
            for all four. Change anyone's answers and watch it adapt.
          </p>

          <div className="mt-7 grid gap-5 lg:mt-9 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start lg:gap-8">
            {/* 1 — the answer, first */}
            <div className="order-last space-y-3 lg:order-first">
              <section
                aria-label="Live plan rankings"
                className="surface overflow-hidden p-5 sm:p-6"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-xl font-semibold tracking-tight">Watch the plans move</h2>
                  <span className="shrink-0 text-sm font-medium tabular-nums text-primary">
                    {working} / {ranked.length} fit
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Drag an answer. Plans that work rise to the top.
                </p>
                <div
                  className="mt-4 h-1.5 overflow-hidden rounded-full bg-secondary"
                  aria-hidden="true"
                >
                  <motion.div
                    className="h-full origin-left rounded-full bg-primary"
                    initial={false}
                    animate={{ scaleX: working / ranked.length }}
                    transition={{ duration: reduce ? 0 : 0.2 }}
                  />
                </div>
                <LayoutGroup id="demo-plans">
                  <ol
                    className="mt-3 max-h-80 overflow-y-auto overscroll-contain pr-1"
                    tabIndex={0}
                    aria-label="Ranked plans, best match first"
                  >
                    {ranked.map((r, index) => (
                      <motion.li
                        key={r.option.key}
                        layout={reduce ? false : "position"}
                        initial={false}
                        animate={{ opacity: r.feasible ? 1 : 0.65 }}
                        transition={{
                          layout: { type: "spring", stiffness: 380, damping: 36 },
                          opacity: { duration: reduce ? 0 : 0.15 },
                        }}
                        className={cn(
                          "relative flex items-center gap-3 border-b border-border py-3 last:border-0",
                          index === 0 && r.feasible && "text-primary",
                        )}
                      >
                        <span
                          className="grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold tabular-nums"
                          aria-hidden="true"
                        >
                          {r.feasible ? index + 1 : "—"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold">{r.option.title}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                            ${r.option.costMin}–{r.option.costMax} ·{" "}
                            {clockRange(r.option.start, r.option.end)}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "flex shrink-0 items-center gap-1 text-xs font-medium",
                            r.feasible ? "text-primary" : "text-muted-foreground",
                          )}
                        >
                          {r.feasible ? (
                            <Check className="size-3.5" aria-hidden />
                          ) : (
                            <X className="size-3.5" aria-hidden />
                          )}
                          {r.feasible ? (index === 0 ? "Top pick" : "Fits") : "Ruled out"}
                        </span>
                      </motion.li>
                    ))}
                  </ol>
                </LayoutGroup>
                <p className="sr-only" role="status" aria-live={interacting ? "off" : "polite"}>
                  {working} plans work for everyone.
                  {anyFeasible
                    ? ` Top pick: ${top.option.title}.`
                    : " Try another answer or undo your last change."}
                </p>
              </section>

              <div ref={topRef}>
                <Card
                  as="section"
                  className={cn(
                    "p-5 sm:p-6",
                    anyFeasible ? "ring-1 ring-primary/35" : "ring-1 ring-destructive/30",
                  )}
                >
                  <div className="flex min-h-7 items-center justify-between gap-3">
                    <span className="text-sm font-medium text-muted-foreground">
                      {anyFeasible ? "Top pick" : "No plan yet"}
                    </span>
                    <span aria-live={interacting ? "off" : "polite"} className="flex items-center">
                      {anyFeasible ? (
                        <Pill tone="good">
                          <Check className="size-3" /> Works for all {members.length}
                        </Pill>
                      ) : (
                        <Pill tone="bad">
                          <X className="size-3" /> Nothing fits everyone
                        </Pill>
                      )}
                    </span>
                  </div>

                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.div key={anyFeasible ? top.option.key : "none"} {...swap}>
                      {anyFeasible ? (
                        <>
                          <h2 className="mt-3 text-2xl leading-tight font-semibold tracking-tight sm:text-[1.75rem]">
                            {top.option.title}
                          </h2>
                          <p className="mt-1 text-base text-muted-foreground">
                            {top.option.subtitle}
                          </p>
                          <dl className="mt-4 grid grid-cols-3 gap-2">
                            <Fact icon={Wallet} label="Each">
                              ${cost.perPersonMin}–{cost.perPersonMax}
                            </Fact>
                            <Fact icon={Clock} label="When">
                              {clockRange(top.option.start, top.option.end)}
                            </Fact>
                            <Fact icon={MapPin} label="Away">
                              {top.option.travelMinutes} min
                            </Fact>
                          </dl>
                          <ul className="mt-4 space-y-2 text-[0.9375rem]">
                            {top.breakdown.reasons.slice(0, 3).map((reason) => (
                              <li key={reason} className="flex gap-2.5">
                                <Check className="mt-0.5 size-4 shrink-0 text-success" />
                                {reason}
                              </li>
                            ))}
                          </ul>
                        </>
                      ) : (
                        <>
                          <h2 className="mt-3 text-2xl leading-tight font-semibold tracking-tight">
                            Nothing works for everyone
                          </h2>
                          <p className="mt-2 text-base text-pretty text-muted-foreground">
                            Someone's limits rule out every option. Nobody finds out whose — the
                            group just sees it's time to loosen something.
                          </p>
                          <button
                            type="button"
                            onClick={reset}
                            className="pressable active:pressable-active tap-target mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-92"
                          >
                            <RotateCcw className="size-4" /> Reset the group
                          </button>
                        </>
                      )}
                    </motion.div>
                  </AnimatePresence>

                  <AnimatePresence initial={false}>
                    {change && anyFeasible && (
                      <motion.p
                        key={change}
                        initial={reduce ? false : { opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden text-sm text-muted-foreground"
                      >
                        <span className="mt-4 flex items-start gap-2 rounded-2xl bg-primary/8 px-3 py-2.5 text-foreground">
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                          <span>
                            <span className="font-semibold">New top pick.</span> {change}
                          </span>
                        </span>
                      </motion.p>
                    )}
                  </AnimatePresence>

                  {anyFeasible && (
                    <Disclosure label="Why it's the top pick" className="mt-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Meter label="Fits what people like" value={top.breakdown.overallFit} />
                        <Meter label="Fair to everyone" value={top.breakdown.fairness} />
                      </div>
                      <p className="mt-3 text-sm text-pretty text-muted-foreground">
                        Budget, curfew and travel are pass/fail — anything that breaks one is out
                        before ranking starts. What's left is ranked by how well it fits what people
                        like, and whether the same person keeps compromising.
                      </p>
                      {transport && (
                        <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                          {transport.cars.map((c) => (
                            <li key={c.label}>
                              <span className="font-medium text-foreground">{c.driver}</span> drives
                              {c.passengers.length ? ` ${c.passengers.join(", ")}` : ""}
                            </li>
                          ))}
                        </ul>
                      )}
                    </Disclosure>
                  )}
                </Card>
              </div>

              <DemoCoach
                coach={coach}
                members={members}
                youId={youId}
                youName={youName}
                edited={edited}
                busy={interacting}
                onApply={applyMove}
                onPick={(id) => {
                  setYouId(id);
                  setActiveId(id);
                }}
                onClear={() => {
                  setYouId(null);
                  setYouName("");
                }}
                onName={setYouName}
              />
            </div>

            {/* 2 — change something, see it move */}
            <div ref={controlsRef} className="order-first lg:sticky lg:top-24 lg:order-last">
              <Card as="section" className="p-5 sm:p-6">
                <h2 className="text-xl font-semibold tracking-tight">Give the plan a twist</h2>
                <p className="mt-1.5 text-sm text-pretty text-muted-foreground">
                  You're playing all four friends. For real, everyone answers on their own phone and
                  nobody sees anyone else's answers.
                </p>

                <div className="mt-6 border-t border-border pt-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-medium">Whose answers?</div>
                    <button
                      type="button"
                      onClick={undo}
                      disabled={!history.length}
                      className="tap-target inline-flex items-center gap-1.5 rounded-full px-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Undo2 className="size-3.5" aria-hidden /> Undo
                    </button>
                    <AnimatePresence initial={false}>
                      {edited && (
                        <motion.button
                          type="button"
                          onClick={reset}
                          initial={reduce ? false : { opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="tap-target -my-2 inline-flex items-center gap-1.5 rounded-full px-2 text-sm text-muted-foreground hover:text-foreground"
                        >
                          <RotateCcw className="size-3.5" /> Reset
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </div>

                  <div
                    role="group"
                    aria-label="Whose answers"
                    className="mt-2 grid grid-cols-4 gap-1 rounded-2xl bg-secondary p-1"
                  >
                    {members.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        aria-pressed={m.id === activeId}
                        onClick={() => setActiveId(m.id)}
                        className={cn(
                          "relative flex min-h-11 items-center justify-center gap-1 rounded-xl px-1 text-sm transition-colors",
                          m.id === activeId
                            ? "font-semibold text-foreground"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {m.id === activeId && (
                          <motion.span
                            layoutId={reduce ? undefined : "demo-member"}
                            transition={{ type: "spring", stiffness: 420, damping: 34 }}
                            className="absolute inset-0 rounded-xl bg-card shadow-sm"
                          />
                        )}
                        <span aria-hidden className="relative">
                          {m.emoji}
                        </span>
                        <span className="relative">{nameOf(m)}</span>
                      </button>
                    ))}
                  </div>

                  <div className="mt-5 space-y-5">
                    <Range
                      label="Can spend up to"
                      value={`$${active.constraints.maxSpend ?? 0}`}
                      min={5}
                      max={80}
                      step={5}
                      current={active.constraints.maxSpend ?? 20}
                      onChange={(v) => update({ maxSpend: v })}
                      onStart={beginGesture}
                      onEnd={endGesture}
                      hint="Slide left to tighten the budget. Watch which plans still fit."
                    />

                    <div>
                      <Range
                        label="Finish by"
                        value={clock(active.constraints.latestEnd ?? "23:30")}
                        current={minutes(active.constraints.latestEnd ?? "23:30")}
                        min={960}
                        max={1410}
                        step={15}
                        onChange={(v) => update({ latestEnd: timeFromMinutes(v) })}
                        onStart={beginGesture}
                        onEnd={endGesture}
                        hint="Drag the deadline across the evening."
                        interval={{
                          start: minutes(top.option.start),
                          end: minutes(top.option.end),
                        }}
                      />
                      <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                        <span>4 pm</span>
                        <span>11:30 pm</span>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Shaded: {anyFeasible ? "top pick" : "closest option"},{" "}
                        {clockRange(top.option.start, top.option.end)}. Line: this friend's
                        deadline.
                      </p>
                    </div>

                    <Group label="Getting there">
                      <div className="grid grid-cols-2 gap-2">
                        <Chip
                          on={!!active.constraints.canDrive}
                          onClick={() =>
                            update({ canDrive: !active.constraints.canDrive, needsRide: false })
                          }
                        >
                          Can drive
                        </Chip>
                        <Chip
                          on={!!active.constraints.needsRide}
                          onClick={() =>
                            update({ needsRide: !active.constraints.needsRide, canDrive: false })
                          }
                        >
                          Needs a ride
                        </Chip>
                      </div>
                    </Group>

                    <Disclosure label="More answers" meta="Travel, food, interests">
                      <div className="space-y-5 pb-1">
                        <Range
                          label="Will travel up to"
                          value={`${active.constraints.maxTravelMinutes ?? 0} min`}
                          min={5}
                          max={60}
                          step={5}
                          current={active.constraints.maxTravelMinutes ?? 20}
                          onChange={(v) => update({ maxTravelMinutes: v })}
                          onStart={beginGesture}
                          onEnd={endGesture}
                        />
                        <Group label="Food needs">
                          <div className="flex flex-wrap gap-2">
                            {DIET_CHOICES.map((d) => (
                              <Chip
                                key={d}
                                on={(active.constraints.dietary ?? []).includes(d)}
                                onClick={() => toggleIn("dietary", d)}
                              >
                                {d}
                              </Chip>
                            ))}
                          </div>
                        </Group>
                        <Group label="Into">
                          <div className="flex flex-wrap gap-2">
                            {TAG_CHOICES.map((t) => (
                              <Chip
                                key={t}
                                on={(active.constraints.likedTags ?? []).includes(t)}
                                onClick={() => toggleIn("likedTags", t)}
                              >
                                {t}
                              </Chip>
                            ))}
                          </div>
                        </Group>
                      </div>
                    </Disclosure>
                  </div>
                </div>
                <div className="mt-6 border-t border-border pt-5">
                  <div className="text-sm font-medium">Try a plot twist</div>
                  <div className="mt-2 flex flex-col gap-2">
                    {TRY_THESE.map((t) => {
                      const who = members.find((m) => m.id === t.memberId)!;
                      const done = tried.includes(t.id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          disabled={done}
                          onClick={() => tryThis(t)}
                          className={cn(
                            "pressable active:pressable-active tap-target flex items-center justify-between gap-3 rounded-2xl border px-4 py-2.5 text-left transition-colors",
                            done
                              ? "border-primary/40 bg-primary/8"
                              : "border-border hover:bg-secondary",
                          )}
                        >
                          <span className="text-[0.9375rem]">
                            “{t.quote}”
                            <span className="ml-1.5 text-sm text-muted-foreground">
                              — {nameOf(who)}
                            </span>
                          </span>
                          {done ? (
                            <Check className="size-4 shrink-0 text-primary" aria-label="Applied" />
                          ) : (
                            <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* 3 — then do it for real */}
          <section className="mt-10 flex flex-col items-start gap-4 border-t border-border pt-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                Now do it with your real group
              </h2>
              <p className="mt-1 text-base text-muted-foreground">
                Invite links, parent approvals and saved plans. Free, no app to install.
              </p>
            </div>
            <Link
              to="/auth"
              search={{ next: "/home", mode: "signup" }}
              className="pressable active:pressable-active inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 text-base font-semibold text-primary-foreground hover:opacity-92 sm:w-auto"
            >
              Create a group <ArrowRight className="size-4" />
            </Link>
          </section>
        </main>
      )}

      {/* Phones only: the live result, while the controls are on screen */}
      <AnimatePresence>
        {showLiveBar && (
          <motion.button
            type="button"
            onClick={scrollToTop}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className="glass-pill fixed inset-x-3 [--glass-bg-alpha:0.86] bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-40 flex min-h-14 items-center gap-3 rounded-full py-2 pr-4 pl-2 text-left lg:hidden"
          >
            <span
              className={cn(
                "grid size-10 shrink-0 place-items-center rounded-full",
                anyFeasible ? "bg-success/15 text-success" : "bg-destructive/12 text-destructive",
              )}
            >
              {anyFeasible ? <Check className="size-5" /> : <X className="size-5" />}
            </span>
            <span className="min-w-0 flex-1" aria-live={interacting ? "off" : "polite"}>
              <span className="block text-xs text-muted-foreground">
                {anyFeasible
                  ? `Top pick · ${working} plans fit all ${members.length}`
                  : "No plan yet"}
              </span>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={anyFeasible ? top.option.key : "none"}
                  {...swap}
                  className="block truncate text-[0.9375rem] font-semibold"
                >
                  {anyFeasible ? top.option.title : "Nothing fits everyone"}
                </motion.span>
              </AnimatePresence>
            </span>
            <ChevronDown className="size-4 shrink-0 rotate-180 text-muted-foreground" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

function Fact({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Wallet;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-secondary/70 px-3 py-2.5">
      <dt className="flex items-center gap-1 text-xs text-muted-foreground">
        <Icon className="size-3.5" aria-hidden /> {label}
      </dt>
      <dd className="mt-0.5 text-[0.9375rem] font-semibold whitespace-nowrap tabular-nums">
        {children}
      </dd>
    </div>
  );
}

function Disclosure({
  label,
  meta,
  className,
  children,
}: {
  label: string;
  meta?: string;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="tap-target flex w-full items-center justify-between gap-3 text-left"
      >
        <span>
          <span className="text-[0.9375rem] font-medium">{label}</span>
          {meta && <span className="ml-2 text-sm text-muted-foreground">{meta}</span>}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-300",
            open && "rotate-180",
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label}>
      <div className="mb-2 text-sm text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function Range({
  label,
  value,
  current,
  onChange,
  onStart,
  onEnd,
  hint,
  interval,
  ...bounds
}: {
  label: string;
  value: string;
  current: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  onStart: () => void;
  onEnd: () => void;
  hint?: string;
  interval?: { start: number; end: number };
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-xl font-semibold tabular-nums text-primary">{value}</span>
      </span>
      <span
        className={cn(
          "relative mt-1 block h-11",
          interval &&
            "rounded-lg bg-secondary has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary",
        )}
      >
        {interval && (
          <span aria-hidden="true" className="pointer-events-none absolute inset-x-2 inset-y-0">
            <span
              className="absolute inset-y-2 rounded bg-primary/25"
              style={{
                left: `${Math.max(0, ((interval.start - bounds.min) / (bounds.max - bounds.min)) * 100)}%`,
                width: `${Math.max(0, ((Math.min(interval.end, bounds.max) - Math.max(interval.start, bounds.min)) / (bounds.max - bounds.min)) * 100)}%`,
              }}
            />
            <span
              className="absolute inset-y-0 w-0.5 bg-primary"
              style={{ left: `${((current - bounds.min) / (bounds.max - bounds.min)) * 100}%` }}
            >
              <span className="absolute top-1/2 left-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary" />
            </span>
          </span>
        )}
        <input
          type="range"
          {...bounds}
          value={current}
          aria-label={label}
          aria-valuetext={value}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            onStart();
          }}
          onPointerUp={onEnd}
          onPointerCancel={onEnd}
          onKeyDown={(e) => {
            if (
              [
                "ArrowLeft",
                "ArrowRight",
                "ArrowUp",
                "ArrowDown",
                "Home",
                "End",
                "PageUp",
                "PageDown",
              ].includes(e.key)
            )
              onStart();
          }}
          onKeyUp={onEnd}
          onBlur={onEnd}
          onChange={(e) => onChange(Number(e.target.value))}
          className={cn(
            "relative h-11 w-full cursor-pointer accent-primary",
            interval && "opacity-0",
          )}
        />
      </span>
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

function Chip({
  on,
  onClick,
  className,
  children,
}: {
  on: boolean;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "pressable active:pressable-active min-h-11 rounded-full border px-3.5 text-sm whitespace-nowrap tabular-nums transition-colors",
        on
          ? "border-primary bg-primary/10 font-semibold text-primary"
          : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}
