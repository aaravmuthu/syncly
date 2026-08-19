import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/quorum/AppShell";
import { Avatar } from "@/components/quorum/Avatar";
import { Button, Card, Empty, Field, Pill, Skeleton, inputClass } from "@/components/quorum/ui";
import { TeenRadarMap } from "@/components/quorum/guardian/TeenRadarMap";
import {
  addSafeZone,
  askForCheckin,
  decidePlanApproval,
  getGuardianHub,
  linkTeen,
  markAlertsRead,
  removeSafeZone,
} from "@/lib/quorum/guardian.functions";
import { AddressPicker } from "@/components/quorum/AddressPicker";
import type { TeenCard } from "@/lib/quorum/guardian.types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/guardian")({
  validateSearch: (search: Record<string, unknown>): { invite?: string } =>
    typeof search.invite === "string"
      ? { invite: search.invite.replace(/\D/g, "").slice(0, 6) }
      : {},
  head: () => ({
    meta: [
      { title: "Family hub — Syncly" },
      {
        name: "description",
        content:
          "See every plan, ride and safe-zone update for your teens in one calm dashboard — approvals, carpool details and check-ins included.",
      },
      { property: "og:title", content: "Family hub — Syncly" },
      {
        property: "og:description",
        content: "Plans, rides, safe zones and check-ins for your teens in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GuardianHub,
});

const fmtTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" }) : "TBD";

const ago = (iso: string) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
};

function GuardianHub() {
  const qc = useQueryClient();
  const { invite } = Route.useSearch();
  const navigate = Route.useNavigate();
  const hub = useQuery({
    queryKey: ["guardian-hub"],
    queryFn: useServerFn(getGuardianHub),
    refetchInterval: 60_000,
  });
  const [activeTeen, setActiveTeen] = useState<string | null>(null);
  const [code, setCode] = useState(invite ?? "");

  const link = useMutation({
    mutationFn: useServerFn(linkTeen),
    onSuccess: (r: { teenName: string }) => {
      setCode("");
      void navigate({ search: {}, replace: true });
      void qc.invalidateQueries({ queryKey: ["guardian-hub"] });
      toast.success(`Linked to ${r.teenName}`, {
        description: "Their live radar is now on your family hub.",
      });
    },
    onError: (e: unknown) =>
      toast.error("Couldn't link that code", {
        description: e instanceof Error ? e.message : "Try again.",
      }),
  });
  const readAlerts = useMutation({ mutationFn: useServerFn(markAlertsRead) });

  const teens = hub.data?.teens ?? [];
  useEffect(() => {
    if (!activeTeen && teens.length) setActiveTeen(teens[0]!.id);
  }, [teens, activeTeen]);
  useEffect(() => {
    if (hub.data?.unreadAlerts) readAlerts.mutate(undefined as never);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hub.data?.unreadAlerts]);

  // Arriving from a teen's invite link: link the account automatically, once.
  const autoLinked = useRef(false);
  useEffect(() => {
    if (!invite || invite.length !== 6 || autoLinked.current || hub.isLoading) return;
    autoLinked.current = true;
    link.mutate({ data: { code: invite } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invite, hub.isLoading]);

  const teen = teens.find((t) => t.id === activeTeen) ?? teens[0] ?? null;

  return (
    <AppShell title="Family hub" subtitle="Plans, rides and safe arrivals — no group chatter.">
      <Link
        to="/radar"
        className="glass-card mb-4 flex items-center justify-between gap-3 p-4 text-sm transition hover:border-primary/40"
      >
        <span>
          <span className="block font-semibold">Open live radar</span>
          <span className="block text-xs text-muted-foreground">
            Live pins, battery levels and curfew countdowns for every teen.
          </span>
        </span>
        <span className="text-primary" aria-hidden>
          →
        </span>
      </Link>
      {hub.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 rounded-3xl" />
          <Skeleton className="h-64 rounded-3xl" />
        </div>
      ) : teens.length === 0 ? (
        <Card className="space-y-4">
          <Empty
            title="Link your first teen"
            body="Ask them to open Syncly → Profile → Parent pairing and read you the 6-digit code."
          />
          <div className="flex gap-2">
            <input
              className={cn(inputClass, "text-center text-lg tracking-[0.3em] tabular-nums")}
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            />
            <Button loading={link.isPending} onClick={() => link.mutate({ data: { code } })}>
              Link
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1">
            {teens.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTeen(t.id)}
                className={cn(
                  "tap-target flex snap-start items-center gap-2 rounded-2xl border px-3 py-2 transition",
                  t.id === teen?.id
                    ? "border-emerald-500/50 bg-emerald-500/10"
                    : "border-border hover:bg-secondary",
                )}
              >
                <Avatar url={t.avatar_url} emoji={t.emoji} name={t.name} size={28} />
                <span className="whitespace-nowrap text-sm font-medium">{t.name}</span>
                <span className="text-xs text-muted-foreground">{t.status.emoji}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setActiveTeen("__add")}
              className="tap-target snap-start whitespace-nowrap rounded-2xl border border-dashed border-border px-3 py-2 text-sm text-muted-foreground"
            >
              + Add teen
            </button>
          </div>

          {activeTeen === "__add" ? (
            <Card className="space-y-3">
              <div className="text-sm font-semibold">Link another teen</div>
              <div className="flex gap-2">
                <input
                  className={cn(inputClass, "text-center text-lg tracking-[0.3em] tabular-nums")}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                />
                <Button loading={link.isPending} onClick={() => link.mutate({ data: { code } })}>
                  Link
                </Button>
              </div>
            </Card>
          ) : teen ? (
            <TeenPanel teen={teen} />
          ) : null}

          {(hub.data?.alerts ?? []).length > 0 ? (
            <Card className="space-y-2">
              <div className="text-sm font-semibold">Recent alerts</div>
              {(hub.data?.alerts ?? []).slice(0, 8).map((a) => (
                <div
                  key={a.id}
                  className={cn(
                    "rounded-2xl border px-3 py-2",
                    a.priority === "high"
                      ? "border-destructive/40 bg-destructive/10"
                      : "border-border",
                  )}
                >
                  <div className="text-sm font-medium">{a.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.body ? `${a.body} · ` : ""}
                    {ago(a.created_at)}
                  </div>
                </div>
              ))}
            </Card>
          ) : null}
        </div>
      )}
    </AppShell>
  );
}

function TeenPanel({ teen }: { teen: TeenCard }) {
  const qc = useQueryClient();
  const refresh = () => void qc.invalidateQueries({ queryKey: ["guardian-hub"] });

  const checkin = useMutation({
    mutationFn: useServerFn(askForCheckin),
    onSuccess: () => toast.success("Check-in requested"),
  });
  const decide = useMutation({
    mutationFn: useServerFn(decidePlanApproval),
    onSuccess: () => {
      refresh();
      toast.success("Response sent");
    },
  });
  const addZone = useMutation({
    mutationFn: useServerFn(addSafeZone),
    onSuccess: () => {
      refresh();
      toast.success("Safe zone added");
    },
  });
  const dropZone = useMutation({
    mutationFn: useServerFn(removeSafeZone),
    onSuccess: refresh,
  });

  const [zoneOpen, setZoneOpen] = useState(false);
  const [zoneLabel, setZoneLabel] = useState("");
  const [zoneKind, setZoneKind] = useState("venue");
  const [zonePoint, setZonePoint] = useState<{ lat: number; lon: number } | null>(null);
  const [zoneRadius, setZoneRadius] = useState(200);

  const pendingApprovals = teen.plans.filter(
    (p) => p.approval && p.approval.status === "pending",
  );

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar url={teen.avatar_url} emoji={teen.emoji} name={teen.name} size={44} />
            <div>
              <div className="font-display text-lg font-semibold">{teen.name}</div>
              <div className="text-xs text-muted-foreground">
                {teen.school ? `${teen.school} · ` : ""}
                {teen.curfew ? `Curfew ${teen.curfew.slice(0, 5)}` : "No curfew set"}
              </div>
            </div>
          </div>
          <Pill tone={teen.status.tone}>
            {teen.status.emoji} {teen.status.label}
          </Pill>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {teen.location ? (
            <>
              <span>Updated {ago(teen.location.at)}</span>
              {teen.location.battery_pct != null ? (
                <Pill tone={teen.location.battery_pct < 20 ? "bad" : "neutral"}>
                  🔋 {teen.location.battery_pct}%
                </Pill>
              ) : null}
              {teen.location.accuracy_m != null ? (
                <span>±{teen.location.accuracy_m}m</span>
              ) : null}
            </>
          ) : (
            <span>{teen.sharing ? "Waiting for the first ping" : "Location sharing is off"}</span>
          )}
        </div>

        <TeenRadarMap teen={teen} />

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            loading={checkin.isPending}
            onClick={() => checkin.mutate({ data: { teenProfileId: teen.id } })}
          >
            Ask for a check-in
          </Button>
          <Button variant="ghost" onClick={() => setZoneOpen((v) => !v)}>
            Safe zones ({teen.zones.length})
          </Button>
        </div>

        {teen.checkins.some((c) => c.status === "answered") ? (
          <div className="rounded-2xl bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
            Last check-in:{" "}
            {teen.checkins.find((c) => c.status === "answered")?.place_label ?? "shared"} ·{" "}
            {ago(teen.checkins.find((c) => c.status === "answered")!.created_at)}
          </div>
        ) : null}

        {zoneOpen ? (
          <div className="space-y-3 rounded-2xl border border-border p-3">
            {teen.zones.map((z) => (
              <div key={z.id} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  {z.label}{" "}
                  <span className="text-xs text-muted-foreground">
                    · {z.kind} · {z.radius_m}m
                  </span>
                </span>
                <Button
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => dropZone.mutate({ data: { zoneId: z.id } })}
                >
                  Remove
                </Button>
              </div>
            ))}
            <Field label="Add a safe zone" hint="You'll get a ping on arrival and departure.">
              <input
                className={inputClass}
                placeholder="Label (Home, School, Practice)"
                value={zoneLabel}
                onChange={(e) => setZoneLabel(e.target.value)}
              />
            </Field>
            <AddressPicker
              value={zoneLabel}
              placeholder="Search the address"
              onPick={(p) => setZonePoint({ lat: p.lat, lon: p.lon })}
            />
            <div className="flex flex-wrap gap-2">
              {["home", "school", "venue", "friend"].map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setZoneKind(k)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium",
                    zoneKind === k ? "border-emerald-500/50 bg-emerald-500/10" : "border-border",
                  )}
                >
                  {k}
                </button>
              ))}
              {[150, 250, 500].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setZoneRadius(r)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium",
                    zoneRadius === r ? "border-emerald-500/50 bg-emerald-500/10" : "border-border",
                  )}
                >
                  {r}m
                </button>
              ))}
            </div>
            <Button
              className="w-full"
              loading={addZone.isPending}
              disabled={!zoneLabel || !zonePoint}
              onClick={() =>
                zonePoint &&
                addZone.mutate({
                  data: {
                    teenProfileId: teen.id,
                    label: zoneLabel,
                    kind: zoneKind,
                    lat: zonePoint.lat,
                    lon: zonePoint.lon,
                    radiusM: zoneRadius,
                  },
                })
              }
            >
              Save zone
            </Button>
          </div>
        ) : null}
      </Card>

      {pendingApprovals.length > 0 ? (
        <Card className="space-y-3 border-emerald-500/25">
          <div className="text-sm font-semibold">Waiting on you</div>
          {pendingApprovals.map((p) => (
            <div key={p.id} className="rounded-2xl border border-border p-3">
              <div className="font-medium">{p.title}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {p.group_name} · {fmtTime(p.window_start)}
                {p.venue ? ` · ${p.venue}` : ""}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {p.est_cost_max != null ? (
                  <Pill tone="neutral">
                    ~${Math.round(p.est_cost_min ?? 0)}–{Math.round(p.est_cost_max)}
                  </Pill>
                ) : null}
                {p.drive_minutes != null ? <Pill tone="neutral">{p.drive_minutes} min away</Pill> : null}
                <Pill tone={p.adult_supervised ? "good" : "warn"}>
                  {p.adult_supervised ? "Adult supervised" : "No adult listed"}
                </Pill>
                <Pill tone="neutral">{p.attendees.length} going</Pill>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  loading={decide.isPending}
                  onClick={() =>
                    decide.mutate({
                      data: { approvalId: p.approval!.id, decision: "approved" },
                    })
                  }
                >
                  Approve
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    decide.mutate({
                      data: {
                        approvalId: p.approval!.id,
                        decision: "approved_with_condition",
                        condition: "Home by curfew, text me when you leave",
                      },
                    })
                  }
                >
                  Approve with condition
                </Button>
                <Button
                  variant="ghost"
                  className="text-destructive"
                  onClick={() =>
                    decide.mutate({
                      data: { approvalId: p.approval!.id, decision: "declined" },
                    })
                  }
                >
                  Not this time
                </Button>
              </div>
            </div>
          ))}
        </Card>
      ) : null}

      {teen.delays.length > 0 ? (
        <Card className="space-y-1">
          <div className="text-sm font-semibold">Delay pings</div>
          {teen.delays.slice(0, 3).map((d) => (
            <div key={d.id} className="text-xs text-muted-foreground">
              {d.reason} · +{d.minutes}m · {ago(d.created_at)}
            </div>
          ))}
        </Card>
      ) : null}

      {teen.plans.length === 0 ? (
        <Empty title="No plans yet" body={`${teen.name} hasn't joined a plan this week.`} />
      ) : (
        teen.plans.map((p) => (
          <Card key={p.id} className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-display font-semibold">{p.title}</div>
                <div className="text-xs text-muted-foreground">
                  {p.group_name} · {fmtTime(p.window_start)}
                </div>
              </div>
              <Pill tone={p.status === "finalized" ? "good" : "neutral"}>{p.status}</Pill>
            </div>

            {p.venue ? (
              <div className="rounded-2xl bg-secondary/50 px-3 py-2 text-sm">
                📍 {p.venue}
                {p.address ? (
                  <span className="block text-xs text-muted-foreground">{p.address}</span>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-1.5">
              {p.est_cost_max != null ? (
                <Pill tone="neutral">
                  Estimated tab ~${Math.round(p.est_cost_min ?? 0)}–{Math.round(p.est_cost_max)}
                </Pill>
              ) : null}
              {p.drive_minutes != null ? <Pill tone="neutral">{p.drive_minutes} min drive</Pill> : null}
              {p.approval ? (
                <Pill
                  tone={
                    p.approval.status.startsWith("approved")
                      ? "good"
                      : p.approval.status === "declined"
                        ? "bad"
                        : "warn"
                  }
                >
                  {p.approval.status.replace(/_/g, " ")}
                </Pill>
              ) : null}
            </div>

            {p.rides.length > 0 ? (
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Carpool
                </div>
                {p.rides.map((r) => (
                  <div
                    key={r.id}
                    className={cn(
                      "rounded-2xl border px-3 py-2 text-sm",
                      r.carries_my_teen ? "border-emerald-500/40 bg-emerald-500/5" : "border-border",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">
                        🚗 {r.driver_name}
                        <span className="text-xs font-normal text-muted-foreground">
                          {" "}
                          · {r.leg} · {r.passengers} riders
                        </span>
                      </span>
                      {r.departed_at ? <Pill tone="good">Left {ago(r.departed_at)}</Pill> : null}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {r.vehicle ?? "Vehicle not shared"}
                      {r.plate ? ` · plate ${r.plate}` : ""}
                      {r.eta_minutes ? ` · ~${r.eta_minutes} min` : ""}
                    </div>
                    {r.driver_phone ? (
                      <a
                        href={`tel:${r.driver_phone}`}
                        className="mt-1 inline-block text-xs font-medium text-primary"
                      >
                        Call driver
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            {p.parentNetwork.length > 0 ? (
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Other parents going
                </div>
                <div className="flex flex-wrap gap-2">
                  {p.parentNetwork.map((g) => (
                    <div
                      key={g.id}
                      className="flex items-center gap-2 rounded-2xl border border-border px-2.5 py-1.5"
                    >
                      <Avatar url={g.avatar_url} emoji={g.emoji} name={g.name} size={24} />
                      <div className="text-xs">
                        <div className="font-medium">{g.name}</div>
                        <div className="text-muted-foreground">{g.teen_name}&apos;s parent</div>
                      </div>
                      {g.phone ? (
                        <a href={`tel:${g.phone}`} className="text-xs font-medium text-primary">
                          Call
                        </a>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </Card>
        ))
      )}
    </div>
  );
}
