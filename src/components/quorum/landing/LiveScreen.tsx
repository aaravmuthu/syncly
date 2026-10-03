import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  animate,
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
  type MotionValue,
} from "motion/react";
import { Check, Clock, Lock, MapPin, Wallet, X } from "lucide-react";
import { ThinkingOrb } from "thinking-orbs";
import { Wordmark } from "@/components/quorum/Wordmark";
import { DEMO_GROUP, DEMO_POOL, type DemoMember } from "@/lib/quorum/demo-group";
import { rankOptions } from "@/lib/quorum/engine";
import { estimateCost } from "@/lib/quorum/cost";
import { cn } from "@/lib/utils";

/*
 * The landing iPad's screen, rendered live instead of as a screenshot: the
 * same sample group and engine as /demo, drawn at a fixed "app size" and
 * scaled to the glass. Scroll wakes it piece by piece (the `at` windows on
 * the screen's own 0→1 timeline, as the screenshot slices had), then a short
 * story loops: a friend changes an answer privately, the engine re-ranks,
 * and the top pick moves. Nobody's actual answer is ever shown -- only that
 * someone answered -- the same rule the real app follows.
 */

const CANVAS = {
  landscape: { w: 960, h: 668 },
  // An iPad held upright. The narrower canvas scales up more, so the text
  // stays legible when the whole device is phone-width.
  portrait: { w: 480, h: 692 },
} as const;

const EASE = [0.23, 1, 0.32, 1] as const;
const clamp = (v: number) => Math.min(1, Math.max(0, v));
const seg = (v: number, a: number, b: number) => 1 - Math.pow(1 - clamp((v - a) / (b - a)), 3);

const withHalal = DEMO_GROUP.map((m) =>
  m.id === "m1"
    ? {
        ...m,
        constraints: { ...m.constraints, dietary: [...(m.constraints.dietary ?? []), "halal"] },
      }
    : m,
);

type Beat = {
  ms: number;
  group: DemoMember[];
  /** Whose row shows the typing dots. */
  typing?: string;
  reranking?: boolean;
  /** Short line under the top pick after it changes. */
  note?: string;
  /** Whose sealed answer flies into the engine during a re-rank. */
  from?: string;
};

// Theo's limit drops to $5. Checked against the engine: with it, no plan
// works for all four, which is the dead end the second half of the loop shows.
const withBroke = DEMO_GROUP.map((m) =>
  m.id === "m4" ? { ...m, constraints: { ...m.constraints, maxSpend: 5 } } : m,
);

// ~20s loop, two stories. First a friend changes an answer and the top pick
// moves; then a limit rules out every plan, and loosening it brings plans
// back. Each beat's `group` is what the engine ranks during it.
const STORY: Beat[] = [
  { ms: 2600, group: DEMO_GROUP },
  { ms: 1700, group: DEMO_GROUP, typing: "m1" },
  { ms: 1000, group: withHalal, reranking: true, from: "m1" },
  { ms: 3000, group: withHalal, note: "Foxglove Cafe no longer works for everyone." },
  { ms: 1700, group: withHalal, typing: "m1" },
  { ms: 1000, group: DEMO_GROUP, reranking: true, from: "m1" },
  { ms: 2200, group: DEMO_GROUP },
  { ms: 1700, group: DEMO_GROUP, typing: "m4" },
  { ms: 1000, group: withBroke, reranking: true, from: "m4" },
  { ms: 3000, group: withBroke },
  { ms: 1700, group: withBroke, typing: "m4" },
  { ms: 1000, group: DEMO_GROUP, reranking: true, from: "m4" },
];

const rank = (group: DemoMember[]) =>
  rankOptions(
    DEMO_POOL,
    group.map((m) => ({
      profileId: m.id,
      constraints: m.constraints,
      sacrificeLoad: m.sacrificeLoad,
    })),
  ).slice(0, 4);

function clockRange(a: string, b: string) {
  const fmt = (t: string, suffix: boolean) => {
    const [h, m] = t.split(":").map(Number);
    const base = `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""}`;
    return suffix ? `${base} ${h < 12 ? "am" : "pm"}` : base;
  };
  const same = Number(a.split(":")[0]) < 12 === Number(b.split(":")[0]) < 12;
  return `${fmt(a, !same)}–${fmt(b, true)}`;
}

