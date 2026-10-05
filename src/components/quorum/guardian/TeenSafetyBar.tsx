import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, Card, Pill } from "@/components/quorum/ui";
import { CheckCircle2, ChevronDown, MapPin, Share2 } from "lucide-react";
import {
  arrivedSafely,
  getMyCheckins,
  pushLocation,
  raiseSos,
  respondToCheckin,
  sendDelay,
} from "@/lib/quorum/guardian.functions";

const DELAY_REASONS = [
  { label: "Traffic", minutes: 15 },
  { label: "Waiting on a ride", minutes: 20 },
  { label: "Food is taking longer", minutes: 25 },
  { label: "Leaving now", minutes: 10 },
];

async function currentPosition(): Promise<GeolocationPosition | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return null;
  return new Promise((resolve) =>
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(p),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 },
    ),
  );
}

async function batteryPct(): Promise<number | null> {
  const nav = navigator as Navigator & { getBattery?: () => Promise<{ level: number }> };
  if (!nav.getBattery) return null;
  try {
    const b = await nav.getBattery();
    return Math.round(b.level * 100);
  } catch {
    return null;
  }
}

/**
 * Teen-facing safety strip: discreet delay ping, one-tap check-in answers and
 * a hold-to-send SOS. When location sharing is on it quietly pushes a ping
 * every few minutes so the parent radar stays current.
 */
export function TeenSafetyBar({ sharing }: { sharing: boolean }) {
  const qc = useQueryClient();
  const [delayOpen, setDelayOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [sosArmed, setSosArmed] = useState(false);
  const [arrival, setArrival] = useState<{ place: string; at: string } | null>(null);

  const ping = useServerFn(pushLocation);
  const checkins = useQuery({
    queryKey: ["my-checkins"],
    queryFn: useServerFn(getMyCheckins),
    refetchInterval: 60_000,
  });

  const answer = useMutation({
    mutationFn: useServerFn(respondToCheckin),
    onError: (e: Error) => toast.error("Couldn't send your check-in", { description: e.message }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["my-checkins"] });
      toast.success("Check-in sent");
    },
  });
  const delay = useMutation({
    mutationFn: useServerFn(sendDelay),
    onError: (e: Error) => toast.error("Couldn't send your heads-up", { description: e.message }),
    onSuccess: () => {
      setDelayOpen(false);
      toast.success("Heads-up sent to your parents");
    },
  });
  const sos = useMutation({
    mutationFn: useServerFn(raiseSos),
    onError: (e: Error) =>
      toast.error("SOS was not sent. Contact your parent directly", { description: e.message }),
    onSuccess: () => {
      setSosArmed(false);
      toast.success("SOS sent", { description: "Your parents were alerted right away." });
    },
  });

  const arrive = useMutation({
    mutationFn: useServerFn(arrivedSafely),
    onError: (e: Error) => toast.error("Couldn't share your arrival", { description: e.message }),
    onSuccess: () => {
      setArrival({
        place: "your destination",
        at: new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
      });
      toast.success("Arrival shared with your parents");
    },
  });

  /** Opens the native SMS sheet pre-filled with a live session link. */
  const shareLiveSession = () => {
    const url = `${window.location.origin}/radar`;
    const body = encodeURIComponent(`I'm sharing my live location on Syncly: ${url}`);
    window.location.href = `sms:?&body=${body}`;
  };

  const sendPing = useCallback(async () => {
    const pos = await currentPosition();
    if (!pos) return;
    await ping({
      data: {
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        accuracyM: Math.round(pos.coords.accuracy),
        batteryPct: await batteryPct(),
      },
    }).catch(() => null);
  }, [ping]);

  useEffect(() => {
    if (!sharing) return;
    void sendPing();
    const t = setInterval(() => void sendPing(), 4 * 60_000);
    return () => clearInterval(t);
  }, [sharing, sendPing]);

  const pending = checkins.data ?? [];

  return (
    <Card className="space-y-3 border-emerald-500/20">
      {pending.length > 0 ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
          <div className="text-sm font-semibold">A parent asked for a quick check-in</div>
          {pending[0]?.note ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{pending[0].note}</p>
          ) : null}
          <Button
            className="mt-3 w-full"
            loading={answer.isPending}
            onClick={async () => {
              const pos = await currentPosition();
              answer.mutate({
                data: {
                  id: pending[0]!.id,
                  lat: pos?.coords.latitude ?? null,
                  lon: pos?.coords.longitude ?? null,
                  placeLabel: pos ? "Shared my location" : "I'm okay",
                },
              });
            }}
          >
            I&apos;m okay — share my spot
          </Button>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">Safety</div>
          <div className="text-xs text-muted-foreground">
            {sharing ? "Location shared with linked parents" : "Location sharing is off"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Pill tone={sharing ? "good" : "neutral"}>{sharing ? "Live" : "Private"}</Pill>
          <button
            type="button"
            onClick={() => setToolsOpen((v) => !v)}
            aria-expanded={toolsOpen}
            className="tap-target inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
          >
            Safety tools
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${toolsOpen ? "rotate-180" : ""}`}
              aria-hidden
            />
          </button>
        </div>
      </div>

      {arrival ? (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-400">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          Arrived safely at {arrival.place} • {arrival.at}
        </div>
      ) : null}

      {toolsOpen ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Button
              loading={arrive.isPending}
              onClick={async () => {
                const pos = await currentPosition();
                arrive.mutate({
                  data: {
                    lat: pos?.coords.latitude ?? null,
                    lon: pos?.coords.longitude ?? null,
                    batteryPct: await batteryPct(),
                    placeLabel: "my destination",
                  },
                });
              }}
            >
              <MapPin className="h-4 w-4" aria-hidden /> I arrived safely
            </Button>
            <Button variant="outline" onClick={shareLiveSession}>
              <Share2 className="h-4 w-4" aria-hidden /> Share live session
            </Button>
            <Button variant="outline" onClick={() => setDelayOpen((v) => !v)}>
              Running late
            </Button>
            <Button
              variant={sosArmed ? "danger" : "outline"}
              loading={sos.isPending}
              onClick={async () => {
                if (!sosArmed) {
                  setSosArmed(true);
                  setTimeout(() => setSosArmed(false), 5000);
                  return;
                }
                const pos = await currentPosition();
                sos.mutate({
                  data: {
                    lat: pos?.coords.latitude ?? null,
                    lon: pos?.coords.longitude ?? null,
                  },
                });
              }}
            >
              {sosArmed ? "Tap again to send SOS" : "SOS"}
            </Button>
          </div>

          {delayOpen ? (
            <div className="flex flex-wrap gap-2">
              {DELAY_REASONS.map((r) => (
                <button
                  key={r.label}
                  type="button"
                  className="tap-target rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary"
                  onClick={() => delay.mutate({ data: { reason: r.label, minutes: r.minutes } })}
                >
                  {r.label} · +{r.minutes}m
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}
