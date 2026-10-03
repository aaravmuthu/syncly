import { useEffect, useMemo, useState } from "react";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check, Lock, X } from "lucide-react";
import { Card, Pill } from "@/components/quorum/ui";
import { rankOptions } from "@/lib/quorum/engine";
import type { DemoMember } from "@/lib/quorum/demo-group";
import type { OptionSeed } from "@/lib/quorum/types";
import { BLOCKER_LABEL, blockersOf, inputsOf } from "@/lib/quorum/demo-ai";
import { clockRange, EASE_OUT, joinNames, SPRING } from "./shared";

/*
 * The scripted intro. It plays the engine's actual run: private answers come
 * in locked, every option is checked against all of them, the ones that break
 * a limit drop out (labelled by the kind of limit, never the person), and the
 * best of what's left lands. Nothing here is faked: the order and the labels
 * come from the same rankOptions call the rest of the page uses.
 */
export function EngineReveal({
  members,
  pool,
  onDone,
}: {
  members: DemoMember[];
  pool: OptionSeed[];
  onDone: () => void;
}) {
  const reduce = useReducedMotion();
  const ranked = useMemo(() => rankOptions(pool, inputsOf(members)), [pool, members]);
  const byKey = useMemo(() => new Map(ranked.map((r) => [r.option.key, r])), [ranked]);
  const out = useMemo(() => ranked.filter((r) => !r.feasible), [ranked]);
  const winner = ranked.find((r) => r.feasible);

  // 0 answers, 1 options, 2 knocking out, 3 survivors sorted, 4 winner
  const [phase, setPhase] = useState(reduce ? 4 : 0);
  const [knocked, setKnocked] = useState(reduce ? out.length : 0);

  useEffect(() => {
    if (reduce) return;
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    at(1300, () => setPhase(1));
    at(2000, () => setPhase(2));
    out.forEach((_, i) => at(2100 + i * 240, () => setKnocked(i + 1)));
    const tEnd = 2100 + out.length * 240;
    at(tEnd + 350, () => setPhase(3));
    at(tEnd + 1050, () => setPhase(4));
    return () => timers.forEach(window.clearTimeout);
  }, [reduce, out]);

  const finish = () => {
    setPhase(4);
    setKnocked(out.length);
  };
  const done = phase >= 4;

  // Catalog order while it's being judged, then survivors rise.
  const order = phase >= 3 ? ranked.map((r) => r.option) : pool;
  const knockedKeys = new Set(out.slice(0, knocked).map((r) => r.option.key));

  return (
    <Card as="section" className="mx-auto max-w-3xl p-5 sm:p-7">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {done
              ? winner
                ? "One plan survives all four"
                : "Nothing survives all four"
              : "Watch it work"}
          </h2>
          <p className="mt-1 min-h-6 text-base text-muted-foreground">
            {phase === 0 && "Each of them answers privately. Nobody sees anybody else's."}
            {phase === 1 && `${pool.length} options go up against every one of those answers.`}
            {phase === 2 && "Anything that breaks someone's limit is out. Whose? Nobody finds out."}
            {phase === 3 && "What's left, ranked by how fair it is."}
            {phase >= 4 &&
              winner &&
              `Works for ${joinNames(members.map((m) => m.name))}, with no one quietly giving up.`}
          </p>
        </div>
        {!done && (
          <button
            type="button"
            onClick={finish}
            className="tap-target -mt-1 shrink-0 rounded-full px-3 text-sm text-muted-foreground hover:text-foreground"
          >
            Skip
          </button>
        )}
      </div>

      <ul className="mt-5 flex flex-wrap gap-2" aria-label="Private answers">
        {members.map((m, i) => (
          <motion.li
            key={m.id}
            initial={reduce ? false : { opacity: 0, y: 14, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: reduce ? 0 : 0.2 + i * 0.22, ...SPRING }}
            className="flex items-center gap-2 rounded-full bg-secondary py-1.5 pr-3.5 pl-2 text-sm"
          >
            <span className="grid size-8 place-items-center rounded-full bg-card text-base">
              {m.emoji}
            </span>
            <span className="font-medium">{m.name}</span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="size-3" aria-hidden /> private
            </span>
          </motion.li>
        ))}
      </ul>

      <LayoutGroup>
        <ul className="mt-5 grid gap-2 sm:grid-cols-2">
          {order.map((o, i) => {
            const r = byKey.get(o.key)!;
            const isOut = knockedKeys.has(o.key);
            const isWinner = done && winner?.option.key === o.key;
            const kinds = blockersOf(r);
            return (
              <motion.li
                key={o.key}
                layout={reduce ? false : "position"}
                initial={reduce ? false : { opacity: 0, scale: 0.94 }}
                animate={{
                  opacity: phase < 1 ? 0 : isOut ? (phase >= 3 ? 0.4 : 0.55) : 1,
                  scale: isWinner ? 1.02 : 1,
                  x: isOut && !reduce && phase < 3 ? [0, -5, 4, 0] : 0,
                }}
                transition={{
                  layout: { type: "spring", stiffness: 380, damping: 34 },
                  opacity: { duration: 0.3 },
                  scale: { type: "spring", stiffness: 380, damping: 22 },
                  x: { duration: 0.32, ease: EASE_OUT },
                }}
                className={
                  isWinner
                    ? "flex items-center justify-between gap-3 rounded-2xl bg-primary/12 px-3.5 py-2.5 ring-1 ring-primary/50"
                    : "flex items-center justify-between gap-3 rounded-2xl bg-secondary/60 px-3.5 py-2.5"
                }
              >
                <div className="min-w-0">
                  <div
                    className={
                      isOut
                        ? "truncate text-[0.9375rem] font-medium text-muted-foreground line-through decoration-destructive/60"
                        : "truncate text-[0.9375rem] font-medium"
                    }
                  >
                    {o.title}
                  </div>
                  <div className="truncate text-xs text-muted-foreground tabular-nums">
                    ${o.costMin}–{o.costMax} · {clockRange(o.start, o.end)}
                  </div>
                </div>
                <div className="shrink-0">
                  {isOut ? (
                    <Pill tone="bad">
                      <X className="size-3" />
                      {kinds[0] ? BLOCKER_LABEL[kinds[0]] : "Out"}
                      {kinds.length > 1 ? ` +${kinds.length - 1}` : ""}
                    </Pill>
                  ) : isWinner ? (
                    <Pill tone="good">
                      <Check className="size-3" /> Top pick
                    </Pill>
                  ) : phase >= 3 ? (
                    <Pill tone="good">
                      <Check className="size-3" /> Works
                    </Pill>
                  ) : null}
                </div>
              </motion.li>
            );
          })}
        </ul>
      </LayoutGroup>

      <motion.div
        initial={false}
        animate={{ opacity: done ? 1 : 0, y: done ? 0 : 8 }}
        transition={{ duration: 0.4, ease: EASE_OUT }}
        className="mt-6"
        aria-hidden={!done}
      >
        <button
          type="button"
          tabIndex={done ? 0 : -1}
          onClick={onDone}
          className="pressable active:pressable-active inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 text-base font-semibold text-primary-foreground hover:opacity-92 sm:w-auto"
        >
          Now you try <ArrowRight className="size-4" />
        </button>
      </motion.div>
    </Card>
  );
}