export function LiveScreen({
  progress,
  portrait,
  reduce,
}: {
  progress: MotionValue<number>;
  portrait: boolean;
  reduce: boolean;
}) {
  const size = CANVAS[portrait ? "portrait" : "landscape"];
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Scale the fixed-size app to the glass. Set on the element itself so a
  // resize never re-renders the tree.
  useLayoutEffect(() => {
    const frame = frameRef.current;
    const canvas = canvasRef.current;
    if (!frame || !canvas) return;
    const fit = () => {
      canvas.style.transform = `scale(${frame.clientWidth / size.w})`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(frame);
    return () => ro.disconnect();
  }, [size.w]);

  // The story only runs once the screen is fully awake, on screen, and the
  // visitor hasn't asked for less motion.
  const [awake, setAwake] = useState(reduce);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (reduce) return setAwake(true);
    const update = (v: number) => setAwake(v >= 0.8);
    update(progress.get());
    return progress.on("change", update);
  }, [progress, reduce]);
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const [beat, setBeat] = useState(0);
  const running = awake && visible && !reduce;
  useEffect(() => {
    if (!running) return;
    const t = window.setTimeout(() => setBeat((b) => (b + 1) % STORY.length), STORY[beat].ms);
    return () => window.clearTimeout(t);
  }, [running, beat]);

  const b = STORY[beat];
  const ranked = useMemo(() => rank(b.group), [b.group]);
  const top = ranked[0];
  // No option works for everyone: the card says so instead of naming a pick.
  const deadEnd = !top.feasible;

  // A sealed answer travels from its friend into the engine on each re-rank.
  // Only that something was sent is shown, never what it said.
  const cardRef = useRef<HTMLDivElement>(null);
  const memberEls = useRef<Record<string, HTMLElement | null>>({});
  const [flight, setFlight] = useState<{
    id: number;
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  } | null>(null);
  useLayoutEffect(() => {
    const frame = frameRef.current;
    const canvas = canvasRef.current;
    const card = cardRef.current;
    const from = b.reranking && b.from ? memberEls.current[b.from] : null;
    if (!running || !frame || !canvas || !card || !from) return setFlight(null);
    const k = frame.clientWidth / size.w;
    const c = canvas.getBoundingClientRect();
    const a = from.getBoundingClientRect();
    const d = card.getBoundingClientRect();
    setFlight({
      id: beat,
      x0: (a.left + a.width * (portrait ? 0.5 : 0.9) - c.left) / k,
      y0: (a.top + a.height * 0.5 - c.top) / k,
      x1: (d.left + d.width * 0.5 - c.left) / k,
      y1: (d.top + d.height * 0.32 - c.top) / k,
    });
  }, [beat, running, b.reranking, b.from, portrait, size.w]);
  const cost = estimateCost({
    costMin: top.option.costMin,
    costMax: top.option.costMax,
    travelMinutes: top.option.travelMinutes,
    category: "hangout",
    headcount: DEMO_GROUP.length,
    requiresDriving: top.option.requiresDriving,
  });

  // The first-wake orb beat: the ranking "computes" before the card lands.
  const orbOpacity = useTransform(() =>
    reduce ? 0 : seg(progress.get(), 0.04, 0.12) * (1 - seg(progress.get(), 0.2, 0.28)),
  );
  const [orbOn, setOrbOn] = useState(false);
  useEffect(() => orbOpacity.on("change", (v) => setOrbOn(v > 0.01)), [orbOpacity]);

  const stage = (at: [number, number], x = 0, y = 12) => ({ progress, at, x, y, reduce });

  const members = (
    <ul className={cn("grid gap-2", portrait ? "grid-cols-4" : "grid-cols-1")}>
      {DEMO_GROUP.map((m, i) => (
        <Stage key={m.id} {...stage([0.14 + i * 0.03, 0.38 + i * 0.03], -12, 0)}>
          {portrait ? (
            <MemberTile
              member={m}
              typing={b.typing === m.id}
              liRef={(el) => (memberEls.current[m.id] = el)}
            />
          ) : (
            <MemberRow
              member={m}
              typing={b.typing === m.id}
              liRef={(el) => (memberEls.current[m.id] = el)}
            />
          )}
        </Stage>
      ))}
    </ul>
  );

  const topCard = (
    <div className="relative">
      <Stage {...stage([0.28, 0.54], 0, 28)}>
        <div
          ref={cardRef}
          className={cn(
            "relative overflow-hidden rounded-[22px] border bg-card p-5 transition-colors duration-500",
            deadEnd ? "border-destructive/45" : b.note ? "border-primary/60" : "border-primary/25",
          )}
        >
          {!reduce && (
            <motion.span
              key={`${top.option.key}-${deadEnd}`}
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 z-10 w-1/2"
              style={{
                background:
                  "linear-gradient(90deg, transparent, color-mix(in oklab, var(--primary) 16%, transparent), transparent)",
              }}
              initial={{ transform: "translateX(-130%) skewX(-14deg)" }}
              animate={{ transform: "translateX(320%) skewX(-14deg)" }}
              transition={{ duration: 1.2, ease: EASE, delay: 0.1 }}
            />
          )}
          {b.reranking && !reduce && (
            <motion.span
              key={`ping-${beat}`}
              aria-hidden
              className="pointer-events-none absolute inset-0 z-10 rounded-[22px] ring-2 ring-primary/70"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ delay: 0.55, duration: 0.75, times: [0, 0.25, 1] }}
            />
          )}
          <div className="flex h-7 items-center justify-between">
            <span className="text-[14px] text-muted-foreground">Top pick</span>
            <AnimatePresence mode="popLayout" initial={false}>
              {b.reranking ? (
                <Swap
                  key="rr"
                  className="flex items-center gap-1.5 text-[14px] text-muted-foreground"
                >
                  <ThinkingOrb state="solving" size={20} paused={!running} aria-hidden="true" />
                  Re-ranking…
                </Swap>
              ) : deadEnd ? (
                <Swap key="no">
                  <LivePill tone="bad">
                    <X className="size-3.5" /> No plan yet
                  </LivePill>
                </Swap>
              ) : (
                <Swap key="ok">
                  <LivePill tone="good">
                    <Check className="size-3.5" /> Works for all 4
                  </LivePill>
                </Swap>
              )}
            </AnimatePresence>
          </div>
          <div className={cn("transition-opacity duration-300", b.reranking && "opacity-45")}>
            <AnimatePresence mode="popLayout" initial={false}>
              {deadEnd ? (
                <Swap key="dead">
                  <div className="mt-2 text-[26px] leading-tight font-semibold tracking-tight">
                    Nothing works yet
                  </div>
                  <div className="mt-0.5 text-[15px] text-muted-foreground">
                    Someone's limits rule out every plan. Nobody finds out whose.
                  </div>
                  <div className="mt-4 flex items-center gap-2 rounded-2xl bg-destructive/8 px-3 py-2 text-[14px]">
                    <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-destructive" />
                    Waiting for someone to loosen a limit
                  </div>
                </Swap>
              ) : (
                <Swap key={top.option.key}>
                  <div className="mt-2 text-[26px] leading-tight font-semibold tracking-tight">
                    {top.option.title}
                  </div>
                  <div className="mt-0.5 text-[15px] text-muted-foreground">
                    {top.option.subtitle}
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <Fact icon={Wallet} label="Each">
                      ${cost.perPersonMin}–{cost.perPersonMax}
                    </Fact>
                    <Fact icon={Clock} label="When">
                      {clockRange(top.option.start, top.option.end)}
                    </Fact>
                    <Fact icon={MapPin} label="Away">
                      {top.option.travelMinutes} min
                    </Fact>
                  </div>
                </Swap>
              )}
            </AnimatePresence>
            {!deadEnd && (
              <div className="mt-4 grid grid-cols-[1fr_1fr_auto] items-end gap-4">
                <Bar label="Fits what people like" value={top.breakdown.overallFit} />
                <Bar label="Fair to everyone" value={top.breakdown.fairness} />
                <MatchRing value={top.score} />
              </div>
            )}
          </div>
          <AnimatePresence initial={false}>
            {b.note && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: EASE }}
                className="overflow-hidden"
              >
                <div className="mt-4 flex items-center gap-2 rounded-2xl bg-primary/8 px-3 py-2 text-[14px]">
                  <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                  <span>
                    <span className="font-semibold">New top pick.</span> {b.note}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Stage>
      <motion.div
        style={{ opacity: orbOpacity }}
        className="pointer-events-none absolute inset-0 grid place-items-center"
      >
        <div className="flex flex-col items-center gap-3 text-[15px] text-muted-foreground">
          <ThinkingOrb state="solving" size={64} paused={!orbOn} aria-hidden="true" />
          <span>Ranking plans for 4 people…</span>
        </div>
      </motion.div>
    </div>
  );

  // The list's card lands just ahead of its rows, so no empty shell shows.
  const others = (
    <Stage {...stage([0.38, 0.6], 0, 16)}>
      <ul className="rounded-[22px] border border-border bg-card px-5">
        {ranked.slice(1, portrait ? 3 : 4).map((r, i) => (
          <motion.li
            key={r.option.key}
            layout={reduce ? false : "position"}
            transition={{ type: "spring", duration: 0.5, bounce: 0.15 }}
            className="border-t border-border first:border-t-0"
          >
            <Stage {...stage([0.42 + i * 0.05, 0.66 + i * 0.05], 0, 16)}>
              <motion.div
                animate={{ opacity: r.feasible ? 1 : 0.5 }}
                transition={{ duration: 0.4, ease: EASE }}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-[15px] font-medium">{r.option.title}</div>
                  <div className="text-[13px] text-muted-foreground tabular-nums">
                    ${r.option.costMin}–{r.option.costMax} ·{" "}
                    {clockRange(r.option.start, r.option.end)}
                  </div>
                </div>
                <AnimatePresence mode="popLayout" initial={false}>
                  <Swap key={String(r.feasible)}>
                    {r.feasible ? (
                      <LivePill tone="good">
                        <Check className="size-3.5" /> Works
                      </LivePill>
                    ) : (
                      <LivePill tone="bad">
                        <X className="size-3.5" /> Not for all
                      </LivePill>
                    )}
                  </Swap>
                </AnimatePresence>
              </motion.div>
            </Stage>
          </motion.li>
        ))}
      </ul>
    </Stage>
  );

  return (
    <div ref={frameRef} aria-hidden className="absolute inset-0 overflow-hidden">
      <div
        ref={canvasRef}
        style={{ width: size.w, height: size.h }}
        className="bg-background text-foreground paper-field absolute top-0 left-0 origin-top-left"
      >
        <Stage {...stage([0.06, 0.22], 0, -6)}>
          <div className="flex h-14 items-center justify-between border-b border-border px-6">
            <Wordmark size="sm" />
            <Presence
              typing={b.typing}
              status={
                b.typing
                  ? `${DEMO_GROUP.find((m) => m.id === b.typing)?.name} is answering…`
                  : b.reranking
                    ? `Re-checking ${DEMO_POOL.length} plans…`
                    : deadEnd
                      ? "No plan fits all 4"
                      : "4 answered"
              }
            />
          </div>
        </Stage>

        {portrait ? (
          <div className="space-y-3 px-6 pt-5">
            <Stage {...stage([0.1, 0.32], -12, 0)}>
              <PlanHeader />
            </Stage>
            {members}
            {topCard}
            {others}
          </div>
        ) : (
          <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-6 px-6 pt-6">
            <div className="space-y-4">
              <Stage {...stage([0.1, 0.32], -12, 0)}>
                <PlanHeader />
              </Stage>
              {members}
              <Stage {...stage([0.26, 0.5], -12, 0)}>
                <p className="flex items-start gap-2 text-[13px] leading-snug text-muted-foreground">
                  <Lock className="mt-0.5 size-3.5 shrink-0" />
                  Answers stay private. The group only sees what works.
                </p>
              </Stage>
            </div>
            <div className="space-y-3">
              {topCard}
              {others}
            </div>
          </div>
        )}
        {flight && !reduce && <Packet key={flight.id} {...flight} />}
      </div>
    </div>
  );
}

