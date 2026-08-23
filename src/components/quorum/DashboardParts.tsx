import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Avatar } from "./Avatar";
import { Button } from "./ui";
import { cn } from "@/lib/utils";
import { getMapToken } from "@/lib/quorum/location.functions";
import { getPlanWeather } from "@/lib/quorum/insight.functions";
import { describeWeather } from "@/lib/quorum/weather";
import { estCostLabel } from "@/lib/quorum/estcost";

export type DashParticipant = {
  profile_id: string;
  responded: boolean;
  name: string;
  emoji: string | null;
  avatar_url: string | null;
};

export type DashPlan = {
  id: string;
  title: string;
  status: string;
  category: string;
  window_start: string | null;
  window_end: string | null;
  location_area: string | null;
  compatibility_score: number | null;
  est_cost_min: number | null;
  est_cost_max: number | null;
  created_at: string;
  groups: { id?: string; name?: string; emoji?: string } | null;
  participants: DashParticipant[];
  responded_count: number;
  participant_count: number;
  vote_count: number;
  i_responded: boolean;
  i_attending?: boolean | null;
  i_voted: boolean;
  selected_recommendation: {
    id: string;
    title: string;
    location_name: string | null;
    address: string | null;
    lat: number | null;
    lon: number | null;
    suggested_start: string | null;
  } | null;
  conflicts?: { id: string; kind: string; detail: string | null }[];
  alternatives?: {
    id: string;
    title: string;
    subtitle: string | null;
    cost_min: number | null;
    cost_max: number | null;
    suggested_start: string | null;
    tags: string[];
  }[];
  original_option?: { id: string; title: string } | null;
};

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

export function Glass({
  children,
  className,
  interactive = false,
}: {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  return (
    <div
      className={cn(
        "glass-card p-4",
        interactive && "pressable hover:border-foreground/25",
        className,
      )}
    >
      {children}
    </div>
  );
}

const TONES: Record<string, string> = {
  voting: "bg-emerald-400/12 text-emerald-500 ring-emerald-400/25",
  collecting: "bg-amber-400/12 text-amber-500 ring-amber-400/25",
  finalized: "bg-indigo-400/14 text-indigo-400 ring-indigo-400/25",
  draft: "bg-foreground/8 text-muted-foreground ring-foreground/12",
};

/** Creator's up-front "bring this much money" badge. */
export function CostBadge({
  min,
  max,
  className,
}: {
  min: number | null | undefined;
  max: number | null | undefined;
  className?: string;
}) {
  const label = estCostLabel(min, max);
  if (!label) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-lg bg-emerald-400/12 px-2 py-0.5 text-[11px] font-semibold text-emerald-500 ring-1 ring-emerald-400/25",
        className,
      )}
    >
      {label}
    </span>
  );
}

export function StatusTag({ status, label }: { status: string; label?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ring-1",
        TONES[status] ?? TONES["draft"],
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label ?? statusLabel(status)}
    </span>
  );
}

export function statusLabel(status: string) {
  if (status === "voting") return "Voting open";
  if (status === "collecting") return "Collecting answers";
  if (status === "finalized") return "Confirmed";
  return "Draft";
}

export function AvatarStack({ people, max = 4 }: { people: DashParticipant[]; max?: number }) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <div className="flex items-center">
      {shown.map((p) => (
        <Avatar
          key={p.profile_id}
          url={p.avatar_url}
          emoji={p.emoji}
          name={p.name}
          size={28}
          className="-ml-2 ring-2 ring-background first:ml-0"
        />
      ))}
      {rest > 0 ? (
        <span className="-ml-2 grid h-7 w-7 place-items-center rounded-full bg-secondary text-[10px] font-semibold ring-2 ring-background">
          +{rest}
        </span>
      ) : null}
    </div>
  );
}

export function Progress({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
        <span>Group readiness</span>
        <span>
          {done}/{total} ready
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Weekly timeline                                                     */
/* ------------------------------------------------------------------ */

export function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - day);
  return x;
}

export const dayKey = (d: Date | string) => {
  const x = typeof d === "string" ? new Date(d) : d;
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(
    x.getDate(),
  ).padStart(2, "0")}`;
};

export function WeekStrip({
  weekStart,
  selected,
  onSelect,
  marks,
  onShift,
}: {
  weekStart: Date;
  selected: string | null;
  onSelect: (key: string | null) => void;
  marks: Record<string, string[]>;
  onShift: (delta: number) => void;
}) {
  const today = dayKey(new Date());
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
  const label = `${days[0]!.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${days[6]!.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;

  return (
    <Glass className="p-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <button
          type="button"
          onClick={() => onShift(-1)}
          className="tap-target rounded-lg px-2 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground active:bg-secondary active:text-foreground"
          aria-label="Previous week"
        >
          ‹
        </button>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <button
          type="button"
          onClick={() => onShift(1)}
          className="tap-target rounded-lg px-2 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground active:bg-secondary active:text-foreground"
          aria-label="Next week"
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const key = dayKey(d);
          const isToday = key === today;
          const isActive = selected === key;
          const dots = marks[key] ?? [];
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(isActive ? null : key)}
              className={cn(
                "pressable flex flex-col items-center gap-1 rounded-2xl px-1 py-2 text-center transition",
                isActive
                  ? "bg-primary text-primary-foreground shadow-[0_10px_30px_-14px_var(--primary)]"
                  : isToday
                    ? "bg-foreground/10 text-foreground"
                    : "text-muted-foreground hover:bg-foreground/5",
              )}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
                {d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 3)}
              </span>
              <span className="text-sm font-semibold tabular-nums">{d.getDate()}</span>
              <span className="flex h-1.5 items-center gap-0.5">
                {dots.slice(0, 3).map((status, i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      isActive
                        ? "bg-primary-foreground/80"
                        : status === "finalized"
                          ? "bg-indigo-400"
                          : status === "voting"
                            ? "bg-emerald-400"
                            : "bg-amber-400",
                    )}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </Glass>
  );
}

