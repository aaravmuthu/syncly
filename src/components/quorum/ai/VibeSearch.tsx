import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Button, Pill } from "@/components/quorum/ui";
import { vibeSearchSpots, type VibeSearchResult, type VibeSearchSpot } from "@/lib/quorum/aiplus.functions";
import { AiGlyph } from "./AiGlyph";

const EXAMPLES = [
  "quiet patio, cheap, walkable",
  "loud and fun for eight people",
  "late-night bites after a movie",
  "rainy-day indoor hangout",
];

/**
 * Natural-language venue search. Pulls live venues near the caller's home and
 * has AI rank them against the described vibe.
 */
export function VibeSearch({
  kind = "food",
  onPick,
}: {
  kind?: "food" | "activity";
  onPick?: (spot: VibeSearchSpot) => void;
}) {
  const [query, setQuery] = useState("");
  const searchFn = useServerFn(vibeSearchSpots);
  const search = useMutation({
    mutationFn: (q: string) => searchFn({ data: { query: q, kind } }) as Promise<VibeSearchResult>,
    onError: (e: unknown) =>
      toast.error("Vibe search failed", {
        description: e instanceof Error ? e.message : "Please try again.",
      }),
  });

  const run = (q: string) => {
    const text = q.trim();
    if (!text || search.isPending) return;
    setQuery(text);
    search.mutate(text);
  };

  const result = search.data;

  return (
    <div className="rounded-3xl border border-primary/25 bg-primary/5 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <AiGlyph className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Vibe search</h3>
        <Pill tone="accent">AI</Pill>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Describe the mood, not the name. We'll match it to real spots near you.
      </p>
      <form
        className="mt-3 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(query);
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="quiet patio, cheap, walkable"
          aria-label="Describe the vibe you want"
          className="h-11 flex-1 rounded-2xl border border-border bg-background px-3.5 text-sm outline-none focus:border-primary/60"
        />
        <Button type="submit" className="h-11 px-4" loading={search.isPending} orb="searching" disabled={!query.trim()}>
          Match
        </Button>
      </form>

      {!result && !search.isPending ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => run(e)}
              className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary"
            >
              {e}
            </button>
          ))}
        </div>
      ) : null}

      {result?.needsHome ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Add your home address in Settings so we can search around you.
        </p>
      ) : null}

      <AnimatePresence initial={false}>
        {result && !result.needsHome ? (
          <motion.ul
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="mt-3 space-y-2"
          >
            {result.spots.length === 0 ? (
              <li className="text-xs text-muted-foreground">
                Nothing matched that vibe nearby — try a wider description.
              </li>
            ) : null}
            {result.spots.map((s, i) => (
              <motion.li
                key={s.key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 340, damping: 28, delay: i * 0.05 }}
              >
                <button
                  type="button"
                  onClick={() => onPick?.(s)}
                  className="w-full rounded-2xl border border-border bg-background/70 p-3 text-left transition-colors hover:bg-secondary/60"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm font-semibold">{s.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      ${s.costMin}–{s.costMax} · {s.miles} mi
                    </span>
                  </div>
                  <p className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
                    <AiGlyph className="mt-0.5 h-3 w-3 text-primary" />
                    <span>{s.reason}</span>
                  </p>
                </button>
              </motion.li>
            ))}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
