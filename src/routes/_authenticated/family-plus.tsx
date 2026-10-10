import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { toast } from "@/lib/quorum/toast";
import { GuardianShell } from "@/components/quorum/GuardianShell";
import { Card, Pill, Skeleton } from "@/components/quorum/ui";
import { DynamicButton } from "@/components/quorum/DynamicButton";
import { HoldToConfirmButton } from "@/components/quorum/HoldToConfirmButton";
import {
  RECEIPT_FEED_MS,
  ReceiptPrinter,
  type ReceiptPrinterStage,
} from "@/components/quorum/ReceiptPrinter";
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
    onSuccess: refresh,
    onError: (e: unknown) =>
      toast.error("Couldn't start Family Plus", {
        description: e instanceof Error ? e.message : "Try again.",
      }),
  });

  // Starting the trial plays the receipt printer: it "processes" while the
  // request runs (at least long enough to read), then feeds out the receipt.
  const [receipt, setReceipt] = useState<{
    stage: ReceiptPrinterStage;
    interval: BillingInterval;
    plan?: MyFamilyPlan;
  } | null>(null);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const startTrial = () => {
    const startedAt = Date.now();
    setReceipt({ stage: "processing", interval });
    start.mutate(
      { data: { interval } },
      {
        onSuccess: (plan: MyFamilyPlan) => {
          later(
            () => {
              setReceipt({ stage: "printing", interval, plan });
              later(() => {
                haptic("success");
                setReceipt({ stage: "complete", interval, plan });
              }, RECEIPT_FEED_MS);
            },
            Math.max(0, 900 - (Date.now() - startedAt)),
          );
        },
        onError: () => setReceipt(null),
      },
    );
  };

  const resume = () =>
    start.mutate(
      { data: { interval } },
      {
        onSuccess: () => {
          haptic("success");
          toast.success("Family Plus stays on");
        },
      },
    );
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
                    ? `Free until ${fmtDate(p.periodEnd)}. No credit card on file, and we'll ask before anything is ever charged.`
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
                <DynamicButton width="full" loading={start.isPending} onClick={resume}>
                  {start.isPending ? "Turning it back on…" : "Keep Family Plus"}
                </DynamicButton>
              ) : p.trialAvailable ? (
                <>
                  <DynamicButton width="full" disabled={receipt !== null} onClick={startTrial}>
                    {`Start ${FAMILY_PLUS.foundingTrialMonths} months free`}
                  </DynamicButton>
                  <p className="text-center text-xs text-muted-foreground">
                    No credit card needed. Founding families get {FAMILY_PLUS.foundingTrialMonths}{" "}
                    months free, then {priceLabel(interval)}.
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

      <AnimatePresence>
        {receipt ? (
          <TrialReceipt
            key="receipt"
            stage={receipt.stage}
            interval={receipt.interval}
            plan={receipt.plan}
            onClose={() => setReceipt(null)}
          />
        ) : null}
      </AnimatePresence>
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

const RECEIPT_LABELS: Record<ReceiptPrinterStage, string> = {
  processing: "Starting your free trial",
  printing: "Printing your receipt",
  complete: "You're a founding family",
};

// Fixed bar widths so the barcode looks the same every time.
const BARCODE = [
  2, 1, 3, 1, 1, 2, 4, 1, 2, 1, 1, 3, 2, 1, 3, 1, 2, 2, 1, 4, 1, 1, 2, 3, 1, 2, 1, 3, 2, 1, 1, 2,
];

function ReceiptRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3", strong && "text-sm font-bold")}>
      <span>{label}</span>
      <span className="text-right tabular-nums">{value}</span>
    </div>
  );
}

