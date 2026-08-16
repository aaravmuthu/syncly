import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, Skeleton } from "./ui";
import { getAvailabilityHeatmap, getPlanWeather } from "@/lib/quorum/insight.functions";
import { bestWindow, densityTone, prettySlot } from "@/lib/quorum/availability";
import { forecastSummary } from "@/lib/quorum/weather";

export function WeatherCard({ planId }: { planId: string }) {
  const fetchWeather = useServerFn(getPlanWeather);
  const q = useQuery({
    queryKey: ["plan-weather", planId],
    queryFn: () => fetchWeather({ data: { planId } }),
    staleTime: 30 * 60_000,
  });

  if (q.isLoading) return <Skeleton className="h-20 rounded-3xl" />;
  const f = q.data;
  if (!f) return null;

  return (
    <Card className={`p-4 ${f.alert ? "ring-1 ring-destructive/30" : ""}`}>
      <div className="flex items-center gap-3">
        <span className="text-2xl leading-none">{f.emoji}</span>
        <div className="min-w-0">
          <p className="text-sm font-medium">{forecastSummary(f)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {f.alert
              ? `${f.alertText} — indoor options are ranked higher.`
              : `Forecast for ${new Date(`${f.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}.`}
          </p>
        </div>
      </div>
    </Card>
  );
}

export function AvailabilityHeatmap({ planId }: { planId: string }) {
  const fetchGrid = useServerFn(getAvailabilityHeatmap);
  const q = useQuery({
    queryKey: ["plan-heatmap", planId],
    queryFn: () => fetchGrid({ data: { planId } }),
  });

  if (q.isLoading) return <Skeleton className="h-32 rounded-3xl" />;
  const grid = q.data;
  if (!grid || grid.answered === 0) return null;
  const win = bestWindow(grid.cells);

  return (
    <Card className="p-4">
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
                style={{ backgroundColor: `color-mix(in oklab, var(--color-primary) ${Math.round(tone * 100)}%, transparent)` }}
                title={`${c.free} of ${c.total} free at ${prettySlot(c.slot)}`}
              />
              <span className="mt-1 block text-[10px] text-muted-foreground">{prettySlot(c.slot)}</span>
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
    </Card>
  );
}
