import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Trophy, Utensils } from "lucide-react";
import { ThinkingOrb } from "thinking-orbs";
import { toast } from "sonner";
import { Button, Card, Skeleton } from "./ui";
import { FairVenueCard } from "./FairPointVenues";
import { VenueMap, type MapVenue } from "./VenueMap";
import { createPlan } from "@/lib/quorum/plan.functions";
import { getPlanDefaults, previewFairPointVenues } from "@/lib/quorum/planner.functions";
import type { PlanCategory } from "@/lib/quorum/types";
import { VIBES, vibeById } from "@/lib/quorum/vibes";
import { localDateKey, localToInstant } from "@/lib/quorum/plan-time";

/* ---------------------------------------------------------------- */
/* Step 1 vibes                                                      */
/* ---------------------------------------------------------------- */

type WizardVibe = {
  id: string;
  title: string;
  blurb: string;
  emoji: string;
  category: PlanCategory;
  /** default vibe id from lib/quorum/vibes */
  vibe: string;
  /** other vibe ids offered as one-tap sub-picks under this category, e.g. Boba under Food. */
  subVibes?: string[];
  glow: string;
};

const WIZARD_VIBES: WizardVibe[] = [
  {
    id: "food",
    title: "Food & Drinks",
    blurb: "Pizza · Burgers · Boba · Tacos",
    emoji: "🍔",
    category: "dinner",
    vibe: "burgers-wings",
    subVibes: ["burgers-wings", "pizza", "casual-dining", "boba-cafes", "late-night"],
    glow: "from-amber-400/25",
  },
  {
    id: "fun",
    title: "Hangout",
    blurb: "Movies · Bowling · Arcades · Golf",
    emoji: "🎬",
    category: "hangout",
    vibe: "activities",
    subVibes: ["activities", "outdoors"],
    glow: "from-sky-400/25",
  },
  {
    id: "sports",
    title: "Sports & Activity",
    blurb: "Pickleball · Badminton · Turf · Gym",
    emoji: "⚽",
    category: "sports",
    vibe: "activities",
    glow: "from-emerald-400/25",
  },
];

const BUDGETS = [
  { id: "free", label: "Free", sub: "$0", min: 0, max: 0 },
  { id: "chill", label: "Chill", sub: "$10–$15", min: 10, max: 15 },
  { id: "treat", label: "Treat", sub: "$25+", min: 25, max: 40 },
] as const;

