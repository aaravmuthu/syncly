import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button, Card, Pill, Skeleton, inputClass } from "./ui";
import { VenueMap } from "./VenueMap";
import { Avatar } from "./Avatar";
import { prettyTime } from "./TimePicker";
import { estCostLabel } from "@/lib/quorum/estcost";
import { getParentSummary, parentRespondToPlan } from "@/lib/quorum/approval.functions";

export function ParentSummaryView({ planId }: { planId: string }) {
  const qc = useQueryClient();
  const fetchSummary = useServerFn(getParentSummary);
  const q = useQuery({
    queryKey: ["parent-summary", planId],
    queryFn: () => fetchSummary({ data: { planId } }),
  });
  const [note, setNote] = useState("");
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

  if (q.isLoading) return <Skeleton className="h-96 rounded-3xl" />;
  const s = q.data;
  if (!s)
    return (
      <Card>
        <h1 className="font-display text-xl font-semibold">This link isn't valid</h1>
        <p className="mt-2 text-sm text-muted-foreground">Ask for a fresh link.</p>
      </Card>
    );

  const cost =
    s.costMin != null || s.costMax != null
      ? `$${Math.round(s.costMin ?? 0)}–$${Math.round(s.costMax ?? s.costMin ?? 0)} per person`
      : "No cost listed";

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">{s.title}</h1>
            <p className="mt-1 text-sm capitalize text-muted-foreground">
              {s.category} · {s.date ?? "Date to be confirmed"}
            </p>
          </div>
          {s.parentDecision ? (
            <Pill tone="good">Parent approved</Pill>
          ) : (
            <Pill tone="accent">Awaiting your review</Pill>
          )}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          You're seeing only this plan's logistics. Nothing else about the group is shared.
        </p>
      </Card>

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
                <Avatar url={m.avatarUrl} emoji={m.emoji} name={m.name} size={26} />
                {m.name}
                {m.host ? <Pill tone="accent">Host</Pill> : null}
              </span>
              <span className="flex flex-wrap items-center gap-1.5">
                {m.distanceMiles != null ? (
                  <Pill tone="neutral">{m.distanceMiles} mi from home</Pill>
                ) : null}
                {m.curfew ? (
                  <Pill tone={m.curfewOk === false ? "warn" : "good"}>
                    Curfew {prettyTime(m.curfew)} ·{" "}
                    {m.curfewOk === false ? "Tight" : "Compliant"}
                  </Pill>
                ) : null}
                <Pill tone={m.confirmed ? "good" : "neutral"}>
                  {m.confirmed ? "Confirmed" : "Not confirmed"}
                </Pill>
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>Rides</SectionTitle>
        <div className="mt-3 space-y-2 text-sm">
          {s.cars.length === 0 ? (
            <p className="text-muted-foreground">
              No carpool arranged yet — members are getting there on their own.
            </p>
          ) : (
            s.cars.map((c, i) => (
              <div key={`${c.car_label}-${i}`} className="rounded-2xl bg-secondary/60 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{c.car_label}</span>
                  <Pill tone="neutral">{c.leg === "return" ? "Ride home" : "Ride there"}</Pill>
                </div>
                <p className="mt-1 text-muted-foreground">
                  {c.driver} is driving{c.riders.length ? ` · with ${c.riders.join(", ")}` : " · no riders yet"}
                  {c.seatsLeft != null
                    ? ` · ${c.seatsLeft} ${c.seatsLeft === 1 ? "seat" : "seats"} open`
                    : ""}
                </p>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card>
        <SectionTitle>Time & curfew</SectionTitle>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <Pill tone="neutral">Starts {prettyTime(s.startTime)}</Pill>
          <Pill tone="neutral">Home by {prettyTime(s.endTime)}</Pill>
          {s.curfewOk === null ? (
            <Pill tone="neutral">No curfew set</Pill>
          ) : s.curfewOk ? (
            <Pill tone="good">Curfew compliant ({prettyTime(s.curfewLimit)})</Pill>
          ) : (
            <Pill tone="warn">Late return vs {prettyTime(s.curfewLimit)}</Pill>
          )}
        </div>
      </Card>

      <Card>
        <SectionTitle>Where</SectionTitle>
        {s.venue ? (
          <>
            <p className="mt-2 text-sm font-medium">{s.venue.title}</p>
            <p className="text-sm text-muted-foreground">
              {s.venue.address ?? s.venue.locationName ?? "Address to be confirmed"}
            </p>
            {s.venue.category ? (
              <p className="mt-1 text-xs capitalize text-muted-foreground">{s.venue.category}</p>
            ) : null}
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
          </>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">The group hasn't locked a spot yet.</p>
        )}
      </Card>

      <Card>
        <SectionTitle>Estimated cost</SectionTitle>
        <p className="mt-2 font-display text-xl font-semibold">{cost}</p>
        {s.estCostMin != null || s.estCostMax != null ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Host's estimate: {estCostLabel(s.estCostMin, s.estCostMax)}
          </p>
        ) : null}
        {s.totalCostMin != null ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Group total ≈ ${Math.round(s.totalCostMin)}–$
            {Math.round(s.totalCostMax ?? s.totalCostMin)} across {s.roster.length}{" "}
            {s.roster.length === 1 ? "person" : "people"}
          </p>
        ) : null}
      </Card>

      {s.parentDecision ? (
        <Card>
          <Pill tone="good">You approved this plan</Pill>
          {s.parentDecision.note ? (
            <p className="mt-2 text-sm text-muted-foreground">Your note: {s.parentDecision.note}</p>
          ) : null}
        </Card>
      ) : (
        <Card className="space-y-3">
          <Button
            className="w-full"
            loading={respond.isPending}
            onClick={() => respond.mutate({ data: { planId, decision: "approved" } })}
          >
            Approve plan
          </Button>
          <input
            className={inputClass}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Send a note to the group — e.g. be home by 9:30 PM"
          />
          <Button
            variant="outline"
            className="w-full"
            disabled={!note.trim() || respond.isPending}
            onClick={() =>
              respond.mutate({ data: { planId, decision: "approved_with_condition", note } })
            }
          >
            Send quick note
          </Button>
          {sent ? <p className="text-sm text-success">Sent — they'll see it right away.</p> : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </Card>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</h2>
  );
}
