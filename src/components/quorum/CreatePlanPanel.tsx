import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Sparkles, Rocket, PencilLine, MapPin } from "lucide-react";
import { toast } from "sonner";
import { TimePicker } from "./TimePicker";
import { Button, Card, Field, Skeleton, inputClass } from "./ui";
import { PlaceAutocomplete } from "./PlaceAutocomplete";
import { VenueMap, type MapVenue } from "./VenueMap";
import { FairVenueCard } from "./FairPointVenues";
import { createPlan } from "@/lib/quorum/plan.functions";
import {
  getPlanDefaults,
  launchAiPlan,
  previewFairPointVenues,
} from "@/lib/quorum/planner.functions";
import { CATEGORIES, type PlanCategory } from "@/lib/quorum/types";
import { RADIUS_OPTIONS, VIBES } from "@/lib/quorum/vibes";
import { inviteLink, shareOrCopy } from "@/lib/quorum/invite";
import { isValidZip } from "@/lib/quorum/location";
import { EST_COST_PRESETS, estCostLabel } from "@/lib/quorum/estcost";

/**
 * Frictionless, map-centric plan creation: saved defaults, a Fair-Point venue
 * map for the whole group, and a one-click AI launcher.
 */
export function CreatePlanPanel({
  groupId,
  memberIds,
  inviteCode,
}: {
  groupId: string;
  memberIds: string[];
  inviteCode: string;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const fetchDefaults = useServerFn(getPlanDefaults);
  const defaults = useQuery({
    queryKey: ["plan-defaults", groupId],
    queryFn: () => fetchDefaults({ data: { groupId } }),
    staleTime: 5 * 60_000,
  });

  const [useSaved, setUseSaved] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<PlanCategory>("dinner");
  const [vibe, setVibe] = useState<string | null>(null);
  const [radius, setRadius] = useState(10);
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("18:30");
  const [zip, setZip] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  // Creator's "bring this much" estimate — shown to everyone up front.
  const [estCost, setEstCost] = useState<{ min: number; max: number } | null>(null);

  // Saved defaults hydrate the form the moment they arrive.
  useEffect(() => {
    if (!defaults.data || !useSaved) return;
    const me = defaults.data.me;
    setZip((z) => z || me.zip || defaults.data.fairPoint?.zip || "");
    setRadius((r) => (r === 10 ? me.radiusMiles : r));
    const savedCat = me.categories[0] as PlanCategory | undefined;
    if (savedCat && CATEGORIES.some((c) => c.id === savedCat)) {
      setCategory((c) => (c === "dinner" ? savedCat : c));
    }
    // Respect a saved curfew: back the start time up so the plan ends in time.
    if (me.curfew) {
      const [ch, cm] = me.curfew.split(":");
      const curfewMin = Number(ch) * 60 + Number(cm ?? 0);
      setStartTime((s) => {
        const [h, m] = s.split(":");
        const startMin = Number(h) * 60 + Number(m ?? 0);
        if (startMin + 150 <= curfewMin) return s;
        const shifted = Math.max(11 * 60, curfewMin - 150);
        return `${String(Math.floor(shifted / 60)).padStart(2, "0")}:${String(shifted % 60).padStart(2, "0")}`;
      });
    }
  }, [defaults.data, useSaved]);


  const endTime = useMemo(() => {
    const [h, m] = startTime.split(":");
    const total = Number(h) * 60 + Number(m ?? 0) + 150;
    const w = ((total % 1440) + 1440) % 1440;
    return `${String(Math.floor(w / 60)).padStart(2, "0")}:${String(w % 60).padStart(2, "0")}`;
  }, [startTime]);

  const fetchVenues = useServerFn(previewFairPointVenues);
  const venues = useQuery({
    queryKey: ["fair-venues", groupId, category, vibe, radius, useSaved ? zip : "", endTime],
    queryFn: () =>
      fetchVenues({
        data: {
          groupId,
          category,
          vibe,
          radiusMiles: radius,
          zipOverride: zip || null,
          endTime,
        },
      }),
    enabled: Boolean(defaults.data),
    staleTime: 60_000,
  });

  const mapPins: MapVenue[] = useMemo(() => {
    const homes: MapVenue[] = (defaults.data?.members ?? [])
      .filter((m) => m.lat != null && m.lon != null)
      .map((m) => ({
        id: `home-${m.profileId}`,
        title: `${m.name}'s home base`,
        lat: m.lat!,
        lon: m.lon!,
        kind: "home" as const,
      }));
    const spots: MapVenue[] = (venues.data?.venues ?? [])
      .filter((v) => v.lat != null && v.lon != null)
      .map((v, i) => ({
        id: v.key,
        title: v.title,
        lat: v.lat!,
        lon: v.lon!,
        rank: i + 1,
        selected: picked === v.key,
        kind: v.kind,
      }));
    const fp = defaults.data?.fairPoint;
    return [
      ...homes,
      ...(fp
        ? [
            {
              id: "fair-point",
              title: "Group fair point",
              lat: fp.lat,
              lon: fp.lon,
              kind: "fair" as const,
            },
          ]
        : []),
      ...spots,
    ];
  }, [defaults.data, venues.data, picked]);

  const launch = useMutation({
    mutationFn: useServerFn(launchAiPlan),
    onSuccess: (raw) => {
      const r = raw as { planId: string; optionCount: number; inviteCode: string | null };
      void qc.invalidateQueries({ queryKey: ["group", groupId] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Plan launched", {
        description: `${r.optionCount} fair-point options ready · share code ${r.inviteCode ?? inviteCode}`,
      });
      void navigate({ to: "/plans/$planId", params: { planId: r.planId } });
    },
    onError: (e: unknown) =>
      toast.error("Could not launch that plan", {
        description: e instanceof Error ? e.message : "Try rephrasing it.",
      }),
  });

  const create = useMutation({
    mutationFn: useServerFn(createPlan),
    onSuccess: (plan) => {
      void qc.invalidateQueries({ queryKey: ["group", groupId] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Plan created", {
        description: "Everyone gets their own private questionnaire.",
      });
      void navigate({ to: "/plans/$planId", params: { planId: (plan as { id: string }).id } });
    },
    onError: (e: unknown) =>
      toast.error("Could not create the plan", {
        description: e instanceof Error ? e.message : "Please try again.",
      }),
  });

  const d = defaults.data;

  return (
    <Card className="mb-6">
      <h2 className="font-display text-base font-semibold">Start a plan</h2>

      {/* 1. Saved defaults summary + single toggle */}
      {defaults.isLoading ? (
        <Skeleton className="mt-3 h-14 rounded-2xl" />
      ) : d?.summary ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-secondary/60 p-3">
          <p className="text-xs">
            <span className="font-medium">{d.summary}</span>
            {d.fairPoint ? (
              <span className="mt-0.5 block text-muted-foreground">
                Fair point across {d.fairPoint.memberCount || d.members.length} members ·{" "}
                {d.fairPoint.label}
              </span>
            ) : null}
          </p>
          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
            <input
              type="checkbox"
              checked={useSaved}
              onChange={(e) => setUseSaved(e.target.checked)}
              className="h-4 w-4 accent-[var(--primary)]"
            />
            Continue with saved info
          </label>
        </div>
      ) : (
        <p className="mt-3 rounded-2xl bg-secondary/60 p-3 text-xs text-muted-foreground">
          Add your home ZIP and curfew in Settings and we'll pre-fill every plan for you.
        </p>
      )}

      {/* 2. One-click AI generator */}
      <div className="mt-4 rounded-3xl border border-primary/30 bg-primary/5 p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden />
          <h3 className="text-sm font-semibold">Create with AI</h3>
        </div>
        <textarea
          className="mt-2 min-h-20 w-full resize-y rounded-2xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary/50"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Post-game dinner and bowling nearby before 10 PM curfew"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            className="flex-1"
            loading={launch.isPending}
            disabled={!prompt.trim()}
            onClick={() => launch.mutate({
                data: {
                  groupId,
                  prompt,
                  useDefaults: useSaved,
                  estCostMin: estCost?.min ?? null,
                  estCostMax: estCost?.max ?? null,
                },
              })}
          >
            <Rocket className="h-4 w-4" aria-hidden />
            {launch.isPending ? "Building your plan…" : "Launch Plan Now"}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setShowForm(true);
              if (prompt.trim() && !title) setTitle(prompt.trim().slice(0, 60));
            }}
          >
            <PencilLine className="h-4 w-4" aria-hidden />
            Quick Edit
          </Button>
        </div>
      </div>

      {/* 3. Fair-Point map + venue cards */}
      <div className="mt-5">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" aria-hidden />
          <h3 className="text-sm font-semibold">Fair-Point spots for this group</h3>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Clustered around everyone's midpoint
          {venues.data?.origin ? ` · ${venues.data.origin.label}` : ""}. Drive times are per member.
        </p>

        <div className="mt-3">
          <VenueMap venues={mapPins} onSelect={(id) => setPicked(id)} />
        </div>

        <div className="mt-3 space-y-2">
          {venues.isFetching ? (
            <Skeleton className="h-24 rounded-3xl" />
          ) : venues.data?.venues.length ? (
            venues.data.venues
              .slice(0, 6)
              .map((v) => (
                <FairVenueCard
                  key={v.key}
                  venue={v}
                  meProfileId={d?.me.profileId}
                  selected={picked === v.key}
                  onSelect={() => setPicked(picked === v.key ? null : v.key)}
                />
              ))
          ) : (
            <p className="text-xs text-muted-foreground">
              No spots yet — add a ZIP below or widen the radius.
            </p>
          )}
        </div>
      </div>

      {/* 4. Quick edit form */}
      <button
        type="button"
        className="mt-4 text-xs font-medium text-primary underline-offset-4 hover:underline"
        onClick={() => setShowForm((v) => !v)}
      >
        {showForm ? "Hide plan details" : "Edit plan details manually"}
      </button>

      {showForm ? (
        <div className="mt-4 space-y-4">
          <Field label="What are you planning?">
            <input
              className={inputClass}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Saturday dinner"
            />
          </Field>

          <div>
            <span className="text-sm font-medium">Category</span>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  className={`rounded-2xl border px-3 py-2.5 text-left text-sm transition ${
                    category === c.id
                      ? "border-primary/50 bg-primary/8"
                      : "border-border hover:bg-secondary"
                  }`}
                >
                  <span className="mr-1.5">{c.emoji}</span>
                  <span className="font-medium">{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-sm font-medium">Food & activity vibe</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {VIBES.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVibe((cur) => (cur === v.id ? null : v.id))}
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${
                    vibe === v.id
                      ? "border-primary/50 bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  <span className="mr-1">{v.emoji}</span>
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-sm font-medium">Estimated cost per person</span>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Everyone sees this on the plan card so they know what to bring.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {EST_COST_PRESETS.map((p) => {
                const active = estCost?.min === p.min && estCost?.max === p.max;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() =>
                      setEstCost(active ? null : { min: p.min, max: p.max })
                    }
                    className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
                      active
                        ? "border-primary/50 bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min={0}
                inputMode="numeric"
                className={`${inputClass} w-24`}
                placeholder="Min $"
                value={estCost?.min ?? ""}
                onChange={(e) =>
                  setEstCost((c) => ({
                    min: Number(e.target.value || 0),
                    max: c?.max ?? Number(e.target.value || 0),
                  }))
                }
                aria-label="Minimum cost per person"
              />
              <span className="text-sm text-muted-foreground">to</span>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                className={`${inputClass} w-24`}
                placeholder="Max $"
                value={estCost?.max ?? ""}
                onChange={(e) =>
                  setEstCost((c) => ({
                    min: c?.min ?? Number(e.target.value || 0),
                    max: Number(e.target.value || 0),
                  }))
                }
                aria-label="Maximum cost per person"
              />
              {estCost ? (
                <span className="text-xs font-medium text-primary">
                  {estCostLabel(estCost.min, estCost.max)}
                </span>
              ) : null}
            </div>
          </div>

          <Field label="ZIP code" hint="Leave as-is to use the group's fair point">
            <PlaceAutocomplete value={zip} onChange={setZip} />
          </Field>

          <div>
            <label className="text-sm font-medium" htmlFor="plan-radius">
              Search radius · {radius} mi
            </label>
            <input
              id="plan-radius"
              type="range"
              min={RADIUS_OPTIONS[0]}
              max={RADIUS_OPTIONS[RADIUS_OPTIONS.length - 1]}
              step={5}
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="mt-2 w-full accent-primary"
            />
            <div className="flex justify-between text-[11px] text-muted-foreground">
              {RADIUS_OPTIONS.map((r) => (
                <span key={r}>{r} mi</span>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Field label="Date">
              <input
                type="date"
                className={inputClass}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
            <Field label="Start time">
              <TimePicker
                presets={["17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00"]}
                value={startTime}
                onChange={(v) => setStartTime(v ?? startTime)}
              />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">
            Wraps around {endTime} — we check that against everyone's curfew.
          </p>

          <div className="flex flex-wrap gap-2">
            <Button
              className="flex-1"
              loading={create.isPending}
              disabled={!title.trim()}
              onClick={() => {
                if (!title.trim()) return toast.error("Give the plan a name first");
                if (zip && !isValidZip(zip)) return toast.error("Enter a valid 5-digit ZIP code");
                create.mutate({
                  data: {
                    groupId,
                    title,
                    category,
                    windowStart: date ? `${date}T${startTime}:00` : null,
                    windowEnd: date ? `${date}T${endTime}:00` : null,
                    zipCode: zip || null,
                    foodVibe: vibe,
                    radiusMiles: radius,
                    estCostMin: estCost?.min ?? null,
                    estCostMax: estCost?.max ?? null,
                    participantIds: memberIds,
                  },
                });
              }}
            >
              {create.isPending ? "Creating…" : "Create plan"}
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                void shareOrCopy({
                  title: "Join my Syncly group",
                  text: `Join with code ${inviteCode}`,
                  url: inviteLink(inviteCode),
                }).then((r) => {
                  if (r === "copied") toast.success("Invite link copied");
                })
              }
            >
              Share invite
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
