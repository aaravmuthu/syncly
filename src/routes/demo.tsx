import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Clock,
  LifeBuoy,
  Lock,
  MapPin,
  MessageCircle,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Wallet,
  Wand2,
  X,
  type LucideIcon,
} from "lucide-react";
import { ThinkingOrb } from "thinking-orbs";
import { BRAND } from "@/lib/brand";
import { Wordmark } from "@/components/quorum/Wordmark";
import { Card, Meter, Pill } from "@/components/quorum/ui";
import { haptic } from "@/lib/quorum/haptics";
import { rankOptions, buildTransportPlan, scoreOption } from "@/lib/quorum/engine";
import { estimateCost } from "@/lib/quorum/cost";
import type { ConstraintPayload, OptionSeed } from "@/lib/quorum/types";
import { cn } from "@/lib/utils";
import { DEMO_POOL, type DemoMember } from "@/lib/quorum/demo-group";
import { inputsOf } from "@/lib/quorum/demo-ai";
import {
  SAMPLE_SQUAD,
  SquadSetup,
  applyIdentities,
  loadSquad,
  type Identity,
} from "@/components/quorum/demo/SquadSetup";
import { EngineReveal } from "@/components/quorum/demo/EngineReveal";
import { AskPanel, MagicPanel, RescuePanel } from "@/components/quorum/demo/AiPanels";
import { ParentPanel } from "@/components/quorum/demo/ParentPanel";
import { LockedPlan } from "@/components/quorum/demo/LockedPlan";
import { DeckDots, PlanSwipe } from "@/components/quorum/demo/PlanSwipe";
import { HoldButton } from "@/components/quorum/demo/HoldButton";
import {
  AnimatedNumber,
  Chip,
  Disclosure,
  Fact,
  Group,
  Range,
  SPRING,
  clock,
  clockRange,
  joinNames,
  useSwap,
} from "@/components/quorum/demo/shared";

const TITLE = `Try ${BRAND.name} — interactive demo, no account needed`;
const DESCRIPTION =
  "Name your own squad, watch Syncly find a plan that works for everyone, ask the AI, rescue a dead end and approve as a parent. No account needed.";

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

/** The dead end the rescue demo starts from: a family dinner moves up. */
const BREAK_HOME_BY = "18:00";

type Stage = "setup" | "reveal" | "play";
type Mode = "answers" | "ask" | "describe" | "rescue" | "parent";

const MODES: { id: Mode; icon: LucideIcon; title: string; hint: string; ai?: boolean }[] = [
  {
    id: "answers",
    icon: SlidersHorizontal,
    title: "Change answers",
    hint: "Edit what anyone needs",
  },
  {
    id: "ask",
    icon: MessageCircle,
    title: "Ask Syncly",
    hint: "Questions about your night",
    ai: true,
  },
  { id: "describe", icon: Wand2, title: "Describe a night", hint: "Say it, get a plan", ai: true },
  {
    id: "rescue",
    icon: LifeBuoy,
    title: "Rescue a dead end",
    hint: "AI fixes a stuck plan",
    ai: true,
  },
  { id: "parent", icon: ShieldCheck, title: "Parent approval", hint: "A link, no app" },
];

