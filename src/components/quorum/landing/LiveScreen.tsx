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
};

// ~11s loop. Each beat's `group` is what the engine ranks during it.
const STORY: Beat[] = [
  { ms: 2600, group: DEMO_GROUP },
  { ms: 1700, group: DEMO_GROUP, typing: "m1" },
  { ms: 900, group: withHalal, reranking: true },
  { ms: 3400, group: withHalal, note: "Foxglove Cafe no longer works for everyone." },
  { ms: 1700, group: withHalal, typing: "m1" },
  { ms: 900, group: DEMO_GROUP, reranking: true },
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
            <MemberTile member={m} typing={b.typing === m.id} />
          ) : (
            <MemberRow member={m} typing={b.typing === m.id} />
          )}
        </Stage>
      ))}
    </ul>
  );

  const topCard = (
    <div className="relative">
      <Stage {...stage([0.28, 0.54], 0, 28)}>
        <div
          className={cn(
            "rounded-[22px] border bg-card p-5 transition-colors duration-500",
            b.note ? "border-primary/60" : "border-primary/25",
          )}
        >
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
            </AnimatePresence>
            <div className="mt-4 grid grid-cols-[1fr_1fr_auto] items-end gap-4">
              <Bar label="Fits what people like" value={top.breakdown.overallFit} />
              <Bar label="Fair to everyone" value={top.breakdown.fairness} />
              <div className="text-right">
                <Count value={top.score} className="block text-[30px] leading-none font-semibold" />
                <span className="text-[12px] text-muted-foreground">match</span>
              </div>
            </div>
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
              <div className="flex items-center justify-between gap-3 py-3">
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
              </div>
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
            <Presence typing={b.typing} />
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
function MemberRow({ member, typing }: { member: DemoMember; typing: boolean }) {
  return (
    <li
      className={cn(
        "flex h-14 items-center gap-3 rounded-2xl border bg-card px-3 transition-colors duration-300",
        typing ? "border-primary/40" : "border-border",
      )}
    >
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
        {typing ? <Lock className="size-3.5" /> : <Check className="size-3.5" />}
      </span>
    </li>
  );
}

/** The upright layout's version: four across, status under the name. */
function MemberTile({ member, typing }: { member: DemoMember; typing: boolean }) {
  return (
    <li
      className={cn(
        "flex flex-col items-center rounded-2xl border bg-card px-1 pt-3 pb-2 transition-colors duration-300",
        typing ? "border-primary/40" : "border-border",
      )}
    >
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
function Presence({ typing }: { typing?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[13px] text-muted-foreground">4 answered</span>
      <div className="flex -space-x-2">
        {DEMO_GROUP.map((m) => (
          <span
            key={m.id}
            className="relative grid size-8 place-items-center rounded-full border-2 border-background bg-secondary text-[14px]"
          >
            {m.emoji}
            <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-background bg-success" />
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