function PlanHeader() {
  return (
    <div>
      <div className="text-[13px] text-muted-foreground">Fri · after school</div>
      <div className="text-[24px] leading-tight font-semibold tracking-tight">Friday hangout</div>
    </div>
  );
}

/** One friend: they're in, and their answers are sealed. */
function MemberRow({
  member,
  typing,
  liRef,
}: {
  member: DemoMember;
  typing: boolean;
  liRef: (el: HTMLElement | null) => void;
}) {
  return (
    <li
      ref={liRef}
      className={cn(
        "relative flex h-14 items-center gap-3 overflow-hidden rounded-2xl border bg-card px-3 transition-colors duration-300",
        typing ? "scale-[1.02] border-primary/50 shadow-lg shadow-primary/15" : "border-border",
      )}
    >
      {typing && <span aria-hidden className="live-scan absolute inset-x-0 bottom-0 h-px" />}
      <span className="relative grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-[17px]">
        {member.emoji}
        {typing && <span className="live-ring absolute inset-0 rounded-full" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] leading-tight font-semibold">{member.name}</span>
        <span className="relative block h-4 text-[12px] leading-4 text-muted-foreground">
          <AnimatePresence mode="popLayout" initial={false}>
            {typing ? (
              <Swap key="t" className="flex items-center gap-1 text-primary">
                Answering privately
                <Dots />
              </Swap>
            ) : (
              <Swap key="d">Answered</Swap>
            )}
          </AnimatePresence>
        </span>
      </span>
      <span
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-full transition-colors duration-300",
          typing ? "bg-primary/12 text-primary" : "bg-success/15 text-success",
        )}
      >
        <SealPop key={String(typing)}>
          {typing ? <Lock className="size-3.5" /> : <Check className="size-3.5" />}
        </SealPop>
      </span>
    </li>
  );
}

