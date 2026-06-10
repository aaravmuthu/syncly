import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useHac } from "@/lib/hac/store";
import { buildAuraLedger, auraTierForPoints, totalAura, type LedgerEntry } from "@/lib/hac/aura";
import { ChevronRight, ScrollText } from "lucide-react";

function elapsed(ts: number): string {
  if (!ts) return "";
  const days = Math.round((Date.now() - ts) / 86_400_000);
  if (days <= 0) return "Just Now";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return `${Math.round(days / 7)}w ago`;
}

function LedgerRow({ e, accent, i }: { e: LedgerEntry; accent: string; i: number }) {
  const { setCourseNav } = useHac();
  return (
    <motion.button
      initial={{ x: -14, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: i * 0.05, type: "spring", stiffness: 340, damping: 26 }}
      onClick={() => setCourseNav({ courseId: e.course.id, sub: "analysis" })}
      className="w-full text-left flex items-center gap-3 rounded-xl px-2.5 py-2.5 hover:bg-white/[0.04] transition-colors"
    >
      {/* Glowing AP pill */}
      <span
        className="shrink-0 text-[11px] font-black tabular-nums px-2.5 py-1.5 rounded-lg"
        style={{
          color: "#fff",
          background: `linear-gradient(135deg, ${accent}, color-mix(in oklab, ${accent} 55%, #000))`,
          boxShadow: `0 0 16px -4px ${accent}`,
          minWidth: "62px",
          textAlign: "center",
        }}
      >
        +{e.gain.points} AP
      </span>

      <div className="min-w-0 flex-1">
        <div
          className="text-[13px] font-semibold truncate"
          style={{ color: "color-mix(in oklab, #c4b5fd 70%, var(--foreground))" }}
        >
          {e.assignment.name}
        </div>
        <div className="text-[10px] text-muted-foreground truncate">
          {e.course.name}
          {e.ts ? <span className="opacity-70"> · {elapsed(e.ts)}</span> : null}
          {e.gain.multiplied ? <span className="ml-1 font-bold" style={{ color: accent }}>2×</span> : null}
          {e.gain.rigorBonus ? <span className="ml-1 font-bold" style={{ color: "#fbbf24" }}>+Rigor</span> : null}
        </div>
      </div>

      <div className="shrink-0 text-right">
        <div className="text-sm font-bold tabular-nums" style={{ color: accent }}>
          {Math.round(e.percent)}%
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </motion.button>
  );
}

export function AuraLedger() {
  const { data } = useHac();
  const [showAll, setShowAll] = useState(false);

  const ledger = useMemo(() => (data ? buildAuraLedger(data.courses) : []), [data]);
  const accent = useMemo(
    () => (data ? auraTierForPoints(totalAura(data.courses)).accent : "var(--primary)"),
    [data],
  );

  if (!data) return null;

  if (ledger.length === 0) {
    return (
      <div className="liquid rounded-2xl px-4 py-3.5 text-sm text-muted-foreground">
        No AP earned yet — score 80%+ on an assignment to start the ledger.
      </div>
    );
  }

  const rows = showAll ? ledger : ledger.slice(0, 6);

  return (
    <section
      className="relative rounded-2xl overflow-hidden"
      style={{
        background: "var(--card)",
        border: `1px solid color-mix(in oklab, ${accent} 32%, transparent)`,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <div className="flex items-center justify-between px-4 pt-3.5 pb-1.5">
        <span
          className="text-[10px] font-bold uppercase tracking-[0.22em] inline-flex items-center gap-1.5"
          style={{ color: `color-mix(in oklab, ${accent} 70%, var(--foreground))` }}
        >
          <ScrollText className="h-3.5 w-3.5" /> Aura Ledger
        </span>
        {ledger.length > 6 ? (
          <button
            onClick={() => setShowAll((s) => !s)}
            className="text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground active:scale-95"
          >
            {showAll ? "Show less" : `All ${ledger.length}`}
          </button>
        ) : null}
      </div>

      <div className="px-2 pb-2 space-y-0.5">
        <AnimatePresence initial>
          {rows.map((e, i) => (
            <LedgerRow key={e.key} e={e} accent={accent} i={i} />
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}
