import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { CalendarDays, Clock, CloudSun, MapPin, RotateCcw, Sparkles, Wallet } from "lucide-react";
import { Modal } from "@/components/quorum/Modal";
import { Button } from "@/components/quorum/ui";
import { toast } from "@/lib/quorum/toast";
import { cn } from "@/lib/utils";
import { SyncAvatar, type SyncMood } from "@/components/quorum/auth/SyncAvatar";
import { SyncSay, type SayLine } from "@/components/quorum/auth/SyncSay";
import { useAvatarFollow } from "@/components/quorum/auth/useAvatarFollow";
import { listGroups } from "@/lib/quorum/plan.functions";
import {
  itineraryForecast,
  launchItinerary,
  scoutItineraryStop,
  startItinerary,
  type ItineraryOrigin,
} from "@/lib/quorum/itinerary.functions";
import {
  STOP_KINDS,
  costRange,
  timeline,
  to12h,
  type Itinerary,
  type StopKind,
} from "@/lib/quorum/itinerary";
import { ItineraryTimeline, type StopStatus } from "./ItineraryTimeline";
import { PLAN_BUILDER_EVENT, type PlanBuilderRequest } from "./plan-builder-event";

const STARTERS = [
  "Dinner and bowling Friday at 7, under $30 each",
  "Boba then mini golf Saturday afternoon",
  "Movie night with dessert after, this weekend",
];
const TWEAKS = ["Make it cheaper", "Start an hour later", "Add dessert", "Fewer stops"];
const OUTDOOR: StopKind[] = ["park", "lake", "mini_golf", "theme_park"];
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

type Phase = "compose" | "building" | "review";
type Group = { id: string; name?: unknown; emoji?: unknown };

const weekday = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "long" });
const shortDate = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

/**
 * Magic AI plan: describe a hangout, and Sync builds the whole night -- the
 * stops in order, real venues for each, drive times, cost and the forecast --
 * in front of you, one real step at a time. Every line Sync says matches a
 * call that is actually running. Then the same timeline turns editable (swap
 * a spot, drop a stop, pick which stop the group votes on, reword the invite)
 * and launches as a plan where everyone still answers privately.
 *
 * Mounted once in the app shell; anything opens it with openPlanBuilder().
 */