/** The badge snaps in whenever a row's state flips: sealed, then settled. */
function SealPop({ children }: { children: ReactNode }) {
  return (
    <motion.span
      initial={{ transform: "scale(0.4)", opacity: 0 }}
      animate={{ transform: "scale(1)", opacity: 1 }}
      transition={{ type: "spring", stiffness: 560, damping: 15 }}
      className="grid place-items-center"
    >
      {children}
    </motion.span>
  );
}

/** The upright layout's version: four across, status under the name. */
function MemberTile({
  member,
  typing,
  liRef,
}: {
  member: DemoMember;
  typing: boolean;
  liRef: (el: HTMLElement | null) => void;
}) {
  return (
    <li
      ref={liRef}
      className={cn(
        "relative flex flex-col items-center overflow-hidden rounded-2xl border bg-card px-1 pt-3 pb-2 transition-colors duration-300",
        typing ? "scale-[1.04] border-primary/50 shadow-lg shadow-primary/15" : "border-border",
      )}
    >
      {typing && <span aria-hidden className="live-scan absolute inset-x-0 bottom-0 h-px" />}
      <span className="relative grid size-9 place-items-center rounded-full bg-secondary text-[17px]">
        {member.emoji}
        {typing && <span className="live-ring absolute inset-0 rounded-full" />}
      </span>
      <span className="mt-1.5 text-[14px] leading-tight font-semibold">{member.name}</span>
      <span className="relative mt-0.5 flex h-5 items-center text-[12px] text-muted-foreground">
        <AnimatePresence mode="popLayout" initial={false}>
          {typing ? (
            <Swap key="t" className="flex items-center gap-1 text-primary">
              <Lock className="size-3" />
              <Dots />
            </Swap>
          ) : (
            <Swap key="d" className="flex items-center gap-1">
              <Check className="size-3.5 text-success" />
              Answered
            </Swap>
          )}
        </AnimatePresence>
      </span>
    </li>
  );
}

