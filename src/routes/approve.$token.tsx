import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Button, Card, Pill, Skeleton, inputClass } from "@/components/quorum/ui";
import { Wordmark } from "@/components/quorum/Wordmark";
import { getApproval, respondToApproval } from "@/lib/quorum/approval.functions";
import { ParentSummaryView } from "@/components/quorum/ParentSummaryView";

export const Route = createFileRoute("/approve/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Approve a plan — Syncly" },
      {
        name: "description",
        content:
          "Review the plan details, timing, and ride arrangements, then approve, add a condition, or decline.",
      },
      { property: "og:title", content: "Approve a plan — Syncly" },
      { property: "og:description", content: "Review the plan and respond. No account needed." },
    ],
  }),
  component: ApprovePage,
});

function ApprovePage() {
  const { token } = Route.useParams();
  // "<planId>.<sig>" (a signed link from getSummaryShareLink) renders the
  // full parent summary; a bare dashless-hex approval token renders the
  // per-member permission request. The signature is what makes the plan-id
  // branch safe -- a plan id alone is not a secret (every group member can
  // see it), so it's never trusted without a valid sig.
  const dot = token.indexOf(".");
  if (dot > 0) {
    const planId = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    return (
      <main className="mx-auto min-h-dvh max-w-lg px-4 py-10">
        <Wordmark className="mx-auto mb-8 h-7" />
        <ParentSummaryView planId={planId} sig={sig} />
      </main>
    );
  }
  return <TokenApproval token={token} />;
}

function TokenApproval({ token }: { token: string }) {
  const qc = useQueryClient();
  const fetchApproval = useServerFn(getApproval);
  const q = useQuery({
    queryKey: ["approval", token],
    queryFn: () =>
      fetchApproval({
        data: { token, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      }),
  });
  const [condition, setCondition] = useState("");
  const [error, setError] = useState<string | null>(null);

  const respond = useMutation({
    mutationFn: useServerFn(respondToApproval),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["approval", token] }),
    onError: (e: Error) => setError(e.message),
  });

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-4 py-10">
      <Wordmark className="mx-auto mb-8 h-7" />
      {q.isLoading ? <Skeleton className="h-56 rounded-surface" /> : null}
      {!q.isLoading && !q.data ? (
        <Card>
          <h1 className="font-display text-xl font-semibold">This link isn't valid</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            It may have expired or already been used. Ask for a fresh link.
          </p>
        </Card>
      ) : null}
      {q.data ? (
        <Card>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {q.data.childName} is asking to go
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            You're seeing only this plan. Nothing else about the group is shared with you.
          </p>

          <dl className="mt-6 space-y-2.5 text-sm">
            <Row label="Plan" value={q.data.planTitle} />
            {q.data.details ? (
              <>
                <Row
                  label="Where"
                  value={`${q.data.details.title} · ${q.data.details.location_name ?? ""}`}
                />
                <Row
                  label="When"
                  value={`${q.data.date ?? "Date TBC"} · ${q.data.details.suggested_start}–${q.data.details.suggested_end}`}
                />
                <Row
                  label="Cost"
                  value={`$${q.data.details.cost_min}–$${q.data.details.cost_max} per person`}
                />
              </>
            ) : (
              <Row label="When" value={q.data.date ?? "Date to be confirmed"} />
            )}
            {q.data.cars.length ? (
              <Row
                label="Getting home"
                value={q.data.cars.map((c) => `${c.driver_label} (${c.car_label})`).join(", ")}
              />
            ) : null}
          </dl>

          {q.data.status !== "pending" ? (
            <div className="mt-6">
              <Pill
                tone={
                  q.data.status === "declined"
                    ? "bad"
                    : q.data.status === "approved"
                      ? "good"
                      : "warn"
                }
              >
                You responded: {q.data.status.replace(/_/g, " ")}
                {q.data.conditionText ? ` — ${q.data.conditionText}` : ""}
              </Pill>
            </div>
          ) : (
            <div className="mt-7 space-y-3">
              <Button
                className="w-full"
                disabled={respond.isPending}
                onClick={() => respond.mutate({ data: { token, decision: "approved" } })}
              >
                Approve
              </Button>
              <div className="space-y-2">
                <input
                  aria-label="Approval condition"
                  enterKeyHint="done"
                  className={inputClass}
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  placeholder="Add a condition, e.g. home by 10:00 PM"
                />
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={!condition.trim() || respond.isPending}
                  onClick={() =>
                    respond.mutate({
                      data: { token, decision: "approved_with_condition", condition },
                    })
                  }
                >
                  Approve with this condition
                </Button>
              </div>
              <Button
                variant="ghost"
                className="w-full"
                disabled={respond.isPending}
                onClick={() => respond.mutate({ data: { token, decision: "declined" } })}
              >
                Decline
              </Button>
              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
            </div>
          )}
        </Card>
      ) : null}
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border pb-2.5 last:border-0">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium [overflow-wrap:anywhere]">{value}</dd>
    </div>
  );
}