export function PlanBuilderSheet() {
  const reduce = useReducedMotion();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("compose");
  const [prompt, setPrompt] = useState("");
  const [tweak, setTweak] = useState("");
  const [groupId, setGroupId] = useState<string | null>(null);
  const [it, setIt] = useState<Itinerary | null>(null);
  const [status, setStatus] = useState<Record<string, StopStatus>>({});
  const [mood, setMood] = useState<SyncMood>("idle");
  const [line, setLine] = useState<SayLine | null>(null);
  const [launching, setLaunching] = useState(false);
  const run = useRef(0);
  const moodTimer = useRef<number>(undefined);
  const { bind, follow, pulse } = useAvatarFollow();

  const groups = useQuery({
    queryKey: ["groups"],
    queryFn: useServerFn(listGroups),
    enabled: open,
  });
  const groupList = useMemo(() => (groups.data ?? []) as Group[], [groups.data]);
  const group = groupList.find((g) => g.id === groupId) ?? null;

  const startFn = useServerFn(startItinerary);
  const scoutFn = useServerFn(scoutItineraryStop);
  const forecastFn = useServerFn(itineraryForecast);
  const launchFn = useServerFn(launchItinerary);

  const say = useCallback((text: string) => setLine((l) => ({ text, id: (l?.id ?? 0) + 1 })), []);
  /** A brief expression that settles back to `after`. */
  const flash = useCallback((m: SyncMood, after: SyncMood, ms = 900) => {
    window.clearTimeout(moodTimer.current);
    setMood(m);
    moodTimer.current = window.setTimeout(() => setMood(after), ms);
  }, []);
  useEffect(() => () => window.clearTimeout(moodTimer.current), []);

  // Default to the first group once groups load, unless one was asked for.
  useEffect(() => {
    if (!groupId && groupList[0]) setGroupId(groupList[0].id);
  }, [groupId, groupList]);

  const build = useCallback(
    async (text: string, forGroup: string | null) => {
      const id = ++run.current;
      const alive = () => run.current === id;
      window.clearTimeout(moodTimer.current);
      setPhase("building");
      setIt(null);
      setStatus({});
      setMood("thinking");
      say("Reading your plan…");

      let draft;
      let origin: ItineraryOrigin | null;
      try {
        const res = await startFn({
          data: {
            prompt: text,
            groupId: forGroup,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        });
        draft = res.draft;
        origin = res.origin;
        if (!alive()) return;
        if (res.fairCount > 1) say(`Found the fair middle for ${res.fairCount} of you`);
      } catch (e) {
        if (!alive()) return;
        setPhase("compose");
        setMood("oops");
        toast.error("Sync couldn't plan that", {
          description: e instanceof Error ? e.message : "Try describing it again.",
        });
        return;
      }

      const shell: Itinerary = {
        version: 1,
        title: draft.title,
        vibe: draft.vibe,
        date: draft.date,
        start: draft.start,
        budgetPerPerson: draft.budgetPerPerson,
        areaLabel: origin?.label ?? null,
        zip: origin?.zip ?? null,
        anchor: draft.anchor,
        stops: draft.stops.map((s) => ({ ...s, options: [], pick: 0 })),
        invite: draft.invite,
        weather: null,
      };
      setIt(shell);
      setStatus(Object.fromEntries(shell.stops.map((s) => [s.id, "waiting" as const])));

      if (!origin) {
        setStatus({});
        setPhase("review");
        setMood("oops");
        say("Tell me where — add a city or ZIP");
        return;
      }

      setMood("curious");
      let near = origin;
      const used: string[] = [];
      const city = origin.label.split(",")[0] ?? origin.label;
      for (const [i, stop] of shell.stops.entries()) {
        if (!alive()) return;
        setStatus((s) => ({ ...s, [stop.id]: "scouting" }));
        say(`Scouting ${STOP_KINDS[stop.kind].label.toLowerCase()} near ${city}…`);
        let options: Itinerary["stops"][number]["options"] = [];
        try {
          options = await scoutFn({
            data: {
              kind: stop.kind,
              near: { lat: near.lat, lon: near.lon, label: near.label, zip: near.zip },
              radiusMiles: i === 0 ? (draft.searchRadiusMiles ?? 10) : 6,
              maxSpend: draft.budgetPerPerson,
              exclude: used,
            },
          });
        } catch {
          options = [];
        }
        if (!alive()) return;
        used.push(...options.map((o) => o.key));
        setIt((cur) =>
          cur
            ? { ...cur, stops: cur.stops.map((s) => (s.id === stop.id ? { ...s, options } : s)) }
            : cur,
        );
        setStatus((s) => ({ ...s, [stop.id]: "done" }));
        const top = options[0];
        if (top) {
          near = { ...near, lat: top.lat, lon: top.lon };
          say(`${top.title} looks good`);
          flash("happy", "curious");
        } else {
          flash("oops", "curious");
        }
      }

      if (draft.date && alive()) {
        setMood("thinking");
        say(`Checking ${weekday(draft.date)}'s weather…`);
        try {
          const weather = await forecastFn({
            data: { lat: origin.lat, lon: origin.lon, date: draft.date },
          });
          if (alive()) setIt((cur) => (cur ? { ...cur, weather } : cur));
        } catch {
          /* the night still works without a forecast */
        }
      }
      if (!alive()) return;
      setStatus({});
      setPhase("review");
      flash("celebrate", "smile", 1600);
      say("Here's your night — tap a spot to swap it");
    },
    [startFn, scoutFn, forecastFn, say, flash],
  );

  useEffect(() => {
    const onOpen = (e: Event) => {
      const req = (e as CustomEvent<PlanBuilderRequest>).detail ?? {};
      setOpen(true);
      if (req.groupId) setGroupId(req.groupId);
      if (req.prompt) setPrompt(req.prompt);
      if (req.autoStart && req.prompt) void build(req.prompt, req.groupId ?? groupId);
      else if (phase !== "review") {
        setPhase("compose");
        setMood("idle");
        setLine(null);
      }
    };
    window.addEventListener(PLAN_BUILDER_EVENT, onOpen);
    return () => window.removeEventListener(PLAN_BUILDER_EVENT, onOpen);
  }, [build, groupId, phase]);

  const close = () => {
    // Closing mid-build drops whatever is still in flight.
    if (phase === "building") {
      run.current++;
      setPhase("compose");
    }
    setOpen(false);
  };

  const startOver = () => {
    run.current++;
    setPhase("compose");
    setIt(null);
    setMood("idle");
    setLine(null);
  };

  const rebuild = (change: string) => {
    const c = change.trim();
    if (!c) return;
    setTweak("");
    void build(`${prompt.trim()}. Change: ${c}`, groupId);
  };

  const launch = async () => {
    if (!it || !groupId) return;
    const kept = it.stops.filter((s) => s.options.length);
    if (!kept.length) {
      toast.error("No spots to launch", { description: "Rebuild or try a different area." });
      return;
    }
    const anchorId = it.stops[it.anchor]?.id;
    const anchor = Math.max(
      0,
      kept.findIndex((s) => s.id === anchorId),
    );
    setLaunching(true);
    setMood("thinking");
    try {
      const res = await launchFn({
        data: {
          groupId,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          itinerary: { ...it, stops: kept, anchor },
        },
      });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["groups"] });
      void qc.invalidateQueries({ queryKey: ["group", groupId] });
      toast.success("Plan launched", {
        description: `Sent to ${String(group?.name ?? "your group")} — everyone answers privately next.`,
      });
      setOpen(false);
      startOver();
      setPrompt("");
      void navigate({ to: "/plans/$planId", params: { planId: res.planId } });
    } catch (e) {
      setMood("oops");
      toast.error("Couldn't launch that plan", {
        description: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setLaunching(false);
    }
  };

  const edit = (fn: (cur: Itinerary) => Itinerary) => setIt((cur) => (cur ? fn(cur) : cur));
  const timed = it ? timeline(it) : null;
  const cost = it ? costRange(it) : null;
  const overBudget = Boolean(it?.budgetPerPerson && cost && cost.min > it.budgetPerPerson);
  const outdoorRisk = Boolean(
    it?.weather?.outdoorRisk && it.stops.some((s) => OUTDOOR.includes(s.kind)),
  );
  const busy = phase === "building";

  return (
    <Modal
      open={open}
      onClose={close}
      title={phase === "compose" ? "Plan with Sync" : (it?.title ?? "Building your night")}
      description={
        phase === "compose"
          ? "Describe the hangout. Sync builds the whole night with real spots."
          : (it?.vibe ?? undefined)
      }
      footer={
        phase === "review" && it ? (
          <div className="space-y-2.5">
            {groupList.length > 1 ? (
              <GroupChips groups={groupList} value={groupId} onChange={setGroupId} />
            ) : null}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="h-11"
                onClick={startOver}
                aria-label="Start over"
              >
                <RotateCcw className="size-4" aria-hidden />
              </Button>
              <Button
                className="h-11 flex-1"
                loading={launching}
                orb="shaping"
                disabled={!groupId || !it.stops.some((s) => s.options.length)}
                onClick={() => void launch()}
              >
                {groupId ? `Launch in ${String(group?.name ?? "group")}` : "Join a group to launch"}
              </Button>
            </div>
          </div>
        ) : phase === "compose" ? (
          <Button
            className="h-11 w-full"
            disabled={!prompt.trim()}
            onClick={() => void build(prompt.trim(), groupId)}
          >
            <Sparkles className="size-4" aria-hidden /> Build my night
          </Button>
        ) : null
      }
    >
      {/* Sync stays put across every phase; only its layout around it changes. */}
      <motion.div
        layout={reduce ? false : true}
        transition={{ duration: 0.3, ease: EASE_OUT }}
        className={cn(
          "flex items-center",
          phase === "review" ? "mb-3 gap-3" : "mb-2 flex-col gap-1 pt-1",
        )}
      >
        <motion.div layout={reduce ? false : "position"} className="shrink-0">
          <SyncAvatar
            mood={phase === "compose" && follow ? "watching" : mood}
            follow={phase === "compose" ? follow : null}
            pulse={pulse}
            size={phase === "review" ? 52 : 88}
          />
        </motion.div>
        <motion.div layout={reduce ? false : "position"} className="min-w-0">
          <SyncSay line={line} />
        </motion.div>
      </motion.div>
      {/* SyncSay is decorative; this is what assistive tech hears. */}
      <p role="status" aria-live="polite" className="sr-only">
        {busy ? (line?.text ?? "Building your night") : ""}
      </p>

      <AnimatePresence mode="wait" initial={false}>
        {phase === "compose" ? (
          <motion.div
            key="compose"
            initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(8px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.22, ease: EASE_OUT }}
            className="space-y-3"
            {...bind}
          >
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && prompt.trim()) {
                  void build(prompt.trim(), groupId);
                }
              }}
              aria-label="Describe your plan"
              placeholder="Dinner and bowling in Frisco this Friday around 7, under $30 each"
              className="min-h-24 w-full resize-y rounded-2xl border border-border bg-background px-3.5 py-2.5 outline-none transition-colors focus:border-primary/60"
            />
            <div className="flex flex-wrap gap-2" data-avatar-ignore>
              {STARTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setPrompt(s)}
                  className="tap-target pressable active:pressable-active rounded-full border border-border px-3 py-2 text-xs font-medium hover:bg-secondary"
                >
                  {s}
                </button>
              ))}
            </div>
            {groupList.length ? (
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Plan it for</p>
                <GroupChips groups={groupList} value={groupId} onChange={setGroupId} />
              </div>
            ) : groups.isSuccess ? (
              <p className="text-xs text-muted-foreground">
                You can preview a night now. You'll need a group to launch it.
              </p>
            ) : null}
          </motion.div>
        ) : it ? (
          <motion.div
            key="night"
            initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(8px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            transition={{ duration: 0.24, ease: EASE_OUT }}
            className="space-y-4"
          >
            <AnimatePresence initial={false}>
              {phase === "review" && timed && cost ? (
                <motion.div
                  key="facts"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(6px)" }}
                  animate={{ opacity: 1, transform: "translateY(0px)" }}
                  transition={{ duration: 0.22, ease: EASE_OUT }}
                  className="flex flex-wrap gap-1.5 text-xs"
                >
                  {it.date ? (
                    <Fact icon={<CalendarDays />} text={shortDate(it.date)} />
                  ) : (
                    <Fact icon={<CalendarDays />} text="Pick a day with the group" />
                  )}
                  <Fact icon={<Clock />} text={`${to12h(it.start)} – ${to12h(timed.end)}`} />
                  {cost.max ? (
                    <Fact
                      icon={<Wallet />}
                      text={`$${cost.min}–${cost.max} each`}
                      tone={overBudget ? "warn" : undefined}
                    />
                  ) : null}
                  {it.areaLabel ? <Fact icon={<MapPin />} text={it.areaLabel} /> : null}
                  {it.weather ? (
                    <Fact
                      icon={<CloudSun />}
                      text={`${it.weather.emoji} ${it.weather.line}`}
                      tone={outdoorRisk ? "warn" : undefined}
                    />
                  ) : null}
                </motion.div>
              ) : null}
            </AnimatePresence>

            {phase === "building" && !it.stops.length ? null : (
              <ItineraryTimeline
                start={it.start}
                stops={it.stops}
                anchor={it.anchor}
                status={busy ? status : undefined}
                editable={phase === "review"}
                onPick={(si, oi) =>
                  edit((cur) => ({
                    ...cur,
                    stops: cur.stops.map((s, k) => (k === si ? { ...s, pick: oi } : s)),
                  }))
                }
                onRemove={(si) =>
                  edit((cur) => {
                    const stops = cur.stops.filter((_, k) => k !== si);
                    const anchor =
                      cur.anchor === si ? 0 : cur.anchor > si ? cur.anchor - 1 : cur.anchor;
                    return { ...cur, stops, anchor };
                  })
                }
                onAnchor={(si) => edit((cur) => ({ ...cur, anchor: si }))}
              />
            )}

            {phase === "review" ? (
              <motion.div
                initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(6px)" }}
                animate={{ opacity: 1, transform: "translateY(0px)" }}
                transition={{ duration: 0.22, ease: EASE_OUT, delay: reduce ? 0 : 0.08 }}
                className="space-y-3"
              >
                {overBudget ? (
                  <p className="rounded-2xl bg-warning/10 px-3 py-2 text-xs text-warning">
                    These picks run over the ${it.budgetPerPerson} you mentioned. Swap a spot or ask
                    Sync to make it cheaper.
                  </p>
                ) : null}
                {outdoorRisk ? (
                  <p className="rounded-2xl bg-warning/10 px-3 py-2 text-xs text-warning">
                    The forecast looks rough for an outdoor stop. Plan B Guardian will offer an
                    indoor swap once it's launched.
                  </p>
                ) : null}
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    Invite message
                  </span>
                  <textarea
                    value={it.invite}
                    maxLength={280}
                    onChange={(e) => edit((cur) => ({ ...cur, invite: e.target.value }))}
                    className="min-h-16 w-full resize-y rounded-2xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-primary/60"
                  />
                </label>
                <form
                  className="space-y-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    rebuild(tweak);
                  }}
                >
                  <span className="block text-xs font-medium text-muted-foreground">
                    Change something
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {TWEAKS.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => rebuild(t)}
                        className="tap-target pressable active:pressable-active rounded-full border border-border px-3 py-2 text-xs font-medium hover:bg-secondary"
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <input
                    value={tweak}
                    onChange={(e) => setTweak(e.target.value)}
                    enterKeyHint="go"
                    placeholder="Or say it: “swap bowling for an arcade”"
                    aria-label="Ask Sync to change the plan"
                    className="h-11 w-full rounded-2xl border border-border bg-background px-3.5 text-sm outline-none transition-colors focus:border-primary/60"
                  />
                </form>
              </motion.div>
            ) : null}
          </motion.div>
        ) : (
          <motion.div
            key="reading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            className="space-y-3"
            aria-hidden
          >
            {[0, 1, 2].map((k) => (
              <div key={k} className="flex gap-3">
                <span className="skeleton size-10 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2 pt-1">
                  <span className="skeleton block h-3 w-24" />
                  <span className="skeleton block h-4 w-40" />
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}

function Fact({ icon, text, tone }: { icon: React.ReactNode; text: string; tone?: "warn" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 [&_svg]:size-3.5",
        tone === "warn" ? "border-warning/40 text-warning" : "border-border text-foreground/85",
      )}
    >
      {icon}
      {text}
    </span>
  );
}

function GroupChips({
  groups,
  value,
  onChange,
}: {
  groups: Group[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Group" className="flex flex-wrap gap-1.5" data-avatar-ignore>
      {groups.map((g) => {
        const on = g.id === value;
        return (
          <button
            key={g.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(g.id)}
            className={cn(
              "tap-target pressable active:pressable-active inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-150",
              on ? "border-primary/60 bg-primary/10" : "border-border hover:bg-secondary",
            )}
          >
            {g.emoji ? <span aria-hidden>{String(g.emoji)}</span> : null}
            {String(g.name ?? "Group")}
          </button>
        );
      })}
    </div>
  );
}
