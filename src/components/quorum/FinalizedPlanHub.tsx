import { toast } from "sonner";
import { Button, Card, Pill } from "./ui";
import { downloadIcs, googleCalendarUrl, planSummaryText } from "@/lib/quorum/calendar";
import { estimateCost, formatRange } from "@/lib/quorum/cost";
import { shareOrCopy } from "@/lib/quorum/invite";
import type { ScoreBreakdown } from "@/lib/quorum/types";

export type FinalRecommendation = {
  id: string;
  title: string;
  subtitle: string | null;
  location_name: string | null;
  cost_min: number | null;
  cost_max: number | null;
  travel_minutes: number | null;
  suggested_start: string | null;
  suggested_end: string | null;
  score: number;
  breakdown: unknown;
};

const pretty = (t: string | null) => {
  if (!t) return "TBD";
  const [h, m] = t.split(":");
  const hh = Number(h);
  const ap = hh >= 12 ? "PM" : "AM";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${m ?? "00"} ${ap}`;
};

export function FinalizedPlanHub({
  planTitle,
  windowStart,
  rec,
  attendees,
  cars,
  approvalStatus,
}: {
  planTitle: string;
  windowStart: string | null;
  rec: FinalRecommendation;
  attendees: string[];
  cars: { label: string; driver: string }[];
  approvalStatus: string | null;
}) {
  const b = (rec.breakdown ?? {}) as ScoreBreakdown;
  const cost = estimateCost({
    costMin: rec.cost_min ?? 0,
    costMax: rec.cost_max ?? 0,
    travelMinutes: rec.travel_minutes ?? 0,
    distanceMiles: b.venue?.distanceMiles ?? null,
    category: "dinner",
    headcount: Math.max(attendees.length, 1),
    carCount: cars.length || undefined,
  });

  const dateLabel = windowStart
    ? new Date(windowStart).toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
      })
    : "Date to confirm";
  const when = `${dateLabel} · ${pretty(rec.suggested_start)} – ${pretty(rec.suggested_end)}`;
  const perPerson = formatRange(cost.perPersonMin, cost.perPersonMax);

  const event = {
    title: `${planTitle} — ${rec.title}`,
    description: `${rec.subtitle ?? ""}\nAbout ${perPerson} per person. Planned with Syncly.`.trim(),
    location: b.venue?.address ?? rec.location_name ?? rec.title,
    date: windowStart,
    start: rec.suggested_start,
    end: rec.suggested_end,
  };

  const summary = planSummaryText({
    planTitle,
    venue: rec.title,
    address: b.venue?.address ?? rec.location_name,
    when,
    attendees,
    cars,
    perPerson,
  });

  return (
    <Card className="mb-6 border-primary/50 ring-1 ring-primary/20">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="good">Locked in</Pill>
        <span className="text-xs text-muted-foreground">{rec.score}% group match</span>
        {approvalStatus ? (
          <Pill tone={approvalStatus === "declined" ? "bad" : approvalStatus === "pending" ? "neutral" : "warn"}>
            Parent: {approvalStatus.replace(/_/g, " ")}
          </Pill>
        ) : null}
      </div>

      <h2 className="mt-3 font-display text-xl font-semibold">{rec.title}</h2>
      <p className="text-sm text-muted-foreground">{b.venue?.address ?? rec.location_name}</p>
      <p className="mt-1 text-sm">{when}</p>

      {attendees.length ? (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Going</p>
          <p className="mt-1 text-sm">{attendees.join(", ")}</p>
        </div>
      ) : null}

      {cars.length ? (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Getting there
          </p>
          <ul className="mt-1 space-y-0.5 text-sm">
            {cars.map((c) => (
              <li key={c.label}>
                {c.label} · {c.driver} driving
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 rounded-2xl bg-secondary/60 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Estimated cost
        </p>
        <ul className="mt-2 space-y-1 text-sm">
          {cost.lines.map((l) => (
            <li key={l.label} className="flex justify-between gap-3">
              <span className="text-muted-foreground">{l.label}</span>
              <span className="tabular-nums">{l.value}</span>
            </li>
          ))}
          <li className="flex justify-between gap-3 border-t border-border pt-1 font-semibold">
            <span>Per person</span>
            <span className="tabular-nums">{perPerson}</span>
          </li>
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          Estimates only. Syncly never shows whether this fits anyone's private budget.
        </p>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <a href={googleCalendarUrl(event)} target="_blank" rel="noreferrer">
          <Button variant="outline">Google Calendar</Button>
        </a>
        <Button variant="outline" onClick={() => downloadIcs(event)}>
          Download .ics
        </Button>
        <Button
          variant="ghost"
          onClick={() =>
            void shareOrCopy({ title: planTitle, text: summary }).then((r) => {
              if (r === "copied") toast.success("Summary copied — paste it anywhere");
              if (r === "failed") toast.error("Couldn't share the summary");
            })
          }
        >
          Share summary
        </Button>
      </div>
    </Card>
  );
}
