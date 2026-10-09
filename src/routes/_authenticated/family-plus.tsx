import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Check, ChevronLeft } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { GuardianShell } from "@/components/quorum/GuardianShell";
import { Card, Pill, Skeleton } from "@/components/quorum/ui";
import { DynamicButton } from "@/components/quorum/DynamicButton";
import { HoldToConfirmButton } from "@/components/quorum/HoldToConfirmButton";
import {
  cancelFamilyPlus,
  getMyFamilyPlan,
  startFamilyPlus,
} from "@/lib/quorum/family-plan.functions";
import {
  FAMILY_PLUS,
  FREE_LIMITS,
  yearlySavingPct,
  type BillingInterval,
  type MyFamilyPlan,
} from "@/lib/quorum/family-plan";
import { haptic } from "@/lib/quorum/haptics";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/family-plus")({
  head: () => ({
    meta: [
      { title: "Family Plus — Syncly" },
      {
        name: "description",
        content:
          "Optional extras for parents: unlimited safe zones, every teen and parent in one family, and 30 days of history.",
      },
    ],
  }),
  component: FamilyPlusPage,
});

const ROWS: { label: string; free: string; plus: string }[] = [
  { label: "Plan approvals, live radar & check-ins", free: "Included", plus: "Included" },
  {
    label: "Safe zones per teen",
    free: String(FREE_LIMITS.safeZonesPerTeen),
    plus: "Unlimited",
  },
  { label: "Teens", free: String(FREE_LIMITS.teensPerGuardian), plus: "Every teen" },
  { label: "Parents per teen", free: String(FREE_LIMITS.guardiansPerTeen), plus: "Every parent" },
  {
    label: "Alert & check-in history",
    free: `${FREE_LIMITS.historyHours} hours`,
    plus: "30 days",
  },
];

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" });

const priceLabel = (interval: BillingInterval) =>
  interval === "year" ? `$${FAMILY_PLUS.yearly}/yr` : `$${FAMILY_PLUS.monthly}/mo`;