function Dots() {
  return (
    <span className="flex gap-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="animate-typing-dot size-1 rounded-full bg-current"
          style={{ animationDelay: `${i * 140}ms` }}
        />
      ))}
    </span>
  );
}

/** Avatars in the app bar, each with a live dot; the one answering pulses. */
function Presence({ typing, status }: { typing?: string; status: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="relative block h-5 min-w-[150px] text-right text-[13px] leading-5 text-muted-foreground">
        <AnimatePresence mode="popLayout" initial={false}>
          <Swap key={status} className={typing ? "text-primary" : undefined}>
            {status}
          </Swap>
        </AnimatePresence>
      </span>
      <div className="flex -space-x-2">
        {DEMO_GROUP.map((m) => (
          <span
            key={m.id}
            className="relative grid size-8 place-items-center rounded-full border-2 border-background bg-secondary text-[14px]"
          >
            {m.emoji}
            <span className="live-breathe absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-background bg-success" />
            {typing === m.id && <span className="live-ring absolute inset-0 rounded-full" />}
          </span>
        ))}
      </div>
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
    <div className="rounded-2xl bg-secondary/70 px-3 py-2">
      <div className="flex items-center gap-1 text-[12px] text-muted-foreground">
        <Icon className="size-3" /> {label}
      </div>
      <div className="mt-0.5 text-[15px] font-semibold whitespace-nowrap tabular-nums">
        {children}
      </div>
    </div>
  );
}

/** A meter that fills from the left: scaleX, not width, so it stays on the GPU. */
function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-[12px] text-muted-foreground">
        <span>{label}</span>
        <Count value={value} suffix="%" className="tabular-nums" />
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full origin-left rounded-full bg-primary transition-transform duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]"
          style={{ transform: `scaleX(${value / 100})` }}
        />
      </div>
    </div>
  );
}

