import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, Card, Pill } from "@/components/quorum/ui";
import {
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
  const [sosArmed, setSosArmed] = useState(false);

  const ping = useServerFn(pushLocation);
  const checkins = useQuery({
    queryKey: ["my-checkins"],
    queryFn: useServerFn(getMyCheckins),
    refetchInterval: 60_000,
  });

  const answer = useMutation({
    mutationFn: useServerFn(respondToCheckin),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["my-checkins"] });
      toast.success("Check-in sent");
    },
  });
  const delay = useMutation({
    mutationFn: useServerFn(sendDelay),
    onSuccess: () => {
      setDelayOpen(false);
      toast.success("Heads-up sent to your parents");
    },
  });
  const sos = useMutation({
    mutationFn: useServerFn(raiseSos),
    onSuccess: () => {
      setSosArmed(false);
      toast.success("SOS sent", { description: "Your parents were alerted right away." });
    },
  });

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
        <Pill tone={sharing ? "good" : "neutral"}>{sharing ? "Live" : "Private"}</Pill>
      </div>

      <div className="flex flex-wrap gap-2">
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
    </Card>
  );
}
