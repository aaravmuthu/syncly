import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button, Card, Pill, Skeleton, inputClass } from "./ui";
import { VenueMap } from "./VenueMap";
import { Avatar } from "./Avatar";
import { prettyTime } from "./time-format";
import { estCostLabel } from "@/lib/quorum/estcost";
import { directionsUrl } from "@/lib/quorum/vibes";
import { getParentSummary, parentRespondToPlan } from "@/lib/quorum/approval.functions";

export function ParentSummaryView({ planId, sig }: { planId: string; sig: string }) {
  const qc = useQueryClient();
  const fetchSummary = useServerFn(getParentSummary);
  const q = useQuery({
    queryKey: ["parent-summary", planId, sig],
    queryFn: () => fetchSummary({ data: { planId, sig } }),
    retry: false,
  });
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const respond = useMutation({
    mutationFn: useServerFn(parentRespondToPlan),
    onSuccess: () => {
      setSent(true);
      void qc.invalidateQueries({ queryKey: ["parent-summary", planId] });
    },
    onError: (e: Error) => setError(e.message),
  });

  if (q.isLoading) return <Skeleton className="h-96 rounded-surface" />;
  const s = q.data;
  if (!s)
    return (
      <Card className="text-center">
        <div className="text-4xl">🔎</div>
        <h1 className="mt-3 font-display text-xl font-semibold">
          This plan link is invalid or has expired
        </h1>
        <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
          The plan may have been cancelled or the link is no longer valid. Ask for a fresh link.
        </p>
      </Card>
    );

  const approved = Boolean(s.parentDecision);
  const cost =
    s.costMin != null || s.costMax != null
      ? `$${Math.round(s.costMin ?? 0)}–$${Math.round(s.costMax ?? s.costMin ?? 0)} per person`
      : s.estCostMin != null || s.estCostMax != null
        ? `${estCostLabel(s.estCostMin, s.estCostMax)} per person`
        : "No cost listed";
  const venueLine = [s.venue?.title, s.venue?.category].filter(Boolean).join(" • ");

  return (
    <div className="space-y-4">
      {/* a) Status + action banner */}
      <Card className="border-primary/25 bg-gradient-to-b from-primary/10 to-transparent">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Group Plan Summary for
            </p>
            <h1 className="font-display text-2xl font-semibold tracking-tight">{s.childName}</h1>
            <p className="mt-1 text-sm capitalize text-muted-foreground">
              {s.title} · {s.category} · {s.date ?? "Date to be confirmed"}
            </p>
          </div>
          {approved ? (
            <Pill tone="good">✓ Parent approved</Pill>
          ) : (
            <Pill tone="accent">Awaiting your review</Pill>
          )}
        </div>

        {approved ? (
          <div className="mt-4">
            <Pill tone="good">💚 You approved this plan</Pill>
            {s.parentDecision?.note ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Your note: {s.parentDecision.note}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button
                className="flex-1"
                loading={respond.isPending}
                onClick={() => respond.mutate({ data: { planId, sig, decision: "approved" } })}
              >
                Approve Plan 💚
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setShowNote((v) => !v)}>
                Send Quick Note to Group 💬
              </Button>
            </div>
            {showNote ? (
              <div className="space-y-2">
                <input
                  className={inputClass}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Approved — be home by 9:30 PM"
                />
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={!note.trim() || respond.isPending}
                  onClick={() =>
                    respond.mutate({
                      data: { planId, sig, decision: "approved_with_condition", note },
                    })
                  }
                >
                  Send note
                </Button>
              </div>
            ) : null}
            {sent ? (
              <p className="text-sm text-success">Sent — they'll see it right away.</p>
            ) : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          You're seeing only this plan's logistics. Nothing else about the group is shared.
        </p>
      </Card>

      {/* b) What & where */}
      <Card>
        <SectionTitle>What & where</SectionTitle>
        {s.venue ? (
          <>
            <p className="mt-2 font-display text-lg font-semibold">{venueLine || s.venue.title}</p>
            <p className="text-sm text-muted-foreground">
              {s.venue.address ?? s.venue.locationName ?? "Address to be confirmed"}
            </p>
            {s.venue.lat != null && s.venue.lon != null ? (
              <div className="mt-3">
                <VenueMap
                  venues={[
                    {
                      id: "venue",
                      title: s.venue.title,
                      lat: s.venue.lat,
                      lon: s.venue.lon,
                      selected: true,
                      kind: "food",
                    },
                  ]}
                />
              </div>
            ) : null}
            <a
              href={directionsUrl({
                lat: s.venue.lat,
                lon: s.venue.lon,
                address: s.venue.address,
                title: s.venue.title,
              })}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex rounded-2xl bg-secondary px-3.5 py-2 text-sm font-semibold hover:bg-secondary/70"
            >
              Open directions in Maps ↗
            </a>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">The group hasn't locked a spot yet.</p>
        )}
      </Card>

      {/* c) When & timeline */}
      <Card>
        <SectionTitle>When & timeline</SectionTitle>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <Pill tone="neutral">Starts {prettyTime(s.startTime)}</Pill>
          <Pill tone="neutral">Ends {prettyTime(s.endTime)}</Pill>
          <Pill tone="neutral">Home ≈ {prettyTime(s.returnTime ?? s.endTime)}</Pill>
        </div>
        <div className="mt-2">
          {s.curfewOk === null ? (
            <Pill tone="neutral">No curfew set on this account</Pill>
          ) : s.curfewOk ? (
            <Pill tone="good">
              ✓ Curfew compliant — expected home by {prettyTime(s.returnTime ?? s.endTime)} (curfew{" "}
              {prettyTime(s.curfewLimit)})
            </Pill>
          ) : (
            <Pill tone="warn">
              ⚠ Tight return — home ≈ {prettyTime(s.returnTime ?? s.endTime)} vs curfew{" "}
              {prettyTime(s.curfewLimit)}
            </Pill>
          )}
        </div>
      </Card>

      {/* d) Who is going */}
      <Card>
        <SectionTitle>Who is going</SectionTitle>
        <div className="mt-3 space-y-2">
          {s.roster.length === 0 ? (
            <p className="text-sm text-muted-foreground">No one has confirmed yet.</p>
          ) : null}
          {s.roster.map((m) => (
            <div
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-secondary/50 px-3 py-2"
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <Avatar url={m.avatarUrl} emoji={m.emoji} name={m.name} size={28} />
                {m.name}
                {m.host ? <Pill tone="accent">Host</Pill> : null}
              </span>
              <span className="flex flex-wrap items-center gap-1.5">
                {m.distanceMiles != null ? (
                  <Pill tone="neutral">{m.distanceMiles} mi from home</Pill>
                ) : null}
                <Pill tone={m.confirmed ? "good" : "neutral"}>
                  {m.confirmed ? "Confirmed" : "Not confirmed"}
                </Pill>
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* e) Rides & carpool */}
      <Card>
        <SectionTitle>Rides & carpool</SectionTitle>
        <div className="mt-3 space-y-2 text-sm">
          {s.cars.length === 0 ? (
            <p className="text-muted-foreground">
              No carpool arranged yet — members are getting there on their own (walking, dropped
              off, or rideshare).
            </p>
          ) : (
            s.cars.map((c, i) => (
              <div key={`${c.car_label}-${i}`} className="rounded-2xl bg-secondary/60 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    Driver: {c.driver}
                    {c.seatsLeft != null
                      ? ` — ${c.riders.length + 1} seats occupied, ${c.seatsLeft} open`
                      : ""}
                  </span>
                  <Pill tone="neutral">{c.leg === "return" ? "Ride home" : "Ride there"}</Pill>
                </div>
                <p className="mt-1 text-muted-foreground">
                  {c.riders.length
                    ? `Passengers: ${c.riders.join(", ")}`
                    : "No passengers assigned yet"}
                </p>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* f) Cost */}
      <Card>
        <SectionTitle>Financial requirement</SectionTitle>
        <p className="mt-2 font-display text-xl font-semibold">Estimated cost: {cost}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Covers food &amp; drinks or entry — extras like souvenirs aren't included.
        </p>
        {s.totalCostMin != null ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Group total ≈ ${Math.round(s.totalCostMin)}–$
            {Math.round(s.totalCostMax ?? s.totalCostMin)} across {s.roster.length}{" "}
            {s.roster.length === 1 ? "person" : "people"}
          </p>
        ) : null}
      </Card>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h2>
  );
}
