import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, Card, Pill, Skeleton } from "@/components/quorum/ui";
import { VenueMap } from "@/components/quorum/VenueMap";
import { VibeSearch } from "@/components/quorum/ai/VibeSearch";
import { directionsUrl } from "@/components/quorum/FairPointVenues";
import { ACTIVITY_TABS, FOOD_TABS, SPOT_RADII, type SpotTab } from "@/lib/quorum/spotTabs";
import {
  addSpotToPlan,
  browseSpots,
  listSavedSpots,
  saveSpot,
  unsaveSpot,
  type BrowseSpot,
  type SavedPlace,
} from "@/lib/quorum/spots.functions";
import type { VibeSearchSpot } from "@/lib/quorum/aiplus.functions";
import { VenueDetailModal } from "@/components/quorum/VenueDetailModal";
import { googleReviewsUrl, venuePhoto, venueStats } from "@/lib/quorum/venuePhotos";

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
  const [view, setView] = useState<"browse" | "saved">("browse");
  const [tab, setTab] = useState<SpotTab>(FOOD_TABS[0]!);
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [radius, setRadius] = useState<number>(10);
  const [nearHome, setNearHome] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [added, setAdded] = useState<string[]>([]);
  const [detail, setDetail] = useState<BrowseSpot | null>(null);

  const queryClient = useQueryClient();
  const listSavedFn = useServerFn(listSavedSpots);
  const savedQuery = useQuery({
    queryKey: ["saved-spots"],
    queryFn: () => listSavedFn(),
  });
  const savedKeys = useMemo(
    () => new Set((savedQuery.data ?? []).map((s) => s.key)),
    [savedQuery.data],
  );

  const saveFn = useServerFn(saveSpot);
  const save = useMutation({
    mutationFn: (spot: BrowseSpot) => saveFn({ data: { spot } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["saved-spots"] }),
  });
  const unsaveFn = useServerFn(unsaveSpot);
  const unsave = useMutation({
    mutationFn: (key: string) => unsaveFn({ data: { key } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["saved-spots"] }),
  });
  const toggleSave = (spot: BrowseSpot) => {
    if (savedKeys.has(spot.key)) unsave.mutate(spot.key);
    else save.mutate(spot);
  };

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

  const handleVibePick = (s: VibeSearchSpot) => {
    if (planId && canAdd) {
      const spot: BrowseSpot = { ...s, members: [] };
      add.mutate({ planId, spot });
    } else {
      setDetail({ ...s, members: [] });
    }
  };

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
    const pins = (data.spots ?? []).map((s) => ({
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
            {view === "saved"
              ? "Places you've bookmarked for later"
              : data?.origin
                ? `Searching near ${data.origin.label}`
                : "Live restaurants and activities near you"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-full bg-secondary p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setView("browse")}
              className={cn(
                "rounded-full px-3 py-1.5 transition",
                view === "browse" ? "bg-background shadow-sm" : "text-muted-foreground",
              )}
            >
              Browse
            </button>
            <button
              type="button"
              onClick={() => setView("saved")}
              className={cn(
                "rounded-full px-3 py-1.5 transition",
                view === "saved" ? "bg-background shadow-sm" : "text-muted-foreground",
              )}
            >
              Saved{savedKeys.size ? ` (${savedKeys.size})` : ""}
            </button>
          </div>
          {view === "browse" ? (
            <button
              type="button"
              onClick={() => setNearHome((v) => !v)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                nearHome ? "border-primary/60 bg-primary/10 text-primary" : "border-border"
              }`}
            >
              🏠 Search near my home
            </button>
          ) : null}
        </div>
      </div>

      {view === "saved" ? (
        <div className="space-y-2">
          {savedQuery.isLoading ? <Skeleton className="h-40 rounded-2xl" /> : null}
          {(savedQuery.data ?? []).map((s) => (
            <SavedSpotRow
              key={s.key}
              spot={s}
              planId={planId}
              canAdd={canAdd}
              added={added.includes(s.key)}
              adding={add.isPending}
              onAdd={(spot) => add.mutate({ planId: planId!, spot })}
              onRemove={() => unsave.mutate(s.key)}
            />
          ))}
          {!savedQuery.isLoading && (savedQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing saved yet — tap the bookmark on a spot while browsing to keep it here.
            </p>
          ) : null}
        </div>
      ) : null}

      {view === "browse" && data?.needsHome ? (
        <div className="rounded-2xl bg-warning/15 px-3 py-2 text-sm">
          Add your home address to see exact distances.{" "}
          <Link to="/settings" className="font-medium underline underline-offset-4">
            Set it now
          </Link>
        </div>
      ) : null}

      {view !== "browse" ? null : (
        <>
          <VibeSearch kind={tab.kind} onPick={handleVibePick} />

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
                className="mt-1 w-full accent-primary"
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
                      {s.members
                        .map((m) => `${m.miles} mi for ${m.name.split(" ")[0]}`)
                        .join(" • ")}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                    {s.cuisine ? <Pill>{s.cuisine}</Pill> : null}
                    <Pill>{s.priceLevel}</Pill>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setDetail(s)}
                  className="mt-3 block w-full overflow-hidden rounded-2xl text-left"
                  aria-label={`View details for ${s.title}`}
                >
                  <span className="relative block">
                    <img
                      src={venuePhoto(s)}
                      alt={`${s.title} — ${s.cuisine ?? s.subtitle}`}
                      loading="lazy"
                      className="h-28 w-full object-cover transition active:scale-[0.98] hover:scale-[1.02]"
                    />
                    <span className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/70 to-transparent p-2">
                      <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
                        {venueStats(s.key).ratingLabel}
                      </span>
                      <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
                        {s.priceLevel}
                      </span>
                    </span>
                  </span>
                </button>
                <div className="mt-3 flex items-center gap-3">
                  {planId && canAdd ? (
                    <Button
                      variant={added.includes(s.key) ? "outline" : "primary"}
                      disabled={add.isPending || added.includes(s.key)}
                      onClick={() => add.mutate({ planId, spot: s })}
                    >
                      {added.includes(s.key) ? "Added ✓" : "Add to plan"}
                    </Button>
                  ) : null}
                  <a
                    href={directionsUrl({
                      title: s.title,
                      lat: s.lat,
                      lon: s.lon,
                      address: s.address,
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Directions in Maps →
                  </a>
                  <a
                    href={googleReviewsUrl(s.title, s.address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Read reviews →
                  </a>
                  <button
                    type="button"
                    onClick={() => setDetail(s)}
                    className="text-xs font-medium text-muted-foreground underline-offset-4 hover:underline"
                  >
                    Photos & highlights
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleSave(s)}
                    aria-label={
                      savedKeys.has(s.key) ? "Remove from saved places" : "Save this spot"
                    }
                    className={cn(
                      "ml-auto inline-flex items-center gap-1 text-xs font-medium",
                      savedKeys.has(s.key)
                        ? "text-primary"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Bookmark className={cn("size-3.5", savedKeys.has(s.key) && "fill-current")} />
                    {savedKeys.has(s.key) ? "Saved" : "Save"}
                  </button>
                </div>
              </div>
            ))}
            {!spots.isLoading && (data?.spots?.length ?? 0) === 0 && !data?.needsHome ? (
              <p className="text-sm text-muted-foreground">
                No spots found in {radius} miles — try a wider radius or another category.
              </p>
            ) : null}
          </div>
        </>
      )}

      <VenueDetailModal
        venue={
          detail
            ? {
                key: detail.key,
                title: detail.title,
                address: detail.address,
                subtitle: detail.subtitle,
                cuisine: detail.cuisine,
                kind: detail.kind,
                priceLevel: detail.priceLevel,
                lat: detail.lat,
                lon: detail.lon,
              }
            : null
        }
        onClose={() => setDetail(null)}
        footer={
          detail ? (
            <>
              {planId && canAdd ? (
                <Button
                  variant={added.includes(detail.key) ? "outline" : "primary"}
                  disabled={add.isPending || added.includes(detail.key)}
                  onClick={() => add.mutate({ planId, spot: detail })}
                >
                  {added.includes(detail.key) ? "Added ✓" : "Add to plan"}
                </Button>
              ) : null}
              <button
                type="button"
                onClick={() => toggleSave(detail)}
                className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-medium hover:bg-secondary"
              >
                <Bookmark
                  className={cn(
                    "size-3.5",
                    savedKeys.has(detail.key) && "fill-current text-primary",
                  )}
                />
                {savedKeys.has(detail.key) ? "Saved" : "Save"}
              </button>
            </>
          ) : null
        }
      />
    </Card>
  );
}

function SavedSpotRow({
  spot,
  planId,
  canAdd,
  added,
  adding,
  onAdd,
  onRemove,
}: {
  spot: SavedPlace;
  planId?: string | null;
  canAdd: boolean;
  added: boolean;
  adding: boolean;
  onAdd: (spot: BrowseSpot) => void;
  onRemove: () => void;
}) {
  const asBrowseSpot: BrowseSpot = {
    key: spot.key,
    title: spot.title,
    subtitle: spot.subtitle ?? "",
    address: spot.address,
    cuisine: spot.cuisine,
    priceLevel: spot.priceLevel ?? "$$",
    kind: spot.kind,
    costMin: spot.costMin,
    costMax: spot.costMax,
    lat: spot.lat,
    lon: spot.lon,
    miles: spot.miles ?? 0,
    minutes: spot.minutes ?? 0,
    members: [],
  };

  return (
    <div className="rounded-3xl border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-semibold">
            <span className="mr-1">{spot.kind === "food" ? "🍽️" : "🎟️"}</span>
            {spot.title}
          </p>
          <p className="truncate text-xs text-muted-foreground">{spot.address ?? spot.subtitle}</p>
        </div>
        <Pill tone="accent">
          ${spot.costMin}–{spot.costMax}/person
        </Pill>
      </div>
      {spot.miles != null ? (
        <p className="mt-2 text-xs font-medium text-primary">
          {spot.miles} miles from your home • ~{spot.minutes} min drive
        </p>
      ) : null}
      <div className="mt-3 flex items-center gap-3">
        {planId && canAdd ? (
          <Button
            variant={added ? "outline" : "primary"}
            disabled={adding || added}
            onClick={() => onAdd(asBrowseSpot)}
          >
            {added ? "Added ✓" : "Add to plan"}
          </Button>
        ) : null}
        <a
          href={directionsUrl({
            title: spot.title,
            lat: spot.lat,
            lon: spot.lon,
            address: spot.address,
          })}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-primary underline-offset-4 hover:underline"
        >
          Directions in Maps →
        </a>
        <button
          type="button"
          onClick={onRemove}
          className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-foreground"
        >
          <Bookmark className="size-3.5 fill-current" />
          Remove
        </button>
      </div>
    </div>
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