const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const clock = (m: number) => {
  const w = ((Math.round(m) % 1440) + 1440) % 1440;
  return `${String(Math.floor(w / 60)).padStart(2, "0")}:${String(w % 60).padStart(2, "0")}`;
};
const to12 = (hhmm: string) => {
  const h = Number(hhmm.slice(0, 2));
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 === 0 ? 12 : h % 12}:${hhmm.slice(3, 5)} ${suffix}`;
};

/**
 * "What are we doing?" — a 3-step overlay wizard: pick a vibe, set budget and
 * curfew, then reveal the top 3 fair-midpoint venues for the squad.
 */
export function PlanWizard({
  groupId,
  memberIds,
  onClose,
}: {
  groupId: string;
  memberIds: string[];
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [vibe, setVibe] = useState<WizardVibe | null>(null);
  const [subVibeId, setSubVibeId] = useState<string | null>(null);
  const [budget, setBudget] = useState<(typeof BUDGETS)[number]>(BUDGETS[1]);
  const [respectCurfew, setRespectCurfew] = useState(true);
  const [picked, setPicked] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const fetchDefaults = useServerFn(getPlanDefaults);
  const defaults = useQuery({
    queryKey: ["plan-defaults", groupId],
    queryFn: () => fetchDefaults({ data: { groupId } }),
    staleTime: 5 * 60_000,
  });

  const startTime = respectCurfew ? (defaults.data?.suggestedWindow?.start ?? "18:30") : "18:30";
  const endTime = respectCurfew ? (defaults.data?.suggestedWindow?.end ?? "21:00") : "21:00";
  const [date, setDate] = useState(() => localDateKey());

  const activeVibeId = subVibeId ?? vibe?.vibe ?? null;

  const fetchVenues = useServerFn(previewFairPointVenues);
  const venues = useQuery({
    queryKey: ["wizard-venues", groupId, vibe?.id, activeVibeId, budget.id, endTime],
    queryFn: () =>
      fetchVenues({
        data: {
          groupId,
          category: vibe?.category ?? "dinner",
          vibe: activeVibeId,
          radiusMiles: 15,
          maxSpend: budget.max,
          endTime,
        },
      }),
    enabled: step === 2 && Boolean(vibe),
    staleTime: 60_000,
  });

  // A short radar sweep before the reveal, even when the data comes back fast.
  useEffect(() => {
    if (step !== 2) return;
    setScanning(true);
    const t = setTimeout(() => setScanning(false), 1600);
    return () => clearTimeout(t);
  }, [step]);

  const top3 = useMemo(() => (venues.data?.venues ?? []).slice(0, 3), [venues.data?.venues]);
  const revealing = scanning || venues.isFetching || defaults.isLoading;

  const pins: MapVenue[] = useMemo(() => {
    const fp = defaults.data?.fairPoint;
    return [
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
      ...top3
        .filter((v) => v.lat != null && v.lon != null)
        .map((v, i) => ({
          id: v.key,
          title: v.title,
          lat: v.lat!,
          lon: v.lon!,
          rank: i + 1,
          selected: picked === v.key,
          kind: v.kind,
        })),
    ];
  }, [defaults.data, top3, picked]);

  const create = useMutation({
    mutationFn: useServerFn(createPlan),
    onSuccess: (plan) => {
      void qc.invalidateQueries({ queryKey: ["group", groupId] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Plan launched", {
        description: "Everyone gets their own private questionnaire.",
      });
      onClose();
      void navigate({ to: "/plans/$planId", params: { planId: (plan as { id: string }).id } });
    },
    onError: (e: unknown) =>
      toast.error("Could not launch that plan", {
        description: e instanceof Error ? e.message : "Please try again.",
      }),
  });

  const launch = () => {
    if (!vibe) return;
    const spot = top3.find((v) => v.key === picked);
    if (!date || !startTime || !endTime) {
      toast.error("Choose a date, start time and end time");
      return;
    }
    if (new Date(localToInstant(date, startTime)).getTime() <= Date.now()) {
      toast.error("Choose a future date", { description: "This start time has already passed." });
      return;
    }
    create.mutate({
      data: {
        groupId,
        title: spot ? `${vibe.emoji} ${spot.title}` : `${vibe.emoji} ${vibe.title}`,
        category: vibe.category,
        windowStart: localToInstant(date, startTime),
        windowEnd: localToInstant(date, endTime),
        zipCode: defaults.data?.fairPoint?.zip ?? null,
        foodVibe: activeVibeId ?? vibe.vibe,
        radiusMiles: 15,
        estCostMin: budget.min,
        estCostMax: budget.max,
        participantIds: memberIds,
      },
    });
  };

  // Portaled straight to <body>: this overlay must stay pinned to the real
  // viewport even though route content (its natural DOM ancestor) sits
  // inside RouteTransition's animated wrapper, whose transform would
  // otherwise make it the containing block for our `fixed` positioning.
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-xl"
        >
          <Dialog.Title className="sr-only">Create a plan</Dialog.Title>
          {/* header */}
          <div className="flex items-center justify-between gap-3 px-5 pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-3">
            <button
              type="button"
              onClick={() => (step === 0 ? onClose() : setStep((s) => s - 1))}
              className="tap-target inline-flex items-center gap-1.5 rounded-2xl px-2 py-1.5 text-sm text-muted-foreground transition active:scale-[0.97] hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden /> {step === 0 ? "Close" : "Back"}
            </button>
            <div className="flex items-center gap-1.5" aria-label={`Step ${step + 1} of 3`}>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-[width,background-color] duration-300 ease-out ${
                    i === step
                      ? "w-7 bg-primary"
                      : i < step
                        ? "w-4 bg-primary/50"
                        : "w-4 bg-secondary"
                  }`}
                />
              ))}
            </div>
            <span className="w-14" />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
            <div className="mx-auto w-full max-w-xl">
              {/* ---------- Step 1: vibe ---------- */}
              {step === 0 ? (
                <div key="step-0" className="animate-fade-in">
                  <h2 className="font-display text-2xl font-semibold">What's the move today?</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Pick a vibe — we'll find spots that are fair for everyone.
                  </p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    {WIZARD_VIBES.map((v) => {
                      const active = vibe?.id === v.id;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => {
                            setVibe(v);
                            setSubVibeId(null);
                            setPicked(null);
                            setStep(1);
                          }}
                          className={`group relative overflow-hidden rounded-2xl border p-4 text-left transition-[transform,box-shadow,border-color] duration-200 ease-out active:scale-[0.97] hover:-translate-y-0.5 hover:shadow-lg ${
                            active
                              ? "border-primary/60 bg-primary/10 shadow-[0_0_35px_-8px_var(--primary)]"
                              : "border-border bg-secondary/40 hover:border-primary/40"
                          }`}
                        >
                          <span
                            className={`pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gradient-to-br ${v.glow} to-transparent blur-2xl transition-opacity duration-300 group-hover:opacity-100 opacity-60`}
                            aria-hidden
                          />
                          <span className="text-3xl">{v.emoji}</span>
                          <span className="mt-2 block font-display text-base font-semibold">
                            {v.title}
                          </span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {v.blurb}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {/* ---------- Step 2: budget + curfew ---------- */}
              {step === 1 ? (
                <div key="step-1" className="animate-fade-in">
                  <h2 className="font-display text-2xl font-semibold">Budget & curfew</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {vibe ? `${vibe.emoji} ${vibe.title}` : ""} — set the money and the clock.
                  </p>

                  {vibe?.subVibes && vibe.subVibes.length > 1 ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {vibe.subVibes.map((id) => {
                        const v = vibeById(id) ?? VIBES.find((x) => x.id === id);
                        if (!v) return null;
                        const active = activeVibeId === id;
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setSubVibeId(id)}
                            className={`pressable rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                              active
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <span className="mr-1">{v.emoji}</span>
                            {v.label}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}

                  <div className="mt-5 grid grid-cols-3 gap-2">
                    {BUDGETS.map((b) => {
                      const active = budget.id === b.id;
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setBudget(b)}
                          className={`tap-target rounded-2xl border px-3 py-4 text-center transition active:scale-[0.97] ${
                            active
                              ? "border-primary/60 bg-primary/10 shadow-[0_0_28px_-10px_var(--primary)]"
                              : "border-border bg-secondary/40 hover:border-primary/40"
                          }`}
                        >
                          <span className="block text-sm font-semibold">{b.label}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {b.sub}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <label className="mt-4 block text-sm font-medium">
                    Plan date
                    <input
                      type="date"
                      required
                      min={localDateKey()}
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-input bg-card px-3 py-3"
                    />
                  </label>
                  <Card className="mt-4">
                    <label className="flex items-start justify-between gap-4">
                      <span>
                        <span className="block text-sm font-semibold">
                          Respect the earliest curfew
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {defaults.data?.suggestedWindow
                            ? `Suggested window: ${to12(startTime)} to ${to12(endTime)}, with time to get home.`
                            : "No curfews saved yet — defaulting to a 6:30 PM start."}
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        className="mt-1 h-5 w-5 accent-[var(--primary)]"
                        checked={respectCurfew}
                        onChange={(e) => setRespectCurfew(e.target.checked)}
                      />
                    </label>
                  </Card>

                  <Button className="mt-5 w-full" onClick={() => setStep(2)}>
                    Find our fair midpoint
                  </Button>
                </div>
              ) : null}

              {/* ---------- Step 3: reveal ---------- */}
              {step === 2 ? (
                <div key="step-2" className="animate-fade-in">
                  {venues.isError || defaults.isError ? (
                    <Card>
                      <p role="alert">
                        Couldn't find nearby spots. Check your connection and try again.
                      </p>
                      <Button
                        className="mt-3"
                        onClick={() => {
                          void venues.refetch();
                          void defaults.refetch();
                        }}
                      >
                        Try again
                      </Button>
                    </Card>
                  ) : revealing ? (
                    <RadarScan />
                  ) : (
                    <>
                      <h2 className="font-display text-2xl font-semibold">Top 3 fair spots</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Clustered around everyone's midpoint
                        {venues.data?.origin ? ` · ${venues.data.origin.label}` : ""}.
                      </p>

                      {pins.length ? (
                        <div className="mt-4">
                          <VenueMap venues={pins} onSelect={(id) => setPicked(id)} />
                        </div>
                      ) : null}

                      <div className="mt-4 space-y-2">
                        {top3.length ? (
                          top3.map((v, i) => (
                            <div key={v.key} className="relative">
                              <span
                                className="pointer-events-none absolute -left-1 -top-1 z-10 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-caption font-bold text-primary-foreground"
                                aria-hidden
                              >
                                {v.kind === "activity" ? (
                                  <Trophy className="h-3 w-3" />
                                ) : (
                                  <Utensils className="h-3 w-3" />
                                )}
                                #{i + 1}
                              </span>
                              <FairVenueCard
                                venue={v}
                                meProfileId={defaults.data?.me.profileId}
                                selected={picked === v.key}
                                onSelect={() => setPicked(picked === v.key ? null : v.key)}
                              />
                            </div>
                          ))
                        ) : (
                          <Card>
                            <p className="text-sm text-muted-foreground">
                              No spots matched that vibe and budget nearby. Go back and try another
                              vibe.
                            </p>
                          </Card>
                        )}
                      </div>

                      <Button className="mt-5 w-full" loading={create.isPending} onClick={launch}>
                        {create.isPending ? "Launching…" : "Launch this plan"}
                      </Button>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Shown while the engine balances drive times and resolves midpoint venues. */
function RadarScan() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center py-14">
      <ThinkingOrb state="solving" size={64} aria-hidden="true" />
      <p className="mt-5 font-display text-lg font-semibold">Calculating fair midpoint…</p>
      <p className="mt-1 text-sm text-muted-foreground">Balancing drive times across the squad</p>
      <div className="mt-6 w-full max-w-sm space-y-2">
        <Skeleton className="h-16 rounded-2xl" />
        <Skeleton className="h-16 rounded-2xl" />
      </div>
    </div>
  );
}
