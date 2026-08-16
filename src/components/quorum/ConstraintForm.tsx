import { useState } from "react";
import { Button, Card, Field, Pill, inputClass } from "./ui";
import { QUESTIONNAIRES, type Field as FieldDef, type Step } from "@/lib/quorum/questionnaires";
import { AVAILABILITY_SLOTS, prettySlot } from "@/lib/quorum/availability";
import type { ConstraintPayload } from "@/lib/quorum/types";
import { cn } from "@/lib/utils";

export function ConstraintForm({
  questionnaire,
  initial,
  saving,
  onSubmit,
}: {
  questionnaire: string;
  initial?: ConstraintPayload | null;
  saving?: boolean;
  onSubmit: (payload: ConstraintPayload) => void;
}) {
  const steps: Step[] = QUESTIONNAIRES[questionnaire] ?? QUESTIONNAIRES["general"]!;
  const [stepIndex, setStepIndex] = useState(0);
  const [value, setValue] = useState<ConstraintPayload>(initial ?? {});
  const step = steps[stepIndex]!;
  const last = stepIndex === steps.length - 1;

  const set = (key: keyof ConstraintPayload, v: unknown) =>
    setValue((prev) => ({ ...prev, [key]: v }));

  return (
    <Card>
      <div className="flex items-center gap-1.5">
        {steps.map((s, i) => (
          <span
            key={s.id}
            className={cn(
              "h-1 flex-1 rounded-full transition",
              i <= stepIndex ? "bg-primary" : "bg-secondary",
            )}
          />
        ))}
      </div>

      <div className="mt-5">
        <h2 className="font-display text-xl font-semibold tracking-tight">{step.title}</h2>
        {step.caption ? (
          <p className="mt-1.5 text-sm text-muted-foreground">{step.caption}</p>
        ) : null}
      </div>

      <div className="mt-5 space-y-5">
        {step.fields.map((f) => (
          <FieldRenderer key={String(f.key)} field={f} value={value} onChange={set} />
        ))}
      </div>

      <div className="mt-7 flex items-center justify-between gap-3">
        <button
          type="button"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          onClick={() => (stepIndex === 0 ? onSubmit({ ...value, skipped: true }) : setStepIndex(stepIndex - 1))}
        >
          {stepIndex === 0 ? "Skip — no strong opinions" : "Back"}
        </button>
        <Button
          disabled={saving}
          onClick={() => (last ? onSubmit(value) : setStepIndex(stepIndex + 1))}
        >
          {saving ? "Saving…" : last ? "Submit privately" : "Continue"}
        </Button>
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Only you can see these answers. The group sees which options work — never why.
      </p>
    </Card>
  );
}

function FieldRenderer({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: ConstraintPayload;
  onChange: (k: keyof ConstraintPayload, v: unknown) => void;
}) {
  const current = value[field.key];
  const hardBadge = "hard" in field && field.hard ? <Pill tone="accent">Hard limit</Pill> : null;

  if (field.kind === "toggle") {
    const on = Boolean(current);
    return (
      <button
        type="button"
        onClick={() => onChange(field.key, !on)}
        className={cn(
          "flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition",
          on ? "border-primary/50 bg-primary/8" : "border-border hover:bg-secondary",
        )}
      >
        <span>
          <span className="block text-sm font-medium">{field.label}</span>
          {field.hint ? (
            <span className="block text-xs text-muted-foreground">{field.hint}</span>
          ) : null}
        </span>
        <span
          className={cn(
            "h-6 w-10 rounded-full p-0.5 transition",
            on ? "bg-primary" : "bg-secondary-foreground/20",
          )}
        >
          <span
            className={cn(
              "block h-5 w-5 rounded-full bg-background transition",
              on ? "translate-x-4" : "translate-x-0",
            )}
          />
        </span>
      </button>
    );
  }

  if (field.kind === "availability") {
    const selected = Array.isArray(current) ? (current as string[]) : [];
    const toggle = (slot: string) =>
      onChange(
        field.key,
        selected.includes(slot) ? selected.filter((s) => s !== slot) : [...selected, slot],
      );
    return (
      <div>
        <span className="text-sm font-medium">{field.label}</span>
        {field.hint ? <p className="mt-0.5 text-xs text-muted-foreground">{field.hint}</p> : null}
        <div className="mt-2 grid grid-cols-4 gap-1.5 sm:grid-cols-6">
          {AVAILABILITY_SLOTS.map((slot) => {
            const on = selected.includes(slot);
            return (
              <button
                key={slot}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(slot)}
                className={cn(
                  "rounded-xl px-2 py-2.5 text-xs font-medium tabular-nums transition",
                  on ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
                )}
              >
                {prettySlot(slot)}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex gap-3 text-xs">
          <button
            type="button"
            className="text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => onChange(field.key, [...AVAILABILITY_SLOTS])}
          >
            Free all day
          </button>
          <button
            type="button"
            className="text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => onChange(field.key, [])}
          >
            Clear
          </button>
        </div>
      </div>
    );
  }

  if (field.kind === "chips") {
    const selected = Array.isArray(current) ? (current as string[]) : [];
    return (
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">{field.label}</span>
          {hardBadge}
        </div>
        {field.hint ? <p className="mt-0.5 text-xs text-muted-foreground">{field.hint}</p> : null}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {field.options.map((o) => {
            const on = selected.includes(o);
            return (
              <button
                key={o}
                type="button"
                onClick={() =>
                  onChange(field.key, on ? selected.filter((s) => s !== o) : [...selected, o])
                }
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm capitalize transition",
                  on ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
                )}
              >
                {o}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const type = field.kind === "time" ? "time" : "number";
  const prefix = field.kind === "money" ? "$" : null;
  const suffix = "suffix" in field ? field.suffix : null;

  if (field.kind === "text") {
    return (
      <Field label={field.label} hint={field.hint}>
        <textarea
          rows={3}
          className={inputClass}
          value={(current as string) ?? ""}
          onChange={(e) => onChange(field.key, e.target.value)}
          placeholder="Anything the plan should account for"
        />
      </Field>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{field.label}</span>
        {hardBadge}
      </div>
      {field.hint ? <p className="mt-0.5 text-xs text-muted-foreground">{field.hint}</p> : null}
      <div className="mt-2 flex items-center gap-2">
        {prefix ? <span className="text-muted-foreground">{prefix}</span> : null}
        <input
          type={type}
          className={inputClass}
          value={(current as string | number | null) ?? ""}
          onChange={(e) =>
            onChange(
              field.key,
              e.target.value === "" ? null : type === "number" ? Number(e.target.value) : e.target.value,
            )
          }
        />
        {suffix ? <span className="text-sm text-muted-foreground">{suffix}</span> : null}
      </div>
    </div>
  );
}
