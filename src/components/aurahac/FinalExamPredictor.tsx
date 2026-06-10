import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Calculator, Lock, AlertTriangle, Flame } from "lucide-react";

/**
 * Semester weighting. Standard high school split: each quarter 40%, final 20%.
 * Adjust these three variables to match any district's policy (e.g. 0.8/0/0.2
 * for a single-quarter + final term). They must sum to 1.
 */
const WEIGHT_MP3 = 0.4;
const WEIGHT_MP4 = 0.4;
const WEIGHT_FINAL = 0.2;

/** Target final semester averages and their letter labels. */
const TARGETS: { label: string; grade: number; color: string }[] = [
  { label: "A", grade: 90, color: "var(--success)" },
  { label: "B", grade: 80, color: "var(--primary)" },
  { label: "C", grade: 70, color: "var(--warning)" },
];

/** Exact final-exam score to reach `target`, given both quarter grades. */
function neededFinal(mp3: number, mp4: number, target: number): number {
  return (target - WEIGHT_MP3 * mp3 - WEIGHT_MP4 * mp4) / WEIGHT_FINAL;
}

type Zone = { label: string; color: string; icon: typeof Lock };

function zoneFor(needed: number): Zone {
  if (needed <= 0) return { label: "Locked In", color: "var(--success)", icon: Lock };
  if (needed <= 70) return { label: "Safe Zone", color: "var(--success)", icon: Lock };
  if (needed <= 90) return { label: "Clutch Required", color: "var(--warning)", icon: Flame };
  if (needed <= 100) return { label: "Danger Zone", color: "var(--destructive)", icon: AlertTriangle };
  return { label: "Out of Reach", color: "var(--destructive)", icon: AlertTriangle };
}

function QuarterInput({
  label,
  value,
  posted,
  onChange,
}: {
  label: string;
  value: number;
  posted: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div className="glass rounded-2xl p-3" style={{ backdropFilter: "blur(12px)" }}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold">{label}</span>
        <span className="flex items-center gap-2">
          {!posted ? (
            <span className="text-[9px] uppercase tracking-widest text-warning">Predicted</span>
          ) : (
            <span className="text-[9px] uppercase tracking-widest text-muted-foreground">Posted</span>
          )}
          <span className="text-sm font-bold tabular-nums text-primary">{Math.round(value)}</span>
        </span>
      </div>
      {posted ? (
        <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, value)}%`, background: "var(--primary)" }} />
        </div>
      ) : (
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full accent-[var(--primary)]"
        />
      )}
    </div>
  );
}

export function FinalExamPredictor({
  mp3,
  mp4,
}: {
  mp3: number | null;
  mp4: number | null;
}) {
  const mp3Posted = mp3 !== null && Number.isFinite(mp3);
  const mp4Posted = mp4 !== null && Number.isFinite(mp4);

  const [mp3Mock, setMp3Mock] = useState<number>(mp3Posted ? (mp3 as number) : 85);
  const [mp4Mock, setMp4Mock] = useState<number>(mp4Posted ? (mp4 as number) : 85);

  const mp3Val = mp3Posted ? (mp3 as number) : mp3Mock;
  const mp4Val = mp4Posted ? (mp4 as number) : mp4Mock;

  const rows = useMemo(
    () =>
      TARGETS.map((t) => {
        const raw = neededFinal(mp3Val, mp4Val, t.grade);
        const zone = zoneFor(raw);
        return { ...t, raw, zone, display: Math.max(0, Math.min(100, raw)) };
      }),
    [mp3Val, mp4Val],
  );

  return (
    <section
      className="relative overflow-hidden rounded-3xl p-5"
      style={{
        background: "color-mix(in oklab, var(--card) 55%, transparent)",
        border: "1px solid color-mix(in oklab, var(--primary) 34%, transparent)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        boxShadow: "0 0 40px -18px var(--primary)",
      }}
    >
      <div
        aria-hidden
        className="absolute -top-12 -right-10 w-44 h-44 pointer-events-none"
        style={{
          background: "radial-gradient(circle, color-mix(in oklab, var(--primary) 26%, transparent), transparent 70%)",
          filter: "blur(24px)",
        }}
      />

      <header className="flex items-center gap-2 mb-1">
        <Calculator className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold">Final Exam Predictor</h3>
      </header>
      <p className="text-[11px] text-muted-foreground mb-4">
        {Math.round(WEIGHT_MP3 * 100)}% MP3 · {Math.round(WEIGHT_MP4 * 100)}% MP4 ·{" "}
        {Math.round(WEIGHT_FINAL * 100)}% Final
      </p>

      {/* Quarter inputs (sliders when a grade isn't posted yet) */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <QuarterInput label="MP3" value={mp3Val} posted={mp3Posted} onChange={setMp3Mock} />
        <QuarterInput label="MP4" value={mp4Val} posted={mp4Posted} onChange={setMp4Mock} />
      </div>

      {/* Target rows */}
      <div className="space-y-3">
        {rows.map((r) => {
          const Icon = r.zone.icon;
          const locked = r.raw <= 0;
          const impossible = r.raw > 100;
          return (
            <div key={r.label}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="h-6 w-6 grid place-items-center rounded-lg text-xs font-bold shrink-0"
                    style={{
                      background: `color-mix(in oklab, ${r.color} 18%, transparent)`,
                      color: r.color,
                      border: `1px solid color-mix(in oklab, ${r.color} 40%, transparent)`,
                    }}
                  >
                    {r.label}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">
                    {locked
                      ? "Already secured"
                      : impossible
                        ? "Not reachable"
                        : `Need ${r.raw.toFixed(0)}% on the final`}
                  </span>
                </div>
                <span
                  className="shrink-0 inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                  style={{
                    color: r.zone.color,
                    background: `color-mix(in oklab, ${r.zone.color} 14%, transparent)`,
                  }}
                >
                  <Icon className="h-3 w-3" /> {r.zone.label}
                </span>
              </div>
              <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  initial={false}
                  animate={{ width: `${locked ? 100 : r.display}%` }}
                  transition={{ type: "spring", stiffness: 200, damping: 26 }}
                  style={{
                    background: `linear-gradient(90deg, color-mix(in oklab, ${r.zone.color} 70%, transparent), ${r.zone.color})`,
                    boxShadow: `0 0 12px -3px ${r.zone.color}`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
