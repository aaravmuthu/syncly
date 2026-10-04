import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { SyncAvatar, type SyncMood } from "@/components/quorum/auth/SyncAvatar";
import {
  factsFor,
  moveLabel,
  templateLine,
  type Coach,
  type CoachFacts,
  type CoachMove,
} from "@/lib/quorum/demo-coach";
import { demoCoachLine } from "@/lib/quorum/demo-coach.functions";
import type { DemoMember } from "@/lib/quorum/demo-group";
import { cn } from "@/lib/utils";

const AI_DEBOUNCE_MS = 700;
const CHEER_MS = 1800;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/** The sentence arrives word by word, each one sharpening out of a soft blur. */
function Words({ text, reduce }: { text: string; reduce: boolean | null }) {
  const words = text.split(" ");
  const step = Math.min(0.03, 0.5 / words.length);
  return (
    <>
      {words.map((word, i) => (
        <span key={i}>
          <motion.span
            className="inline-block"
            initial={reduce ? false : { opacity: 0, y: 3, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.28, delay: i * step, ease: EASE_OUT }}
          >
            {word}
          </motion.span>{" "}
        </span>
      ))}
    </>
  );
}

/**
 * The demo's companion. The suggestion itself comes from the rules engine; an
 * AI rewrites it into a friendly sentence. The engine's own line shows
 * instantly and is swapped for the AI's when it lands, so there is never a
 * spinner, and a visit that has changed nothing makes no AI call at all.
 */
export function DemoCoach({
  coach,
  members,
  youId,
  youName,
  edited,
  busy,
  onApply,
  onPick,
  onClear,
  onName,
}: {
  coach: Coach;
  members: DemoMember[];
  /** Which of the four the visitor has chosen to be, if any. */
  youId: string | null;
  /** A name the visitor typed. It never leaves the browser. */
  youName: string;
  edited: boolean;
  /** The ranking is recomputing. */
  busy: boolean;
  onApply: (move: CoachMove) => void;
  onPick: (id: string) => void;
  onClear: () => void;
  onName: (name: string) => void;
}) {
  const reduce = useReducedMotion();
  const facts = useMemo(() => factsFor(coach, members, youId), [coach, members, youId]);
  const factsKey = JSON.stringify(facts);

  const [ai, setAi] = useState<{ key: string; line: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [cheer, setCheer] = useState(false);
  const seen = useRef(new Map<string, string>());
  const cheerTimer = useRef<number>(undefined);

  useEffect(() => {
    if (!edited) return;
    const cached = seen.current.get(factsKey);
    if (cached) {
      setAi({ key: factsKey, line: cached });
      return;
    }
    let live = true;
    const timer = window.setTimeout(async () => {
      setPending(true);
      try {
        const { line } = await demoCoachLine({ data: JSON.parse(factsKey) as CoachFacts });
        if (live && line) {
          seen.current.set(factsKey, line);
          setAi({ key: factsKey, line });
        }
      } catch {
        /* the engine's own line is already on screen */
      } finally {
        if (live) setPending(false);
      }
    }, AI_DEBOUNCE_MS);
    return () => {
      live = false;
      window.clearTimeout(timer);
      setPending(false);
    };
  }, [factsKey, edited]);

  useEffect(() => () => window.clearTimeout(cheerTimer.current), []);

  const fromAi = edited && ai?.key === factsKey;
  const name = youName.trim();
  const line = fromAi ? ai.line : templateLine(facts, edited, name || undefined);
  const me = members.find((m) => m.id === youId);

  const mood: SyncMood =
    busy || pending
      ? "thinking"
      : cheer
        ? "happy"
        : coach.situation === "stuck"
          ? "alert"
          : coach.situation === "stretch"
            ? "watching"
            : "idle";

  const celebrate = () => {
    setCheer(true);
    window.clearTimeout(cheerTimer.current);
    cheerTimer.current = window.setTimeout(() => setCheer(false), CHEER_MS);
  };
  const apply = (move: CoachMove) => {
    celebrate();
    onApply(move);
  };
  const pick = (id: string) => {
    celebrate();
    onPick(id);
  };

  return (
    <section
      aria-label="Suggestion"
      className="surface flex items-start gap-3.5 p-4 sm:gap-4 sm:p-5"
    >
      <SyncAvatar mood={mood} size={64} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex min-h-5 items-center gap-2">
          <span className="text-[0.6875rem] leading-none font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            Suggestion
          </span>
          {fromAi && (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[0.625rem] leading-none font-semibold tracking-wide text-primary">
              AI
            </span>
          )}
        </div>

        <div className="mt-1.5 min-h-[3.75rem] text-[0.9375rem] leading-relaxed text-pretty">
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={line}
              aria-live="polite"
              exit={reduce ? undefined : { opacity: 0 }}
              transition={{ duration: 0.12 }}
            >
              <Words text={line} reduce={reduce} />
            </motion.p>
          </AnimatePresence>
        </div>

        {coach.moves.length > 0 && (
          <ul className="mt-2.5 flex flex-wrap gap-2">
            <AnimatePresence initial={false}>
              {coach.moves.map((move, i) => (
                <motion.li
                  key={move.id}
                  initial={reduce ? false : { opacity: 0, y: 6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                  transition={{ duration: 0.24, delay: 0.1 + i * 0.05, ease: EASE_OUT }}
                >
                  <button
                    type="button"
                    onClick={() => apply(move)}
                    className="pressable active:pressable-active tap-target inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-sm font-medium text-foreground hover:bg-secondary"
                  >
                    {moveLabel(move)}
                    <ArrowRight className="size-3.5 text-primary" aria-hidden />
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}

        <div className="mt-3.5 flex flex-wrap items-center gap-x-2.5 gap-y-2 border-t border-border pt-3">
          {me ? (
            <>
              <span className="text-sm text-muted-foreground">
                You're{" "}
                <span className="font-medium text-foreground">
                  {me.emoji} {name || me.name}
                </span>
              </span>
              <input
                aria-label="Your name"
                placeholder="Your name (optional)"
                autoComplete="off"
                maxLength={20}
                value={youName}
                onChange={(e) => onName(e.target.value.replace(/[<>]/g, ""))}
                className="h-9 w-44 rounded-full border border-border bg-background px-3.5 text-base outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
              />
              <button
                type="button"
                onClick={onClear}
                className="tap-target text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Change
              </button>
            </>
          ) : (
            <>
              <span className="basis-full text-sm text-muted-foreground">Make it about you</span>
              {members.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => pick(m.id)}
                  className={cn(
                    "pressable active:pressable-active tap-target inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-secondary",
                  )}
                >
                  <span aria-hidden>{m.emoji}</span>
                  {m.name}
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
