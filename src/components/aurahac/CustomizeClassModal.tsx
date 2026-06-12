import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useHac } from "@/lib/hac/store";
import type { Course } from "@/lib/hac/types";
import { GRADIENT_PRESETS, EMOJI_CHOICES, courseDisplay, guessCourseEmoji } from "@/lib/hac/customize";
import { X, Check } from "lucide-react";

export function CustomizeClassModal({ course, onClose }: { course: Course; onClose: () => void }) {
  const { courseCustom, setCourseCustom } = useHac();
  const existing = courseCustom[course.id] ?? {};
  const [alias, setAlias] = useState(existing.alias ?? "");
  const [emoji, setEmoji] = useState<string | null>(existing.emoji ?? null);
  const [gradient, setGradient] = useState<string | null>(existing.gradient ?? null);

  const preview = courseDisplay(course, { alias, emoji: emoji ?? undefined, gradient });

  function save() {
    setCourseCustom(course.id, {
      alias: alias.trim() || undefined,
      emoji: emoji ?? undefined,
      gradient: gradient,
    });
    onClose();
  }

  function reset() {
    setAlias("");
    setEmoji(null);
    setGradient(null);
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <motion.div
          initial={{ y: 40, opacity: 0, scale: 0.98 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
          className="glass relative w-full sm:max-w-md max-h-[88dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 space-y-5"
          style={{ backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Customize Class</h2>
            <button onClick={onClose} className="h-8 w-8 grid place-items-center rounded-full liquid">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Live preview */}
          <div
            className="rounded-2xl p-4 flex items-center gap-3"
            style={{ background: preview.gradient ?? "color-mix(in oklab, var(--primary) 14%, transparent)" }}
          >
            <div className="h-11 w-11 rounded-xl grid place-items-center text-2xl bg-white/15">
              {preview.emoji ?? guessCourseEmoji(course.name)}
            </div>
            <div className="min-w-0">
              <div className="text-base font-bold truncate text-white">{preview.name}</div>
              <div className="text-[11px] truncate text-white/70">{course.name}</div>
            </div>
          </div>

          {/* Alias */}
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Class Name</label>
            <input
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder={course.name}
              maxLength={40}
              className="w-full liquid rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 ring-primary/40"
            />
          </div>

          {/* Emoji */}
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Icon</label>
            <div className="grid grid-cols-8 gap-1.5">
              <button
                onClick={() => setEmoji(null)}
                className={`h-9 rounded-lg grid place-items-center text-xs liquid ${emoji === null ? "ring-2 ring-primary" : ""}`}
              >
                —
              </button>
              {EMOJI_CHOICES.map((e) => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  className={`h-9 rounded-lg grid place-items-center text-lg liquid ${emoji === e ? "ring-2 ring-primary" : ""}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Gradient */}
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Color</label>
            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => setGradient(null)}
                className={`h-12 rounded-xl liquid grid place-items-center text-[11px] ${gradient === null ? "ring-2 ring-primary" : ""}`}
              >
                Default
              </button>
              {GRADIENT_PRESETS.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setGradient(g.id)}
                  className={`h-12 rounded-xl relative overflow-hidden ${gradient === g.id ? "ring-2 ring-white" : ""}`}
                  style={{ background: g.css }}
                >
                  {gradient === g.id ? (
                    <Check className="h-4 w-4 text-white absolute inset-0 m-auto drop-shadow" />
                  ) : null}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={reset}
              className="flex-1 liquid rounded-xl py-3 text-sm font-semibold"
            >
              Reset
            </button>
            <button
              onClick={save}
              className="flex-[2] rounded-xl py-3 text-sm font-bold text-white"
              style={{ background: "linear-gradient(135deg,var(--primary),var(--chart-2))" }}
            >
              Save Customization
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
