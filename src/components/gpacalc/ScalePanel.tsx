import { useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TIER_LABELS, TIER_ORDER, type GpaSettings, type ScaleId } from "@/lib/gpacalc/types";

const SCALES: { id: ScaleId; label: string; hint: string }[] = [
  { id: "unweighted4", label: "4.0 Unweighted", hint: "90s=4 · 80s=3 · 70s=2 · <70=0" },
  { id: "weighted5", label: "5.0 Weighted", hint: "AP/IB/DC 5.0 · Honors 4.5 · On-level 4.0" },
  { id: "tiered6banded", label: "6.0 Tiered (Banded)", hint: "AP 6/5/4 · Honors 5.5/4.5/3.5" },
  {
    id: "tiered6continuous",
    label: "6.0 Tiered (Continuous)",
    hint: "−0.1 per point: AP 100→6.0, 90→5.0",
  },
  { id: "raw100", label: "Raw 100-pt Weighted", hint: "Average +10 AP · +5 Honors" },
  { id: "custom", label: "Custom", hint: "Define your own boosts" },
];

interface Props {
  settings: GpaSettings;
  onChange: (patch: Partial<GpaSettings>) => void;
  years: string[];
}

export function ScalePanel({ settings, onChange, years }: Props) {
  const [open, setOpen] = useState(settings.scale === "custom");
  const c = settings.custom;

  return (
    <section className="rounded-2xl border border-border bg-card/70 p-5 backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">Grading scale</h2>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Active year</Label>
          <Select
            value={settings.activeYear || "__latest"}
            onValueChange={(v) => onChange({ activeYear: v === "__latest" ? "" : v })}
          >
            <SelectTrigger className="h-9 w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__latest">Latest year</SelectItem>
              {years.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {SCALES.map((s) => {
          const active = settings.scale === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                onChange({ scale: s.id });
                if (s.id === "custom") setOpen(true);
              }}
              className={`rounded-xl border p-4 text-left transition-all duration-300 ${
                active
                  ? "border-primary bg-primary/10 shadow-[0_0_30px_-12px_var(--primary)]"
                  : "border-border bg-secondary/30 hover:border-primary/50"
              }`}
            >
              <div className="text-sm font-medium text-foreground">{s.label}</div>
              <div className="mt-1 text-xs text-muted-foreground">{s.hint}</div>
            </button>
          );
        })}
      </div>

      <Button
        variant="ghost"
        className="mt-4 gap-2 text-sm"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <SlidersHorizontal className="size-4" /> Custom scale builder
        <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </Button>

      {open && (
        <div className="mt-3 space-y-4 rounded-xl border border-border bg-secondary/25 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Label className="text-xs text-muted-foreground">Conversion</Label>
            {(["discrete", "continuous"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onChange({ custom: { ...c, mode: m }, scale: "custom" })}
                className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                  c.mode === m
                    ? "border-primary bg-primary/15 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {m === "discrete" ? "Discrete letter grades" : "Continuous 100-point"}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {TIER_ORDER.map((t) => (
              <div key={t} className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  {TIER_LABELS[t]} {c.mode === "discrete" ? "boost" : "points at 100"}
                </Label>
                <Input
                  type="number"
                  step="0.1"
                  value={c.mode === "discrete" ? c.boosts[t] : c.tops[t]}
                  onChange={(e) => {
                    const v = Number(e.target.value) || 0;
                    onChange({
                      scale: "custom",
                      custom:
                        c.mode === "discrete"
                          ? { ...c, boosts: { ...c.boosts, [t]: v } }
                          : { ...c, tops: { ...c.tops, [t]: v } },
                    });
                  }}
                  className="h-9 tabular-nums"
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Continuous mode awards 0.1 point per percentage point: a 100 earns the value above and a
            70 earns that value minus 3.0. Anything below 70 is a 0.
          </p>
        </div>
      )}
    </section>
  );
}
