import { motion, useReducedMotion } from "motion/react";
import { Car, Vote, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/quorum/ui";
import { STOP_KINDS, timeline, to12h, type ItineraryStop } from "@/lib/quorum/itinerary";

export type StopStatus = "waiting" | "scouting" | "done";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/**
 * The night as a vertical route: one node per stop, the drive between picks
 * on the rail, and each stop's real venue options as chips. The builder
 * renders it while Sync is still scouting (stops arrive one by one, chips
 * shimmer until their venues land), then the same list turns editable, so
 * nothing jumps between "building" and "review". The plan page renders it
 * read-only.
 */
export function ItineraryTimeline({
  start,
  stops,
  anchor,
  status,
  editable = false,
  onPick,
  onRemove,
  onAnchor,
}: {
  start: string;
  stops: ItineraryStop[];
  anchor: number;
  /** Per-stop build progress; omitted once everything is found. */
  status?: Record<string, StopStatus>;
  editable?: boolean;
  onPick?: (stop: number, option: number) => void;
  onRemove?: (stop: number) => void;
  onAnchor?: (stop: number) => void;
}) {
  const reduce = useReducedMotion();
  const timed = timeline({ start, stops }).stops;

  return (
    <ol className="relative space-y-1">
      {timed.map((stop, i) => {
        const def = STOP_KINDS[stop.kind];
        const state = status?.[stop.id] ?? "done";
        const isAnchor = i === anchor;
        return (
          <motion.li
            key={stop.id}
            layout={reduce ? false : "position"}
            initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(10px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            transition={{ duration: 0.26, ease: EASE_OUT }}
            className="relative"
          >
            {i > 0 ? (
              <div className="flex items-center gap-3 py-1 pl-[1.125rem]">
                <motion.span
                  aria-hidden
                  className="h-7 w-0.5 origin-top rounded-full bg-border"
                  initial={reduce ? false : { transform: "scaleY(0)" }}
                  animate={{ transform: "scaleY(1)" }}
                  transition={{ duration: 0.3, ease: EASE_OUT }}
                />
                {stop.driveMinutes != null ? (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Car className="size-3.5" aria-hidden />
                    {stop.driveMinutes} min drive
                    {stop.driveMiles != null && stop.driveMiles >= 0.3
                      ? ` · ${stop.driveMiles} mi`
                      : ""}
                  </span>
                ) : null}
              </div>
            ) : null}

            <div className="flex gap-3">
              <span
                aria-hidden
                className={cn(
                  "relative grid size-10 shrink-0 place-items-center rounded-full border text-lg transition-colors duration-200",
                  state === "done"
                    ? "border-primary/40 bg-primary/10"
                    : "border-border bg-secondary/60",
                )}
              >
                {state === "scouting" ? (
                  // The shared AI ring, pulled in to node size: it grows out
                  // from the node's own edge instead of the glyph-scale -40%.
                  <span className="q-ai-pulse-ring text-primary" style={{ inset: "8%" }} />
                ) : null}
                <span className={cn(state === "waiting" && "opacity-45")}>{def.emoji}</span>
              </span>

              <div className="min-w-0 flex-1 pb-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium tabular-nums text-muted-foreground">
                      {to12h(stop.start)} – {to12h(stop.end)}
                    </p>
                    <p className="flex flex-wrap items-center gap-x-2 font-semibold">
                      {stop.label}
                      {isAnchor && stops.length > 1 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/12 px-2 py-0.5 text-[0.6875rem] font-semibold text-primary">
                          <Vote className="size-3" aria-hidden /> Group votes here
                        </span>
                      ) : null}
                    </p>
                  </div>
                  {editable && stops.length > 1 && onRemove ? (
                    <button
                      type="button"
                      onClick={() => onRemove(i)}
                      aria-label={`Remove ${stop.label}`}
                      className="tap-target pressable active:pressable-active -mr-2 -mt-1 grid shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      <X className="size-4" aria-hidden />
                    </button>
                  ) : null}
                </div>
                {stop.why ? (
                  <p className="mt-0.5 text-sm text-muted-foreground">{stop.why}</p>
                ) : null}

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {state !== "done" ? (
                    [0, 1, 2].map((k) => (
                      <Skeleton
                        key={k}
                        className={cn("h-9 rounded-full", k === 0 ? "w-36" : "w-28")}
                      />
                    ))
                  ) : stop.options.length ? (
                    stop.options.map((v, j) => {
                      const picked = j === stop.pick;
                      const cost = v.costMax ? `$${v.costMin}–${v.costMax}` : "Free";
                      const body = (
                        <>
                          <span className="truncate">{v.title}</span>
                          <span
                            className={cn(
                              "shrink-0 tabular-nums",
                              picked ? "text-primary" : "text-muted-foreground",
                            )}
                          >
                            {cost}
                          </span>
                        </>
                      );
                      const chip = cn(
                        "inline-flex h-9 max-w-full items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors duration-150",
                        picked
                          ? "border-primary/60 bg-primary/10 text-foreground"
                          : "border-border text-foreground/85",
                      );
                      return editable && onPick ? (
                        <motion.button
                          key={v.key}
                          type="button"
                          aria-pressed={picked}
                          onClick={() => onPick(i, j)}
                          initial={reduce ? false : { opacity: 0, transform: "scale(0.95)" }}
                          animate={{ opacity: 1, transform: "scale(1)" }}
                          transition={{
                            duration: 0.2,
                            ease: EASE_OUT,
                            delay: reduce ? 0 : j * 0.05,
                          }}
                          whileTap={reduce ? undefined : { transform: "scale(0.97)" }}
                          className={cn(chip, "pressable hover:bg-secondary")}
                        >
                          {body}
                        </motion.button>
                      ) : (
                        <span key={v.key} className={chip}>
                          {body}
                        </span>
                      );
                    })
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No {def.label.toLowerCase()} spots turned up nearby
                      {editable ? " — remove this stop or rebuild." : "."}
                    </p>
                  )}
                </div>
                {editable && onAnchor && !isAnchor && stop.options.length ? (
                  <button
                    type="button"
                    onClick={() => onAnchor(i)}
                    className="hit-slop mt-1.5 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
                  >
                    Vote on this stop instead
                  </button>
                ) : null}
              </div>
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}
