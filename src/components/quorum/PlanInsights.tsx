import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown } from "lucide-react";
import { Card, Skeleton } from "./ui";
import { getAvailabilityHeatmap, getPlanWeather } from "@/lib/quorum/insight.functions";
import { bestWindow, densityTone, prettySlot } from "@/lib/quorum/availability";
import { forecastSummary } from "@/lib/quorum/weather";
import { cn } from "@/lib/utils";
import { AiActivity } from "@/components/quorum/ai/AiActivity";

function WeatherBody({ planId }: { planId: string }) {
  const fetchWeather = useServerFn(getPlanWeather);
  const q = useQuery({
    queryKey: ["plan-weather", planId],
    queryFn: () => fetchWeather({ data: { planId } }),
    staleTime: 30 * 60_000,
  });

  if (q.isLoading) return <AiActivity state="searching" label="Checking the forecast…" />;
  const f = q.data;
  if (!f) return null;

  return (
    <div className={cn("flex items-center gap-3", f.alert && "text-destructive")}>
      <span className="text-2xl leading-none">{f.currentEmoji ?? f.emoji}</span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-foreground">{forecastSummary(f)}</p>
          {f.currentTempF != null ? (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-caption font-medium text-secondary-foreground">
              Now at the spot · {f.currentTempF}°F {f.currentLabel}
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {f.alert
            ? `${f.alertText} — indoor options are ranked higher.`
            : `Forecast for ${new Date(`${f.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}.`}
        </p>
      </div>
    </div>
  );
}

function AvailabilityBody({ planId }: { planId: string }) {
  const fetchGrid = useServerFn(getAvailabilityHeatmap);
  const q = useQuery({
    queryKey: ["plan-heatmap", planId],
    queryFn: () => fetchGrid({ data: { planId } }),
  });

  if (q.isLoading)
    return (
      <AiActivity
        state="weaving"
        label="Lining up everyone's free time…"
        className="border-t border-border pt-4"
      />
    );
  const grid = q.data;
  if (!grid || grid.answered === 0) return null;
  const win = bestWindow(grid.cells);

  return (
    <div className="border-t border-border pt-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold">When the group is free</h3>
        <span className="text-xs text-muted-foreground">
          {grid.answered} of {grid.total} answered
        </span>
      </div>

      <div className="mt-3 grid grid-cols-6 gap-1.5 sm:grid-cols-12">
        {grid.cells.map((c) => {
          const tone = densityTone(c);
          return (
            <div key={c.slot} className="text-center">
              <div
                className="h-9 rounded-lg border border-border/60"
                style={{
                  backgroundColor: `color-mix(in oklab, var(--color-primary) ${Math.round(tone * 100)}%, transparent)`,
                }}
                title={`${c.free} of ${c.total} free at ${prettySlot(c.slot)}`}
              />
              <span className="mt-1 block text-caption text-muted-foreground">
                {prettySlot(c.slot)}
              </span>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        {win
          ? `Best window: ${prettySlot(win.from)}–${prettySlot(win.to)}, when ${win.free} of ${win.total} can make it.`
          : "No shared window yet."}{" "}
        Counts only — nobody sees who marked what.
      </p>
    </div>
  );
}

/**
 * Weather and group-availability are informational, not actionable — unlike
 * the conflict banner or weather guardian above it, nothing here needs a
 * decision. Folded into one collapsible card so they don't compete for
 * attention with the cards that do. Auto-expands on a weather alert since
 * that's the one case where this stops being purely informational.
 */
export function PlanInsights({ planId }: { planId: string }) {
  const [open, setOpen] = useState(false);
  const fetchWeather = useServerFn(getPlanWeather);
  const weatherQuery = useQuery({
    queryKey: ["plan-weather", planId],
    queryFn: () => fetchWeather({ data: { planId } }),
    staleTime: 30 * 60_000,
  });
  const hasAlert = Boolean(weatherQuery.data?.alert);
  const expanded = open || hasAlert;

  return (
    <Card className="p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={expanded}
        aria-controls="plan-insights-panel"
        className="hit-slop flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="flex items-center gap-2">
          <span className="text-lg leading-none" aria-hidden>
            {weatherQuery.data?.currentEmoji ?? weatherQuery.data?.emoji ?? "📊"}
          </span>
          <span className="text-sm font-semibold">Plan insights</span>
          {hasAlert ? (
            <span className="rounded-full bg-destructive/12 px-2 py-0.5 text-caption font-medium text-destructive">
              Weather alert
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {expanded ? (
        <div id="plan-insights-panel" className="mt-4 space-y-4">
          <WeatherBody planId={planId} />
          <AvailabilityBody planId={planId} />
        </div>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">
          Weather forecast and group availability
        </p>
      )}
    </Card>
  );
}