function TrialReceipt({
  stage,
  interval,
  plan,
  onClose,
}: {
  stage: ReceiptPrinterStage;
  interval: BillingInterval;
  plan?: MyFamilyPlan;
  onClose: () => void;
}) {
  const shouldReduceMotion = useReducedMotion();
  const done = stage === "complete";
  const hubRef = useRef<HTMLAnchorElement>(null);
  const [printedAt] = useState(() => new Date());

  useEffect(() => {
    if (done) hubRef.current?.focus();
  }, [done]);
  useEffect(() => {
    if (!done) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [done, onClose]);

  const rule = (
    <div aria-hidden className="my-3 border-t border-dashed border-current opacity-30" />
  );

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Your Family Plus trial"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[60] flex flex-col items-center overflow-y-auto bg-background/90 px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-[calc(env(safe-area-inset-top)+2rem)] backdrop-blur-sm"
    >
      <ReceiptPrinter.Root stage={stage} labels={RECEIPT_LABELS} aria-label="Family Plus receipt">
        <ReceiptPrinter.Machine>
          <ReceiptPrinter.Header>
            <span className="pt-0.5 font-display text-xs font-semibold tracking-[0.2em] text-[oklch(0.7_0.05_168)]">
              SYNCLY
            </span>
            <span
              aria-hidden
              className={cn(
                "mt-1.5 size-1.5 rounded-full transition-colors duration-300",
                stage === "processing"
                  ? "bg-[oklch(0.74_0.13_62)] shadow-[0_0_8px_oklch(0.74_0.13_62)]"
                  : "bg-[oklch(0.8_0.15_155)] shadow-[0_0_8px_oklch(0.8_0.15_155)]",
              )}
            />
          </ReceiptPrinter.Header>
          <ReceiptPrinter.Screen>
            <ReceiptPrinter.Status />
          </ReceiptPrinter.Screen>
        </ReceiptPrinter.Machine>

        <ReceiptPrinter.Output className="h-[27rem]">
          <ReceiptPrinter.Paper className="text-[11px] leading-relaxed">
            <div className="text-center">
              <div className="text-sm font-bold tracking-[0.3em]">SYNCLY</div>
              <div className="mt-1 uppercase tracking-wider">Founding family receipt</div>
              <div className="opacity-60">
                {printedAt.toLocaleString([], {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </div>
            </div>
            {rule}
            <ReceiptRow label="Plan" value={FAMILY_PLUS.name} />
            <ReceiptRow label="Billing" value={interval === "year" ? "Yearly" : "Monthly"} />
            <ReceiptRow label="Free trial" value={`${FAMILY_PLUS.foundingTrialMonths} months`} />
            <ReceiptRow label="Then" value={priceLabel(interval)} />
            {rule}
            <ReceiptRow label="Due today" value="$0.00" strong />
            <ReceiptRow label="Card on file" value="None" />
            {rule}
            <ReceiptRow
              label="Trial ends"
              value={plan?.periodEnd ? fmtDate(plan.periodEnd) : "—"}
            />
            <p className="mt-2 text-center opacity-70">
              We'll ask before anything is ever charged.
            </p>
            <div aria-hidden className="mx-auto mt-4 flex h-8 w-fit items-stretch gap-[2px]">
              {BARCODE.map((w, i) => (
                <span
                  key={i}
                  className={i % 2 === 0 ? "bg-current" : "bg-transparent"}
                  style={{ width: w * 1.5 }}
                />
              ))}
            </div>
            <p className="mt-3 text-center uppercase tracking-wider">Thanks for being early</p>
          </ReceiptPrinter.Paper>
        </ReceiptPrinter.Output>
      </ReceiptPrinter.Root>

      <AnimatePresence>
        {done ? (
          <motion.div
            initial={{ opacity: 0, transform: shouldReduceMotion ? "none" : "translateY(8px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
            className="-mt-2 flex w-full max-w-sm flex-col gap-2"
          >
            <Link
              ref={hubRef}
              to="/guardian"
              className="tap-target pressable active:pressable-active inline-flex w-full items-center justify-center rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
            >
              Go to family hub
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="tap-target rounded-2xl px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              Done
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