/* ------------------------------------------------------------------ */
/* Map thumbnail                                                       */
/* ------------------------------------------------------------------ */

export function MapThumb({
  lat,
  lon,
  label,
  className,
}: {
  lat?: number | null;
  lon?: number | null;
  label?: string | null;
  className?: string;
}) {
  const token = useQuery({
    queryKey: ["map-token"],
    queryFn: useServerFn(getMapToken),
    staleTime: 60 * 60 * 1000,
  });
  const hasPoint = typeof lat === "number" && typeof lon === "number";
  const src =
    hasPoint && token.data
      ? `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/pin-s+6366f1(${lon},${lat})/${lon},${lat},13,0/320x200@2x?access_token=${token.data}`
      : null;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border/60 bg-secondary",
        className,
      )}
    >
      {src ? (
        <img
          src={src}
          alt={label ? `Map of ${label}` : "Location map"}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="grid h-full w-full place-items-center bg-[radial-gradient(circle_at_30%_20%,color-mix(in_oklab,var(--primary)_22%,transparent),transparent_60%)] text-2xl">
          📍
        </div>
      )}
      {label ? (
        <span className="absolute inset-x-1 bottom-1 truncate rounded-xl bg-background/80 px-2 py-1 text-[11px] font-medium backdrop-blur">
          {label}
        </span>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Weather chip                                                        */
/* ------------------------------------------------------------------ */

export function WeatherChip({ planId }: { planId: string }) {
  const fetchWeather = useServerFn(getPlanWeather);
  const q = useQuery({
    queryKey: ["plan-weather", planId],
    queryFn: () => fetchWeather({ data: { planId } }),
    staleTime: 30 * 60 * 1000,
    retry: false,
  });
  if (!q.data) return null;
  const w = describeWeather(q.data.code);
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-foreground/6 px-2 py-1 text-[11px] font-medium text-muted-foreground">
      <span aria-hidden>{w.emoji}</span>
      {Math.round(q.data.tempMaxF)}°F · {w.label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Cards                                                               */
/* ------------------------------------------------------------------ */

export function formatWhen(iso?: string | null) {
  if (!iso) return "Date TBD";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Date TBD";
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function ActionCard({ plan }: { plan: DashPlan }) {
  const needsMe = plan.status === "collecting" ? !plan.i_responded : !plan.i_voted;
  return (
    <Link to="/plans/$planId" params={{ planId: plan.id }}>
      <Glass interactive className="flex h-full flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[11px] text-muted-foreground">
              {plan.groups?.emoji ?? "✨"} {plan.groups?.name ?? "Group"}
            </p>
            <h3 className="mt-0.5 truncate font-display text-base font-semibold">{plan.title}</h3>
            <CostBadge min={plan.est_cost_min} max={plan.est_cost_max} className="mt-1" />
          </div>
          <StatusTag status={plan.status} />
        </div>
        <Progress
          done={plan.status === "voting" ? plan.vote_count : plan.responded_count}
          total={Math.max(plan.participant_count, 1)}
        />
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <AvatarStack people={plan.participants} />
          <span
            className={cn(
              "text-xs font-semibold",
              needsMe ? "text-primary" : "text-muted-foreground",
            )}
          >
            {needsMe
              ? plan.status === "voting"
                ? "Cast your vote →"
                : "Answer privately →"
              : "You're done ✓"}
          </span>
        </div>
      </Glass>
    </Link>
  );
}

export function ConfirmedCard({ plan }: { plan: DashPlan }) {
  const rec = plan.selected_recommendation;
  return (
    <Link to="/plans/$planId" params={{ planId: plan.id }}>
      <Glass interactive className="flex h-full gap-3">
        <MapThumb lat={rec?.lat} lon={rec?.lon} className="h-24 w-24 shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-indigo-400/12 px-2 py-0.5 text-[11px] font-semibold text-indigo-400">
              {formatWhen(plan.window_start)}
            </span>
            <WeatherChip planId={plan.id} />
            <CostBadge min={plan.est_cost_min} max={plan.est_cost_max} />
          </div>
          <h3 className="truncate font-display text-base font-semibold">{plan.title}</h3>
          <p className="truncate text-xs text-muted-foreground">
            {rec?.location_name ?? rec?.title ?? plan.location_area ?? "Location TBD"}
          </p>
          <div className="mt-auto flex items-center justify-between">
            <AvatarStack people={plan.participants} max={3} />
            <span className="text-[11px] font-medium text-muted-foreground">
              {plan.compatibility_score ?? 0}% match
            </span>
          </div>
        </div>
      </Glass>
    </Link>
  );
}

export function GroupsRail({
  groups,
}: {
  groups: { id: string; name: string; emoji: string; members: number }[];
}) {
  return (
    <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {groups.map((g) => (
        <Glass key={g.id} className="w-52 shrink-0 snap-start space-y-3">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-foreground/8 text-lg">
              {g.emoji}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{g.name}</p>
              <p className="text-[11px] text-muted-foreground">{g.members} members</p>
            </div>
          </div>
          <Link to="/groups/$groupId" params={{ groupId: g.id }} className="block">
            <Button variant="outline" className="w-full py-2 text-xs">
              Start plan
            </Button>
          </Link>
        </Glass>
      ))}
    </div>
  );
}