function FamilyPlusPage() {
  const qc = useQueryClient();
  const plan = useQuery({ queryKey: ["family-plan"], queryFn: useServerFn(getMyFamilyPlan) });
  const [interval, setBillingInterval] = useState<BillingInterval>("year");

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["family-plan"] });
    void qc.invalidateQueries({ queryKey: ["guardian-hub"] });
  };
  const start = useMutation({
    mutationFn: useServerFn(startFamilyPlus),
    onSuccess: () => {
      haptic("success");
      refresh();
      toast.success("Family Plus is on", {
        description: "Unlimited safe zones and 30 days of history are ready on your family hub.",
      });
    },
    onError: (e: unknown) =>
      toast.error("Couldn't start Family Plus", {
        description: e instanceof Error ? e.message : "Try again.",
      }),
  });
  const cancel = useMutation({
    mutationFn: useServerFn(cancelFamilyPlus),
    onSuccess: (p: MyFamilyPlan) => {
      refresh();
      toast.success("Family Plus canceled", {
        description: p.periodEnd ? `It stays on until ${fmtDate(p.periodEnd)}.` : undefined,
      });
    },
    onError: (e: unknown) =>
      toast.error("Couldn't cancel", {
        description: e instanceof Error ? e.message : "Try again.",
      }),
  });

  const p = plan.data;
  const ownsPlus = p?.tier === "plus";
  const coveredByFamily = p?.tier === "free" && p.familyTier === "plus";

  return (
    <GuardianShell
      title={FAMILY_PLUS.name}
      subtitle="Optional extras for parents. Everything your teen uses stays free."
    >
      <Link
        to="/guardian"
        className="-mt-2 mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Family hub
      </Link>

      {plan.isLoading || !p ? (
        <div className="space-y-3">
          <Skeleton className="h-28 rounded-surface" />
          <Skeleton className="h-64 rounded-surface" />
        </div>
      ) : (
        <div className="space-y-4">
          <Card className={cn("space-y-2", (ownsPlus || coveredByFamily) && "border-primary/40")}>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Your plan</span>
              <Pill tone={ownsPlus || coveredByFamily ? "accent" : "neutral"}>
                {ownsPlus || coveredByFamily ? FAMILY_PLUS.name : "Free"}
              </Pill>
              {p.status === "trialing" ? <Pill tone="good">Founding trial</Pill> : null}
              {p.status === "canceled" ? <Pill tone="warn">Canceled</Pill> : null}
            </div>
            <p className="text-sm text-muted-foreground">
              {ownsPlus && p.periodEnd
                ? p.status === "canceled"
                  ? `Family Plus stays on until ${fmtDate(p.periodEnd)}, then your family moves to the free plan.`
                  : p.status === "trialing"
                    ? `Free until ${fmtDate(p.periodEnd)}. Nothing is charged: billing isn't set up yet, and we'll ask before that changes.`
                    : `Renews ${fmtDate(p.periodEnd)} at ${priceLabel(p.interval ?? "month")}.`
                : coveredByFamily
                  ? "Another parent in your family has Family Plus, so it covers you too."
                  : "Approvals, live radar and check-ins are free for every family."}
            </p>
          </Card>

          <Card className="p-0">
            <table className="w-full text-sm">
              <caption className="sr-only">Free plan compared with Family Plus</caption>
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th scope="col" className="px-4 py-3 font-medium">
                    What you get
                  </th>
                  <th scope="col" className="px-2 py-3 font-medium">
                    Free
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold text-primary">
                    Plus
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ROWS.map((r) => (
                  <tr key={r.label}>
                    <th scope="row" className="px-4 py-3 text-left font-medium">
                      {r.label}
                    </th>
                    <td className="px-2 py-3 text-muted-foreground">{r.free}</td>
                    <td className="px-4 py-3 font-medium">{r.plus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {ownsPlus && p.status !== "canceled" ? null : (
            <Card className="space-y-4">
              <IntervalToggle value={interval} onChange={setBillingInterval} />
              {ownsPlus ? (
                <DynamicButton
                  width="full"
                  loading={start.isPending}
                  onClick={() => start.mutate({ data: { interval } })}
                >
                  {start.isPending ? "Turning it back on…" : "Keep Family Plus"}
                </DynamicButton>
              ) : p.trialAvailable ? (
                <>
                  <DynamicButton
                    width="full"
                    loading={start.isPending}
                    onClick={() => start.mutate({ data: { interval } })}
                  >
                    {start.isPending
                      ? "Starting your trial…"
                      : `Start ${FAMILY_PLUS.foundingTrialMonths} months free`}
                  </DynamicButton>
                  <p className="text-center text-xs text-muted-foreground">
                    Founding families get {FAMILY_PLUS.foundingTrialMonths} months free, then{" "}
                    {priceLabel(interval)}. No payment details needed: billing isn't set up yet.
                  </p>
                </>
              ) : (
                <DynamicButton width="full" disabled>
                  Paid plans open soon
                </DynamicButton>
              )}
            </Card>
          )}

          <p className="px-1 text-xs text-muted-foreground">
            Family Plus adds room, not visibility. It never unlocks your teen's private planning
            answers or anything they haven't chosen to share.
          </p>

          {ownsPlus && p.status !== "canceled" ? (
            <HoldToConfirmButton
              className="w-full"
              loading={cancel.isPending}
              confirmedContent="Canceling…"
              onConfirm={() => cancel.mutate({})}
            >
              Hold to cancel Family Plus
            </HoldToConfirmButton>
          ) : null}
        </div>
      )}
    </GuardianShell>
  );
}

function IntervalToggle({
  value,
  onChange,
}: {
  value: BillingInterval;
  onChange: (v: BillingInterval) => void;
}) {
  const options: { id: BillingInterval; label: string; price: string; note?: string }[] = [
    { id: "month", label: "Monthly", price: priceLabel("month") },
    {
      id: "year",
      label: "Yearly",
      price: priceLabel("year"),
      note: `Save ${yearlySavingPct()}%`,
    },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Billing"
      className="grid grid-cols-2 gap-1 rounded-2xl bg-secondary p-1"
    >
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => {
              haptic("select");
              onChange(o.id);
            }}
            className="tap-target relative rounded-xl px-3 py-2 text-left"
          >
            {active ? (
              <motion.span
                layoutId="family-plus-interval"
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
                className="absolute inset-0 rounded-xl bg-background shadow-sm"
              />
            ) : null}
            <span className="relative block text-sm font-semibold">
              {o.label}
              {o.note ? (
                <span className="ml-1.5 text-xs font-medium text-success">{o.note}</span>
              ) : null}
            </span>
            <span className="relative block text-xs text-muted-foreground tabular-nums">
              {o.price}
            </span>
          </button>
        );
      })}
    </div>
  );
}
