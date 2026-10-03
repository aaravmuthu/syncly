import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/quorum/ui";
import { haptic } from "@/lib/quorum/haptics";
import { DEMO_GROUP, type DemoMember } from "@/lib/quorum/demo-group";
import { EASE_OUT } from "./shared";

export type Identity = { name: string; emoji: string };

const STORAGE_KEY = "syncly-demo-squad-v1";
const EMOJIS = ["🌿", "🎧", "📚", "🏀", "🎨", "🍜", "🎮", "🌅", "🧋", "🛹", "🎸", "🦊"];

export const SAMPLE_SQUAD: Identity[] = DEMO_GROUP.map(({ name, emoji }) => ({ name, emoji }));

export function loadSquad(): Identity[] | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Identity[];
    if (!Array.isArray(parsed) || parsed.length !== DEMO_GROUP.length) return null;
    return parsed.map((p, i) => ({
      name: String(p.name ?? "").slice(0, 12) || SAMPLE_SQUAD[i]!.name,
      emoji: EMOJIS.includes(p.emoji) ? p.emoji : SAMPLE_SQUAD[i]!.emoji,
    }));
  } catch {
    return null;
  }
}

function saveSquad(squad: Identity[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(squad));
  } catch {
    /* private mode or blocked storage: the demo works the same without it */
  }
}

export function applyIdentities(squad: Identity[]): DemoMember[] {
  return DEMO_GROUP.map((m, i) => ({ ...m, name: squad[i]!.name, emoji: squad[i]!.emoji }));
}

export function SquadSetup({
  initial,
  onStart,
}: {
  initial: Identity[];
  onStart: (squad: Identity[]) => void;
}) {
  const reduce = useReducedMotion();
  const [squad, setSquad] = useState<Identity[]>(initial);

  const set = (i: number, patch: Partial<Identity>) =>
    setSquad((prev) => prev.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  const cycleEmoji = (i: number) => {
    haptic("select");
    const at = EMOJIS.indexOf(squad[i]!.emoji);
    set(i, { emoji: EMOJIS[(at + 1) % EMOJIS.length]! });
  };

  const start = (chosen: Identity[]) => {
    const cleaned = chosen.map((p, i) => ({
      name: p.name.trim().slice(0, 12) || SAMPLE_SQUAD[i]!.name,
      emoji: p.emoji,
    }));
    saveSquad(cleaned);
    haptic("tap");
    onStart(cleaned);
  };

  return (
    <Card as="section" className="mx-auto max-w-xl p-5 sm:p-7">
      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Who's going out?</h2>
      <p className="mt-1.5 text-base text-pretty text-muted-foreground">
        Name your four. Everything in the demo is about them, and it stays on this device.
      </p>

      <form
        className="mt-5"
        onSubmit={(e) => {
          e.preventDefault();
          start(squad);
        }}
      >
        <ul className="space-y-2.5">
          {squad.map((p, i) => (
            <motion.li
              key={i}
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 * i, duration: 0.4, ease: EASE_OUT }}
              className="flex items-center gap-3"
            >
              <button
                type="button"
                onClick={() => cycleEmoji(i)}
                aria-label={`Change emoji for friend ${i + 1}`}
                className="pressable active:pressable-active grid size-12 shrink-0 place-items-center rounded-2xl bg-secondary text-2xl"
              >
                <motion.span
                  key={p.emoji}
                  initial={reduce ? false : { scale: 0.6, rotate: -12 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 18 }}
                >
                  {p.emoji}
                </motion.span>
              </button>
              <label className="min-w-0 flex-1">
                <span className="sr-only">Name of friend {i + 1}</span>
                <input
                  value={p.name}
                  onChange={(e) => set(i, { name: e.target.value })}
                  maxLength={12}
                  autoComplete="off"
                  placeholder={SAMPLE_SQUAD[i]!.name}
                  className="min-h-12 w-full rounded-2xl border border-border bg-card px-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                />
              </label>
            </motion.li>
          ))}
        </ul>

        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row-reverse">
          <button
            type="submit"
            className="pressable active:pressable-active inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-6 text-base font-semibold text-primary-foreground hover:opacity-92"
          >
            Show me what happens <ArrowRight className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => start(SAMPLE_SQUAD)}
            className="tap-target inline-flex items-center justify-center rounded-full px-4 text-sm text-muted-foreground hover:text-foreground"
          >
            Use the sample squad
          </button>
        </div>
      </form>
    </Card>
  );
}