/** The match score as a ring that sweeps to its value while the number counts. */
function MatchRing({ value }: { value: number }) {
  const R = 25;
  const C = 2 * Math.PI * R;
  return (
    <div className="relative size-[62px] shrink-0">
      <svg viewBox="0 0 62 62" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="31" cy="31" r={R} fill="none" strokeWidth="4" className="stroke-secondary" />
        <motion.circle
          cx="31"
          cy="31"
          r={R}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          className="stroke-primary"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C * (1 - value / 100) }}
          transition={{ type: "spring", duration: 0.9, bounce: 0.12 }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center leading-none">
        <span>
          <Count value={value} className="block text-[20px] font-semibold" />
          <span className="text-[10px] text-muted-foreground">match</span>
        </span>
      </div>
    </div>
  );
}

/** A sealed answer in flight: a bright head and a short fading trail. */
function Packet({ x0, y0, x1, y1 }: { x0: number; y0: number; x1: number; y1: number }) {
  const mid = (y0 + y1) / 2 - 42;
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <motion.span
          key={i}
          aria-hidden
          className="pointer-events-none absolute top-0 left-0 z-20"
          initial={{ opacity: 0, transform: `translateX(${x0}px)` }}
          animate={{
            opacity: [0, 1 - i * 0.24, 1 - i * 0.24, 0],
            transform: `translateX(${x1}px)`,
          }}
          transition={{
            duration: 0.72,
            delay: i * 0.05,
            ease: [0.45, 0, 0.2, 1],
            opacity: { times: [0, 0.12, 0.8, 1], duration: 0.72, delay: i * 0.05 },
          }}
        >
          <motion.span
            className="block"
            initial={{ transform: `translateY(${y0}px)` }}
            animate={{
              transform: [`translateY(${y0}px)`, `translateY(${mid}px)`, `translateY(${y1}px)`],
            }}
            transition={{ duration: 0.72, delay: i * 0.05, ease: ["easeOut", "easeIn"] }}
          >
            <span
              className="block -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary"
              style={{
                width: 13 - i * 2.5,
                height: 13 - i * 2.5,
                boxShadow:
                  i === 0
                    ? "0 0 18px 5px color-mix(in oklab, var(--primary) 65%, transparent)"
                    : undefined,
              }}
            />
          </motion.span>
        </motion.span>
      ))}
    </>
  );
}

/** A number that counts to its new value instead of jumping. */
function Count({
  value,
  suffix = "",
  className,
}: {
  value: number;
  suffix?: string;
  className?: string;
}) {
  const mv = useMotionValue(value);
  const text = useTransform(() => `${Math.round(mv.get())}${suffix}`);
  useEffect(() => {
    const c = animate(mv, value, { duration: 0.7, ease: EASE });
    return () => c.stop();
  }, [mv, value]);
  return <motion.span className={cn("tabular-nums", className)}>{text}</motion.span>;
}

function LivePill({ tone, children }: { tone: "good" | "bad"; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-medium whitespace-nowrap",
        tone === "good" ? "bg-success/15 text-success" : "bg-destructive/12 text-destructive",
      )}
    >
      {children}
    </span>
  );
}

function Swap({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.span
      initial={{ opacity: 0, transform: "translateY(6px)", filter: "blur(4px)" }}
      animate={{ opacity: 1, transform: "translateY(0px)", filter: "blur(0px)" }}
      exit={{ opacity: 0, transform: "translateY(-6px)", filter: "blur(4px)" }}
      transition={{ duration: 0.3, ease: EASE }}
      className={cn("block", className)}
    >
      {children}
    </motion.span>
  );
}

/** One piece of the screen, landing on the scroll timeline from (x, y) px. */
function Stage({
  progress,
  at: [a, b],
  x,
  y,
  reduce,
  children,
}: {
  progress: MotionValue<number>;
  at: [number, number];
  x: number;
  y: number;
  reduce: boolean;
  children: ReactNode;
}) {
  const t = useTransform(() => (reduce ? 1 : seg(progress.get(), a, b)));
  const transform = useTransform(() => {
    const rest = 1 - t.get();
    return `translate3d(${(x * rest).toFixed(2)}px,${(y * rest).toFixed(2)}px,0)`;
  });
  return (
    <motion.div className="hero-stage" style={{ opacity: t, transform }}>
      {children}
    </motion.div>
  );
}
