import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, ChevronRight, Clock, MapPin, TriangleAlert } from "lucide-react";
import { AvatarStack, CostBadge, formatWhen, type DashPlan } from "./DashboardParts";
import { QuickResponse } from "./QuickResponse";
import { categoryIcon } from "@/lib/quorum/icons";
import { cn } from "@/lib/utils";

const spring = { type: "spring", stiffness: 320, damping: 28 } as const;

/** "Starts in 2h 10m" style lead time, iOS Live Activity flavoured. */
function leadTime(iso: string | null) {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "Happening now";
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `Starts in ${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `Starts in ${h}h ${mins % 60}m`;
  return `Starts in ${Math.round(h / 24)}d`;
}

/**
 * iOS Live Activity style plan pass. Morphs between three states in place:
 * action needed → confirmed pass → collapsed conflict indicator.
 */
export function LiveActivityCard({ plan, className }: { plan: DashPlan; className?: string }) {
  const [editing, setEditing] = useState(false);
  const [localState, setLocalState] = useState<boolean | null>(null);
  const state = localState ?? plan.i_attending ?? null;
  const Icon = categoryIcon(plan.category);
  const rec = plan.selected_recommendation;
  const where = rec?.location_name ?? rec?.title ?? plan.location_area ?? null;
  const lead = leadTime(plan.window_start);

  // Collapsed conflict indicator.
  if (state === false && !editing) {
    return (
      <motion.div
        layout
        transition={spring}
        className={cn(
          "flex items-center gap-3 rounded-surface border border-border bg-card/40 px-4 py-3 backdrop-blur-3xl",
          className,
        )}
      >
        <TriangleAlert className="h-4 w-4 shrink-0 text-warning" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{plan.title}</p>
          <p className="truncate text-xs font-medium text-muted-foreground">
            Conflict reported • Host notified
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="shrink-0 text-xs font-semibold text-primary"
        >
          Change response
        </button>
      </motion.div>
    );
  }

  const confirmed = state === true && !editing;

  return (
    <motion.article
      layout
      transition={spring}
      className={cn(
        "relative overflow-hidden rounded-surface border bg-card/40 p-5 backdrop-blur-3xl",
        confirmed ? "border-primary/25 shadow-[0_0_60px_-24px_var(--primary)]" : "border-border",
        className,
      )}
    >
      {confirmed ? (
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-primary/20 blur-3xl"
        />
      ) : null}

      <div className="relative space-y-4">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-foreground/8">
            <Icon className="h-5 w-5 text-primary" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-muted-foreground">
              {plan.groups?.name ?? "Group"}
            </p>
            <Link to="/plans/$planId" params={{ planId: plan.id }}>
              <h3 className="line-clamp-2 text-xl font-bold tracking-tight">{plan.title}</h3>
            </Link>
          </div>
          <AnimatePresence initial={false}>
            {confirmed ? (
              <motion.span
                key="pass"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={spring}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1.5 text-xs font-semibold text-primary ring-1 ring-primary/40"
              >
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> You&apos;re in
              </motion.span>
            ) : null}
          </AnimatePresence>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground/6 px-2.5 py-1">
            <Clock className="h-3.5 w-3.5" aria-hidden /> {lead ?? formatWhen(plan.window_start)}
          </span>
          {where ? (
            <span className="inline-flex max-w-[60%] items-center gap-1.5 rounded-full bg-foreground/6 px-2.5 py-1">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">{where}</span>
            </span>
          ) : null}
          <CostBadge min={plan.est_cost_min} max={plan.est_cost_max} />
        </div>

        <div className="flex items-center justify-between gap-3">
          <AvatarStack people={plan.participants} max={5} />
          <Link
            to="/plans/$planId"
            params={{ planId: plan.id }}
            className="inline-flex items-center gap-0.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            Details <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>

        <AnimatePresence initial={false} mode="popLayout">
          {confirmed ? (
            <motion.button
              key="change"
              type="button"
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={spring}
              onClick={() => setEditing(true)}
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Change response
            </motion.button>
          ) : (
            <motion.div key="actions" layout transition={spring}>
              <QuickResponse
                planId={plan.id}
                variant="stacked"
                alwaysShowButtons
                answered={state}
                onAnswered={(v) => {
                  setLocalState(v);
                  setEditing(false);
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.article>
  );
}
