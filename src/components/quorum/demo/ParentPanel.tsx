import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Car, Check, Clock, Home, ShieldCheck, X } from "lucide-react";
import { Pill } from "@/components/quorum/ui";
import { haptic } from "@/lib/quorum/haptics";
import { buildTransportPlan, type ScoredOption } from "@/lib/quorum/engine";
import type { DemoMember } from "@/lib/quorum/demo-group";
import { SlideToApprove } from "./SlideToApprove";
import { Chip, SPRING, clock, clockRange } from "./shared";

type Decision = "pending" | "approved" | "conditional" | "declined";

const CONDITIONS = ["20:30", "21:00"];

/*
 * Parents are a first-class user: they get a link, no app, no account. The
 * demo plays that out for the first friend whose plan needs a parent's yes.
 * A condition is attached privately to that teen and the plan re-checks
 * itself through the same engine, so a "home by" really can change the pick.
 */
export function ParentPanel({
  members,
  shown,
  anyFeasible,
  onCondition,
  onClearCondition,
}: {
  members: DemoMember[];
  shown: ScoredOption;
  anyFeasible: boolean;
  onCondition: (memberId: string, latestEnd: string) => void;
  onClearCondition: () => void;
}) {
  const reduce = useReducedMotion();
  const teen = members.find((m) => m.constraints.parentApprovalRequired) ?? members[0]!;
  const [decision, setDecision] = useState<Decision>("pending");
  const [condition, setCondition] = useState(CONDITIONS[0]!);
  const [choosing, setChoosing] = useState(false);

  // A plain approval is for one specific plan, so ask again if it changes. A
  // condition is the exception: it changes the plan itself, and the parent
  // already answered for what came out of it.
  const key = shown.option.key;
  useEffect(() => {
    setDecision((d) => (d === "approved" ? "pending" : d));
    setChoosing(false);
  }, [key]);

  const transport = shown.option.requiresDriving
    ? buildTransportPlan(
        shown.option,
        members.map((m) => ({ profileId: m.id, name: m.name, constraints: m.constraints })),
      )
    : null;
  const myCar = transport?.cars.find(
    (c) => c.driver === teen.name || c.passengers.includes(teen.name),
  );
  const home = teen.constraints.latestEnd;

  const decide = (d: Decision) => {
    haptic(d === "declined" ? "warn" : "success");
    setDecision(d);
    setChoosing(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight">{teen.name}'s parent</h2>
        <Pill tone="accent">
          <ShieldCheck className="size-3" /> Family Hub
        </Pill>
      </div>
      <p className="mt-1.5 text-sm text-pretty text-muted-foreground">
        {teen.name}'s plan needs a yes from home. The parent gets a link. No app, no account.
      </p>

      <div className="mt-4 overflow-hidden rounded-3xl border border-border bg-card">
        <div className="border-b border-border bg-secondary/60 px-4 py-2.5 text-xs text-muted-foreground">
          syncly.website/approve · from {teen.name}
        </div>
        <div className="p-4">
          <div className="text-sm text-muted-foreground">{teen.name} would like to go to</div>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={key}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28 }}
              className="mt-0.5 text-xl leading-tight font-semibold"
            >
              {anyFeasible ? shown.option.title : "a plan the group is still working out"}
            </motion.div>
          </AnimatePresence>

          {anyFeasible && (
            <ul className="mt-3 space-y-2 text-[0.9375rem]">
              <li className="flex items-center gap-2.5">
                <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="tabular-nums">
                  {clockRange(shown.option.start, shown.option.end)}
                </span>
              </li>
              <li className="flex items-center gap-2.5">
                <Car className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                {transport
                  ? myCar
                    ? myCar.driver === teen.name
                      ? `${teen.name} is driving`
                      : `Ride with ${myCar.driver}, both ways`
                    : `${teen.name} still needs a ride`
                  : "Close enough to walk, no ride needed"}
              </li>
              <li className="flex items-center gap-2.5">
                <Home className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                {home ? `Home by ${clock(home)}` : "No curfew set"}
              </li>
            </ul>
          )}

          <div className="mt-4" aria-live="polite">
            <AnimatePresence mode="wait" initial={false}>
              {decision === "pending" && (
                <motion.div
                  key="ask"
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-2"
                >
                  <SlideToApprove
                    label="Slide to approve"
                    disabled={!anyFeasible}
                    onApprove={() => decide("approved")}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={!anyFeasible}
                      onClick={() => setChoosing((c) => !c)}
                      aria-expanded={choosing}
                      className="pressable active:pressable-active min-h-12 rounded-full border border-border px-3 text-sm font-semibold disabled:opacity-40"
                    >
                      Approve if…
                    </button>
                    <button
                      type="button"
                      disabled={!anyFeasible}
                      onClick={() => decide("declined")}
                      className="pressable active:pressable-active min-h-12 rounded-full border border-border px-3 text-sm font-semibold text-destructive disabled:opacity-40"
                    >
                      Decline
                    </button>
                  </div>
                  <AnimatePresence initial={false}>
                    {choosing && (
                      <motion.div
                        initial={reduce ? false : { height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="rounded-2xl bg-secondary p-3">
                          <div className="mb-2 text-sm text-muted-foreground">Condition</div>
                          <div className="grid grid-cols-2 gap-2">
                            {CONDITIONS.map((t) => (
                              <Chip key={t} on={condition === t} onClick={() => setCondition(t)}>
                                Home by {clock(t)}
                              </Chip>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              onCondition(teen.id, condition);
                              decide("conditional");
                            }}
                            className="pressable active:pressable-active mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground"
                          >
                            Send with condition
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

              {decision !== "pending" && (
                <motion.div
                  key={decision}
                  initial={reduce ? false : { opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={SPRING}
                  className={
                    decision === "declined"
                      ? "rounded-2xl bg-destructive/10 p-3.5 text-destructive"
                      : "rounded-2xl bg-success/12 p-3.5 text-success"
                  }
                >
                  <div className="flex items-center gap-2 font-semibold">
                    {decision === "declined" ? (
                      <X className="size-4" />
                    ) : (
                      <Check className="size-4" />
                    )}
                    {decision === "approved" && "Approved"}
                    {decision === "conditional" && `Approved, home by ${clock(condition)}`}
                    {decision === "declined" && "Declined"}
                  </div>
                  <p className="mt-1 text-sm text-pretty text-foreground/80">
                    {decision === "approved" && `${teen.name} is cleared to go.`}
                    {decision === "conditional" &&
                      "The condition goes to " +
                        teen.name +
                        " privately and the plan re-checked itself. The group only sees whether it works."}
                    {decision === "declined" &&
                      "The group sees that a plan is waiting on a parent. Not who, and not why."}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {decision !== "pending" && (
        <button
          type="button"
          onClick={() => {
            if (decision === "conditional") onClearCondition();
            setDecision("pending");
          }}
          className="tap-target mt-2 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          Ask again
        </button>
      )}
    </div>
  );
}