function DemoPage() {
  const reduce = useReducedMotion();
  const swap = useSwap();

  const [stage, setStage] = useState<Stage>("setup");
  const [squad, setSquad] = useState<Identity[]>(SAMPLE_SQUAD);
  const [hydrated, setHydrated] = useState(false);
  const [members, setMembers] = useState<DemoMember[]>(() => applyIdentities(SAMPLE_SQUAD));
  const [activeId, setActiveId] = useState("m1");
  const [tried, setTried] = useState<string[]>([]);
  const [mode, setMode] = useState<Mode>("answers");
  // An option the visitor (or an AI panel) put on the card in place of the engine's top pick.
  const [focus, setFocus] = useState<OptionSeed | null>(null);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    const saved = loadSquad();
    if (saved) setSquad(saved);
    setHydrated(true);
  }, []);

  const base = useMemo(() => applyIdentities(squad), [squad]);
  const names = members.map((m) => m.name);
  const active = members.find((m) => m.id === activeId)!;
  const edited = members.some((m, i) => m.constraints !== base[i]?.constraints);

  const clearPlanState = () => {
    setFocus(null);
    setLocked(false);
  };

  const patchMember = (id: string, patch: Partial<ConstraintPayload>) => {
    clearPlanState();
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
    clearPlanState();
    setMembers(base);
    setTried([]);
  };

  const breakTonight = () => {
    clearPlanState();
    setMembers((prev) =>
      prev.map((m) => ({ ...m, constraints: { ...m.constraints, latestEnd: BREAK_HOME_BY } })),
    );
  };

  const startWith = (chosen: Identity[]) => {
    setSquad(chosen);
    setMembers(applyIdentities(chosen));
    setActiveId("m1");
    setTried([]);
    setMode("answers");
    clearPlanState();
    setStage("reveal");
  };

  const ranked = useMemo(() => rankOptions(DEMO_POOL, inputsOf(members)), [members]);
  const top = ranked[0]!;
  const broken = !top.feasible;

  const shown = useMemo(
    () => (focus ? scoreOption(focus, inputsOf(members)) : top),
    [focus, members, top],
  );
  const anyFeasible = shown.feasible;
  // Everything that works for the whole squad, best first: the cards you can
  // throw sideways. A plan moved off its catalog time (the rescue) isn't one of
  // them, so the deck steps aside until you're back on a catalog plan.
  const deck = useMemo(() => ranked.filter((r) => r.feasible).map((r) => r.option), [ranked]);
  const deckIndex = anyFeasible
    ? deck.findIndex((o) => o.key === shown.option.key && o.start === shown.option.start)
    : -1;
  const [deckDir, setDeckDir] = useState<1 | -1>(1);
  const goDeck = (next: number, dir: 1 | -1) => {
    const option = deck[next];
    if (!option) return;
    haptic("select");
    setDeckDir(dir);
    setLocked(false);
    setFocus(next === 0 ? null : option);
  };
  const cardMotion = reduce
    ? { initial: false as const, animate: {}, exit: {} }
    : {
        variants: {
          enter: (d: number) => ({ opacity: 0, x: d * 56, filter: "blur(4px)" }),
          center: { opacity: 1, x: 0, filter: "blur(0px)" },
          leave: (d: number) => ({ opacity: 0, x: d * -56, filter: "blur(4px)" }),
        },
        initial: "enter",
        animate: "center",
        exit: "leave",
        transition: { type: "spring" as const, stiffness: 420, damping: 38 },
      };
  const others = ranked.filter((r) => r.option.key !== shown.option.key).slice(0, 3);
  const othersWorking = others.filter((r) => r.feasible).length;

  // The engine re-ranks synchronously, so the list is already correct on the
  // next frame -- the orb just makes the recompute legible for a moment
  // instead of the cards silently reshuffling under the pointer.
  const [reranking, setReranking] = useState(false);
  const firstRank = useRef(true);
  useEffect(() => {
    if (firstRank.current) {
      firstRank.current = false;
      return;
    }
    setReranking(true);
    const t = window.setTimeout(() => setReranking(false), 650);
    return () => window.clearTimeout(t);
  }, [ranked]);

  // Name what just happened when the pick changes, without saying whose
  // answer caused it -- the same rule the real plan screen follows.
  const [change, setChange] = useState<string | null>(null);
  const prevTop = useRef(top);
  useEffect(() => {
    const prev = prevTop.current;
    prevTop.current = top;
    if (prev.option.key === top.option.key && prev.feasible === top.feasible) return;
    const prevNow = ranked.find((r) => r.option.key === prev.option.key);
    if (!top.feasible) setChange(null);
    else if (prevNow && !prevNow.feasible)
      setChange(`${prev.option.title} no longer works for everyone.`);
    else if (!prev.feasible) setChange("Something works for everyone again.");
    else setChange(`${prev.option.title} slipped to a closer second.`);
  }, [top, ranked]);

  const cost = estimateCost({
    costMin: shown.option.costMin,
    costMax: shown.option.costMax,
    travelMinutes: shown.option.travelMinutes,
    category: "hangout",
    headcount: members.length,
    requiresDriving: shown.option.requiresDriving,
  });

  const transport = shown.option.requiresDriving
    ? buildTransportPlan(
        shown.option,
        members.map((m) => ({ profileId: m.id, name: m.name, constraints: m.constraints })),
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
    if (stage !== "play") return;
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
  const showLiveBar = stage === "play" && controlsVisible && !topVisible && !locked;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [stage]);

  const scrollToTop = () =>
    topRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });

  const pickMode = (next: Mode) => {
    haptic("select");
    setMode(next);
    if (!controlsVisible)
      window.setTimeout(
        () =>
          controlsRef.current?.scrollIntoView({
            behavior: reduce ? "auto" : "smooth",
            block: "start",
          }),
        60,
      );
  };

  const show = (option: OptionSeed) => {
    setLocked(false);
    setFocus(option);
    if (!topVisible) window.setTimeout(scrollToTop, 120);
  };

  const tryThis = (t: (typeof TRY_THESE)[number]) => {
    haptic("tap");
    const m = members.find((x) => x.id === t.memberId)!;
    setActiveId(t.memberId);
    patchMember(t.memberId, t.patch(m.constraints));
    setTried((prev) => [...prev, t.id]);
    if (!topVisible) window.setTimeout(scrollToTop, 120);
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
              <Lock className="size-3" /> Demo — nothing leaves this device
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

      <main className="mx-auto max-w-6xl px-4 pt-7 pb-32 sm:px-5 sm:pt-10 lg:pb-16">
        <AnimatePresence mode="wait" initial={false}>
          {stage === "setup" && (
            <motion.div key="setup" {...swap}>
              <h1 className="mx-auto max-w-[20ch] text-center text-[2rem] leading-[1.08] font-semibold tracking-tight text-balance sm:text-4xl">
                Plan a night your whole squad can actually do
              </h1>
              <p className="mx-auto mt-3 mb-7 max-w-[48ch] text-center text-base text-pretty text-muted-foreground">
                Everyone's budget, curfew and ride stays private. {BRAND.name} still finds the plan
                that works for all of them. Try it with your friends.
              </p>
              <SquadSetup
                key={hydrated ? "loaded" : "initial"}
                initial={squad}
                onStart={startWith}
              />
            </motion.div>
          )}

          {stage === "reveal" && (
            <motion.div key="reveal" {...swap}>
              <EngineReveal members={members} pool={DEMO_POOL} onDone={() => setStage("play")} />
            </motion.div>
          )}

          {stage === "play" && (
            <motion.div key="play" {...swap}>
              <h1 className="max-w-[26ch] text-[2rem] leading-[1.08] font-semibold tracking-tight text-balance sm:max-w-[34ch] sm:text-4xl">
                Friday night, for {joinNames(names)}
              </h1>
              <p className="mt-3 max-w-[52ch] text-base text-pretty text-muted-foreground">
                Each of them answered a few questions privately. {BRAND.name} found a plan that
                works for all {members.length}. Pick something to try.
              </p>
              <div className="mt-1 flex flex-wrap gap-x-1">
                <button
                  type="button"
                  onClick={() => setStage("reveal")}
                  className="tap-target inline-flex items-center gap-1.5 rounded-full pr-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="size-3.5" /> Replay the intro
                </button>
                <button
                  type="button"
                  onClick={() => setStage("setup")}
                  className="tap-target inline-flex items-center rounded-full px-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  Change the squad
                </button>
              </div>

              {/* What do you want to try? */}
              <div
                role="tablist"
                aria-label="What to try"
                className="isolate mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5"
              >
                {MODES.map((m) => {
                  const on = m.id === mode;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      role="tab"
                      id={`tab-${m.id}`}
                      aria-selected={on}
                      aria-controls="demo-panel"
                      onClick={() => pickMode(m.id)}
                      className={cn(
                        "pressable active:pressable-active relative min-h-[4.5rem] rounded-2xl border p-3 text-left transition-colors",
                        on
                          ? "border-primary/50 text-foreground"
                          : "border-border text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                      )}
                    >
                      {on && (
                        <motion.span
                          layoutId="demo-mode"
                          transition={SPRING}
                          className="absolute inset-0 rounded-2xl bg-primary/10"
                        />
                      )}
                      <span className="relative z-10 flex items-center justify-between gap-2">
                        <m.icon className={cn("size-5", on && "text-primary")} aria-hidden />
                        {m.ai && (
                          <span className="rounded-full bg-primary/12 px-1.5 py-0.5 text-[0.625rem] font-semibold tracking-wide text-primary">
                            AI
                          </span>
                        )}
                      </span>
                      <span className="relative z-10 mt-1.5 block text-[0.9375rem] leading-tight font-semibold text-foreground">
                        {m.title}
                      </span>
                      <span className="relative z-10 mt-0.5 block text-xs leading-snug">
                        {m.hint}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 grid gap-5 lg:mt-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start lg:gap-8">
                {/* 1 — the answer, first */}
                <div className="space-y-3">
                  <div ref={topRef}>
                    {locked && anyFeasible ? (
                      <LockedPlan
                        members={members}
                        plan={shown}
                        onUnlock={() => setLocked(false)}
                      />
                    ) : (
                      <Card
                        as="section"
                        className={cn(
                          "p-5 sm:p-6",
                          anyFeasible ? "ring-1 ring-primary/35" : "ring-1 ring-destructive/30",
                        )}
                      >
                        <div className="flex min-h-7 items-center justify-between gap-3">
                          <span className="text-sm font-medium text-muted-foreground">
                            {!anyFeasible ? "No plan yet" : focus ? "Your pick" : "Top pick"}
                          </span>
                          <span aria-live="polite" className="flex items-center">
                            {reranking ? (
                              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                <ThinkingOrb state="solving" size={20} aria-hidden="true" />
                                Re-ranking…
                              </span>
                            ) : anyFeasible ? (
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

                        <PlanSwipe
                          index={Math.max(0, deckIndex)}
                          count={deckIndex >= 0 ? deck.length : 0}
                          onGo={goDeck}
                        >
                          <AnimatePresence mode="popLayout" initial={false} custom={deckDir}>
                            <motion.div
                              key={
                                anyFeasible ? `${shown.option.key}-${shown.option.start}` : "none"
                              }
                              custom={deckDir}
                              {...(anyFeasible ? cardMotion : swap)}
                            >
                              {anyFeasible ? (
                                <>
                                  <h2 className="mt-3 text-2xl leading-tight font-semibold tracking-tight sm:text-[1.75rem]">
                                    {shown.option.title}
                                  </h2>
                                  <p className="mt-1 text-base text-muted-foreground">
                                    {shown.option.subtitle}
                                  </p>
                                  <dl className="mt-4 grid grid-cols-3 gap-2">
                                    <Fact icon={Wallet} label="Each">
                                      <AnimatedNumber prefix="$" value={cost.perPersonMin} />–
                                      <AnimatedNumber value={cost.perPersonMax} />
                                    </Fact>
                                    <Fact icon={Clock} label="When">
                                      {clockRange(shown.option.start, shown.option.end)}
                                    </Fact>
                                    <Fact icon={MapPin} label="Away">
                                      <AnimatedNumber
                                        value={shown.option.travelMinutes}
                                        suffix=" min"
                                      />
                                    </Fact>
                                  </dl>
                                  <ul className="mt-4 space-y-2 text-[0.9375rem]">
                                    {shown.breakdown.reasons.slice(0, 3).map((reason, i) => (
                                      <motion.li
                                        key={reason}
                                        initial={reduce ? false : { opacity: 0, x: -8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: reduce ? 0 : 0.08 * i + 0.1 }}
                                        className="flex gap-2.5"
                                      >
                                        <Check className="mt-0.5 size-4 shrink-0 text-success" />
                                        {reason}
                                      </motion.li>
                                    ))}
                                  </ul>
                                </>
                              ) : (
                                <>
                                  <h2 className="mt-3 text-2xl leading-tight font-semibold tracking-tight">
                                    Nothing works for everyone
                                  </h2>
                                  <p className="mt-2 text-base text-pretty text-muted-foreground">
                                    Someone's limits rule out every option. Nobody finds out whose —
                                    the group just sees it's time to loosen something.
                                  </p>
                                  <div className="mt-4 flex flex-wrap gap-2">
                                    {mode !== "rescue" && (
                                      <button
                                        type="button"
                                        onClick={() => pickMode("rescue")}
                                        className="pressable active:pressable-active tap-target inline-flex items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-92"
                                      >
                                        <LifeBuoy className="size-4" /> Ask the AI for a fix
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={reset}
                                      className="pressable active:pressable-active tap-target inline-flex items-center gap-2 rounded-full border border-border px-4 text-sm font-semibold"
                                    >
                                      <RotateCcw className="size-4" /> Reset the group
                                    </button>
                                  </div>
                                </>
                              )}
                            </motion.div>
                          </AnimatePresence>
                        </PlanSwipe>
                        {deckIndex >= 0 && (
                          <DeckDots index={deckIndex} count={deck.length} onGo={goDeck} />
                        )}

                        <AnimatePresence initial={false}>
                          {change && anyFeasible && !focus && (
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
                          <>
                            <div className="mt-4 flex flex-wrap items-center gap-2">
                              <HoldButton
                                onConfirm={() => setLocked(true)}
                                className="tap-target px-5 hover:opacity-92"
                              >
                                <Lock className="size-4" /> Hold to lock it in
                              </HoldButton>
                              {focus && (
                                <button
                                  type="button"
                                  onClick={() => setFocus(null)}
                                  className="tap-target rounded-full px-3 text-sm text-muted-foreground hover:text-foreground"
                                >
                                  Back to {BRAND.name}'s pick
                                </button>
                              )}
                            </div>
                            <Disclosure label="Why it's the top pick" className="mt-3">
                              <div className="grid gap-3 sm:grid-cols-2">
                                <Meter
                                  label="Fits what people like"
                                  value={shown.breakdown.overallFit}
                                />
                                <Meter label="Fair to everyone" value={shown.breakdown.fairness} />
                              </div>
                              <p className="mt-3 text-sm text-pretty text-muted-foreground">
                                Budget, curfew and travel are pass/fail — anything that breaks one
                                is out before ranking starts. What's left is ranked by how well it
                                fits what people like, and whether the same person keeps
                                compromising.
                              </p>
                              {transport && (
                                <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                                  {transport.cars.map((c) => (
                                    <li key={c.label}>
                                      <span className="font-medium text-foreground">
                                        {c.driver}
                                      </span>{" "}
                                      drives
                                      {c.passengers.length ? ` ${c.passengers.join(", ")}` : ""}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </Disclosure>
                          </>
                        )}
                      </Card>
                    )}
                  </div>

                  <Disclosure
                    label={`${others.length} other options`}
                    meta={`${othersWorking} work for everyone`}
                    className="surface px-5 py-1"
                  >
                    <LayoutGroup>
                      <ul className="-mt-1 pb-3">
                        {others.map((r) => (
                          <motion.li
                            key={r.option.key}
                            layout={reduce ? false : "position"}
                            transition={{ type: "spring", stiffness: 420, damping: 36 }}
                            className="flex items-center justify-between gap-3 border-t border-border py-3 first:border-t-0"
                          >
                            <div className="min-w-0">
                              <div className="truncate text-[0.9375rem] font-medium">
                                {r.option.title}
                              </div>
                              <div className="text-sm text-muted-foreground tabular-nums">
                                ${r.option.costMin}–{r.option.costMax} ·{" "}
                                {clockRange(r.option.start, r.option.end)}
                              </div>
                            </div>
                            {r.feasible ? (
                              <Pill tone="good" className="shrink-0">
                                <Check className="size-3" /> Works
                              </Pill>
                            ) : (
                              <Pill tone="bad" className="shrink-0">
                                <X className="size-3" /> Not for all
                              </Pill>
                            )}
                          </motion.li>
                        ))}
                      </ul>
                    </LayoutGroup>
                  </Disclosure>
                </div>

                {/* 2 — whatever they chose to try */}
                <div ref={controlsRef} className="scroll-mt-20 lg:sticky lg:top-24">
                  <Card as="section" className="p-5 sm:p-6">
                    <div role="tabpanel" id="demo-panel" aria-labelledby={`tab-${mode}`}>
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.div key={mode} {...swap}>
                          {mode === "answers" && (
                            <AnswersPanel
                              members={members}
                              active={active}
                              activeId={activeId}
                              setActiveId={setActiveId}
                              edited={edited}
                              reset={reset}
                              tried={tried}
                              tryThis={tryThis}
                              update={update}
                              toggleIn={toggleIn}
                            />
                          )}
                          {mode === "ask" && (
                            <AskPanel members={members} pool={DEMO_POOL} onShow={show} />
                          )}
                          {mode === "describe" && (
                            <MagicPanel members={members} pool={DEMO_POOL} onShow={show} />
                          )}
                          {mode === "rescue" && (
                            <RescuePanel
                              members={members}
                              pool={DEMO_POOL}
                              onShow={show}
                              onBreak={breakTonight}
                              onReset={reset}
                              broken={broken}
                            />
                          )}
                          {mode === "parent" && (
                            <ParentPanel
                              members={members}
                              shown={shown}
                              anyFeasible={anyFeasible}
                              onCondition={(id, latestEnd) => patchMember(id, { latestEnd })}
                              onClearCondition={reset}
                            />
                          )}
                        </motion.div>
                      </AnimatePresence>
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
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Phones only: the live result, while the controls are on screen */}
      <AnimatePresence>
        {showLiveBar && (
          <motion.button
            type="button"
            onClick={scrollToTop}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
            transition={SPRING}
            className="glass-pill fixed inset-x-3 [--glass-bg-alpha:0.86] bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-40 flex min-h-14 items-center gap-3 rounded-full py-2 pr-4 pl-2 text-left lg:hidden"
          >
            <span
              className={cn(
                "grid size-10 shrink-0 place-items-center rounded-full",
                anyFeasible ? "bg-success/15 text-success" : "bg-destructive/12 text-destructive",
              )}
            >
              {reranking ? (
                <ThinkingOrb state="solving" size={20} aria-hidden="true" />
              ) : anyFeasible ? (
                <Check className="size-5" />
              ) : (
                <X className="size-5" />
              )}
            </span>
            <span className="min-w-0 flex-1" aria-live="polite">
              <span className="block text-xs text-muted-foreground">
                {anyFeasible
                  ? `${focus ? "Your pick" : "Top pick"} · works for all ${members.length}`
                  : "No plan yet"}
              </span>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={anyFeasible ? shown.option.key : "none"}
                  {...swap}
                  className="block truncate text-[0.9375rem] font-semibold"
                >
                  {anyFeasible ? shown.option.title : "Nothing fits everyone"}
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

function AnswersPanel({
  members,
  active,
  activeId,
  setActiveId,
  edited,
  reset,
  tried,
  tryThis,
  update,
  toggleIn,
}: {
  members: DemoMember[];
  active: DemoMember;
  activeId: string;
  setActiveId: (id: string) => void;
  edited: boolean;
  reset: () => void;
  tried: string[];
  tryThis: (t: (typeof TRY_THESE)[number]) => void;
  update: (patch: Partial<ConstraintPayload>) => void;
  toggleIn: (key: "likedTags" | "dietary", value: string) => void;
}) {
  const reduce = useReducedMotion();
  return (
    <>
      <h2 className="text-xl font-semibold tracking-tight">Change what someone needs</h2>
      <p className="mt-1.5 text-sm text-pretty text-muted-foreground">
        You're playing all {members.length} friends. For real, everyone answers on their own phone
        and nobody sees anyone else's answers.
      </p>

      <div className="mt-5">
        <div className="text-sm font-medium">Try one</div>
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
                  done ? "border-primary/40 bg-primary/8" : "border-border hover:bg-secondary",
                )}
              >
                <span className="text-[0.9375rem]">
                  “{t.quote}”
                  <span className="ml-1.5 text-sm text-muted-foreground">— {who.name}</span>
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

      <div className="mt-6 border-t border-border pt-5">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium">Or edit anyone's answers</div>
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
          role="tablist"
          aria-label="Whose answers"
          className="isolate mt-2 grid grid-cols-4 gap-1 rounded-2xl bg-secondary p-1"
        >
          {members.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={m.id === activeId}
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
                  layoutId="demo-member"
                  transition={SPRING}
                  className="absolute inset-0 rounded-xl bg-card shadow-sm"
                />
              )}
              {/* Labels sit above the sliding pill: it lives in the newly active tab, so
                  mid-slide it would otherwise paint over the previous tab's label. */}
              <span aria-hidden className="relative z-10">
                {m.emoji}
              </span>
              <span className="relative z-10 truncate">{m.name}</span>
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
          />

          <Group label="Home by">
            <div className="grid grid-cols-4 gap-2">
              {CURFEWS.map((t) => (
                <Chip
                  key={t}
                  on={active.constraints.latestEnd === t}
                  onClick={() => update({ latestEnd: t })}
                  className="px-1"
                >
                  {clock(t)}
                </Chip>
              ))}
            </div>
          </Group>

          <Group label="Getting there">
            <div className="grid grid-cols-2 gap-2">
              <Chip
                on={!!active.constraints.canDrive}
                onClick={() => update({ canDrive: !active.constraints.canDrive, needsRide: false })}
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
    </>
  );
}
