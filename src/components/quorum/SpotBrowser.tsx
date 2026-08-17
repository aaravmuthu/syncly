import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Button, Card, Pill, Skeleton } from "@/components/quorum/ui";
import { VenueMap } from "@/components/quorum/VenueMap";
import { directionsUrl } from "@/components/quorum/FairPointVenues";
import { ACTIVITY_TABS, FOOD_TABS, SPOT_RADII, type SpotTab } from "@/lib/quorum/spotTabs";
import { addSpotToPlan, browseSpots, type BrowseSpot } from "@/lib/quorum/spots.functions";

/**
 * Live restaurant / activity picker. Searches Geoapify around the member's
 * saved home address and shows the exact mileage for them and their group.
 */
export function SpotBrowser({
  groupId,
  planId,
  canAdd = true,
  onAdded,
}: {
  groupId?: string | null;
  planId?: string | null;
  canAdd?: boolean;
  onAdded?: () => void;
}) {
  const [tab, setTab] = useState<SpotTab>(FOOD_TABS[0]!);
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [radius, setRadius] = useState<number>(10);
  const [nearHome, setNearHome] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [added, setAdded] = useState<string[]>([]);

  const run = useServerFn(browseSpots);
  const spots = useQuery({
    queryKey: ["spots", tab.id, submitted, radius, groupId ?? null],
    queryFn: () =>
      run({
        data: {
          categories: tab.categories,
          kind: tab.kind,
          query: submitted || null,
          radiusMiles: radius,
          groupId: groupId ?? null,
        },
      }),
    staleTime: 1000 * 60 * 5,
  });

  const addFn = useServerFn(addSpotToPlan);
  const add = useMutation({
    mutationFn: (vars: { planId: string; spot: BrowseSpot }) => addFn({ data: vars }),
    onSuccess: (_r, vars) => {
      setAdded((prev) => [...prev, vars.spot.key]);
      onAdded?.();
    },
  });

  const data = spots.data;
  const mapVenues = useMemo(() => {
    if (!data?.origin) return [];
    const home = {
      id: "home",
      title: "Your home",
      lat: data.origin.lat,
      lon: data.origin.lon,
      kind: "home" as const,
    };
    const pins = (data.spots ?? [])
      .filter((s) => (selected ? s.key === selected : true))
      .slice(0, selected ? 1 : 12)
      .map((s) => ({
        id: s.key,
        title: s.title,
        lat: s.lat,
        lon: s.lon,
        selected: s.key === selected,
        kind: s.kind,
      }));
    return [home, ...pins];
  }, [data, selected]);

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold">Browse local spots</p>
          <p className="text-sm text-muted-foreground">
            {data?.origin
              ? `Searching near ${data.origin.label}`
              : "Live restaurants and activities near you"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setNearHome((v) => !v)}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
            nearHome ? "border-primary/60 bg-primary/10 text-primary" : "border-border"
          }`}
        >
          🏠 Search near my home
        </button>
      </div>

      {data?.needsHome ? (
        <div className="rounded-2xl bg-warning/15 px-3 py-2 text-sm">
          Add your home address to see exact distances.{" "}
          <Link to="/settings" className="font-medium underline underline-offset-4">
            Set it now
          </Link>
        </div>
      ) : null}

      {/* Category tabs */}
      <div className="space-y-2">
        <TabRow title="Food & dining" tabs={FOOD_TABS} active={tab} onPick={setTab} />
        <TabRow title="Sports & activities" tabs={ACTIVITY_TABS} active={tab} onPick={setTab} />
      </div>

      {/* Search + radius */}
      <div className="flex flex-wrap items-end gap-3">
        <form
          className="flex min-w-[220px] flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(query.trim());
          }}
        >
          <input
            className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
            placeholder="Search a place (e.g. Chipotle)"
            aria-label="Search local spots"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>
        <div className="min-w-[190px]">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="spot-radius">
            Radius · {radius} mi
          </label>
          <input
            id="spot-radius"
            type="range"
            min={SPOT_RADII[0]}
            max={SPOT_RADII[SPOT_RADII.length - 1]}
            step={5}
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="mt-1 w-full accent-[hsl(var(--primary))]"
          />
        </div>
      </div>

      {spots.isLoading ? <Skeleton className="h-40 rounded-2xl" /> : null}

      {mapVenues.length > 1 ? <VenueMap venues={mapVenues} onSelect={setSelected} /> : null}

      <div className="space-y-2">
        {(data?.spots ?? []).map((s) => (
          <div
            key={s.key}
            className={`rounded-3xl border p-4 transition ${
              selected === s.key ? "border-primary/60 bg-primary/5" : "border-border"
            }`}
          >
            <button
              type="button"
              className="w-full text-left"
              onClick={() => setSelected(s.key === selected ? null : s.key)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-display text-sm font-semibold">
                    <span className="mr-1">{s.kind === "food" ? "🍽️" : "🎟️"}</span>
                    {s.title}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {s.address ?? s.subtitle}
                  </p>
                </div>
                <Pill tone="accent">
                  ${s.costMin}–{s.costMax}/person
                </Pill>
              </div>
              <p className="mt-2 text-xs font-medium text-primary">
                {s.miles} miles from your home • ~{s.minutes} min drive
              </p>
              {s.members.length ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {s.members.map((m) => `${m.miles} mi for ${m.name.split(" ")[0]}`).join(" • ")}
                </p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                {s.cuisine ? <Pill>{s.cuisine}</Pill> : null}
                <Pill>{s.priceLevel}</Pill>
              </div>
            </button>
            <div className="mt-3 flex items-center gap-3">
              {planId && canAdd ? (
                <Button
                  variant={added.includes(s.key) ? "outline" : "primary"}
                  disabled={add.isPending || added.includes(s.key)}
                  onClick={() => add.mutate({ data: { planId, spot: s } })}
                >
                  {added.includes(s.key) ? "Added ✓" : "Add to plan"}
                </Button>
              ) : null}
              <a
                href={directionsUrl({ title: s.title, lat: s.lat, lon: s.lon, address: s.address })}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium text-primary underline-offset-4 hover:underline"
              >
                Directions in Maps →
              </a>
            </div>
          </div>
        ))}
        {!spots.isLoading && (data?.spots?.length ?? 0) === 0 && !data?.needsHome ? (
          <p className="text-sm text-muted-foreground">
            No spots found in {radius} miles — try a wider radius or another category.
          </p>
        ) : null}
      </div>
    </Card>
  );
}

function TabRow({
  title,
  tabs,
  active,
  onPick,
}: {
  title: string;
  tabs: SpotTab[];
  active: SpotTab;
  onPick: (t: SpotTab) => void;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onPick(t)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              active.id === t.id
                ? "border-primary/60 bg-primary/10 text-primary"
                : "border-border hover:bg-secondary"
            }`}
          >
            <span className="mr-1">{t.emoji}</span>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
