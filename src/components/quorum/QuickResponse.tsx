import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "motion/react";
import {
  Banknote,
  CalendarX,
  Check,
  CheckCircle2,
  Clock,
  Navigation,
  Pencil,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Modal } from "./Modal";
import { CONFLICT_REASONS, confirmAttendance, flagConflict } from "@/lib/quorum/conflict.functions";
import { haptic } from "@/lib/quorum/haptics";
import { cn } from "@/lib/utils";

const REASON_ICONS: Record<string, LucideIcon> = {
  budget: Banknote,
  curfew: Clock,
  distance: Navigation,
  schedule: CalendarX,
};

const spring = { type: "spring", stiffness: 300, damping: 25 } as const;

type DashCache = { plans?: { id: string; i_responded?: boolean; i_attending?: boolean | null }[] };

/**
 * The whole member response in two taps: "I'm In" or "Doesn't Work For Me"
 * followed by a single reason pill. Once answered the pair collapses into a
 * glowing status badge with an inline "Edit vote" trigger.
 */
export function QuickResponse({
  planId,
  compact = false,
  className,
  answered = null,
  variant = "pair",
  alwaysShowButtons = false,
  onAnswered,
}: {
  planId: string;
  compact?: boolean;
  className?: string;
  /** true = confirmed, false = conflict raised, null = not answered yet. */
  answered?: boolean | null;
  /** "stacked" = full-width primary action with a subtle secondary link. */
  variant?: "pair" | "stacked";
  /** Skip the built-in answered badge; the parent renders its own state. */
  alwaysShowButtons?: boolean;
  onAnswered?: (attending: boolean) => void;
}) {
  const qc = useQueryClient();
  const [picking, setPicking] = useState(false);
  const [local, setLocal] = useState<boolean | null>(null);
  const [editing, setEditing] = useState(false);

  const state = local ?? answered;
  const showButtons = alwaysShowButtons || editing || state === null || state === undefined;

  /** Instantly reflect the answer in the cached dashboard so cards move now. */
  const optimistic = (attending: boolean) => {
    setLocal(attending);
    onAnswered?.(attending);
    setEditing(false);
    qc.setQueryData(["dashboard"], (old: DashCache | undefined) => {
      if (!old?.plans) return old;
      return {
        ...old,
        plans: old.plans.map((p) =>
          p.id === planId ? { ...p, i_responded: true, i_attending: attending } : p,
        ),
      };
    });
  };

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["dashboard"] });
    void qc.invalidateQueries({ queryKey: ["plan", planId] });
  };

  const confirm = useMutation({
    mutationFn: useServerFn(confirmAttendance),
    onMutate: () => optimistic(true),
    onSuccess: () => {
      haptic("success");
      refresh();
      toast.success("You're in", { description: "The group can see you're confirmed." });
    },
    onError: (e: unknown) => {
      haptic("warn");
      setLocal(null);
      toast.error("Couldn't confirm", {
        description: e instanceof Error ? e.message : "Try again.",
      });
    },
  });

  const flag = useMutation({
    mutationFn: useServerFn(flagConflict),
    onMutate: () => {
      setPicking(false);
      optimistic(false);
    },
    onSuccess: (raw) => {
      const r = raw as { alternatives: number; kind: string };
      haptic("select");
      refresh();
      toast.success("Got it — the host knows", {
        description:
          r.kind === "budget"
            ? r.alternatives
              ? `${r.alternatives} cheaper options are up for a quick re-vote.`
              : "We asked the host to lower the cost estimate."
            : r.alternatives
              ? `${r.alternatives} adjusted options are up for a quick re-vote.`
              : "Your reason was shared without naming your details.",
      });
    },
    onError: (e: unknown) => {
      haptic("warn");
      setLocal(null);
      toast.error("Couldn't send that", {
        description: e instanceof Error ? e.message : "Try again.",
      });
    },
  });

  const busy = confirm.isPending || flag.isPending;

  return (
    <>
      <AnimatePresence mode="wait" initial={false}>
        {showButtons ? (
          <motion.div
            key="buttons"
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={spring}
            className={cn(
              variant === "stacked"
                ? "flex flex-col items-stretch gap-2"
                : "grid grid-cols-2 gap-2",
              className,
            )}
          >
            <motion.button
              type="button"
              disabled={busy}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
              transition={spring}
              onClick={() => confirm.mutate({ data: { planId, attending: true } })}
              className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded-2xl font-semibold transition-colors disabled:opacity-60",
                variant === "stacked"
                  ? "w-full bg-emerald-500 py-3.5 text-base text-black hover:bg-emerald-400"
                  : "bg-emerald-500/15 text-emerald-500 ring-1 ring-emerald-400/30 backdrop-blur-xl hover:bg-emerald-500/25",
                variant === "pair" && (compact ? "px-3 py-2 text-sm" : "px-4 py-3.5 text-base"),
              )}
            >
              <Check className="h-4 w-4" aria-hidden /> I&apos;m In
            </motion.button>
            <motion.button
              type="button"
              disabled={busy}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
              transition={spring}
              onClick={() => setPicking(true)}
              className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded-2xl font-semibold transition-colors disabled:opacity-60",
                variant === "stacked"
                  ? "w-full py-2 text-sm text-muted-foreground hover:text-foreground"
                  : "bg-amber-400/12 text-foreground ring-1 ring-amber-400/30 backdrop-blur-xl hover:bg-amber-400/20",
                variant === "pair" && (compact ? "px-3 py-2 text-sm" : "px-4 py-3.5 text-base"),
              )}
            >
              {variant === "stacked" ? (
                "Can't make it"
              ) : (
                <>
                  <X className="h-4 w-4" aria-hidden /> Doesn&apos;t Work For Me
                </>
              )}
            </motion.button>
          </motion.div>
        ) : (
          <motion.div
            key="badge"
            layout
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={spring}
            className={cn("flex items-center justify-between gap-3", className)}
          >
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-2xl px-3.5 py-2 text-sm font-semibold ring-1 backdrop-blur-xl",
                state
                  ? "bg-emerald-500/15 text-emerald-400 ring-emerald-400/40 shadow-[0_0_24px_-6px_var(--color-emerald-500)]"
                  : "bg-amber-400/12 text-foreground ring-amber-400/40 shadow-[0_0_24px_-8px_var(--color-amber-400)]",
              )}
            >
              {state ? (
                <CheckCircle2 className="h-4 w-4" aria-hidden />
              ) : (
                <XCircle className="h-4 w-4" aria-hidden />
              )}
              {state ? "You're In" : "Conflict Shared"}
            </span>
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit vote
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      <Modal
        open={picking}
        onClose={() => setPicking(false)}
        title="What's the blocker?"
        description="One tap. We tell the host what to fix without sharing your private details."
      >
        <div className="grid gap-2">
          {CONFLICT_REASONS.map((r) => {
            const Icon = REASON_ICONS[r.id] ?? CalendarX;
            return (
              <motion.button
                key={r.id}
                type="button"
                disabled={flag.isPending}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.95 }}
                transition={spring}
                onClick={() => flag.mutate({ data: { planId, kind: r.id } })}
                className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-foreground/[0.04] px-4 py-3 text-left text-sm font-medium backdrop-blur-xl transition hover:border-primary/50 hover:bg-primary/8 disabled:opacity-60"
              >
                <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
                {r.label}
              </motion.button>
            );
          })}
        </div>
      </Modal>
    </>
  );
}
