import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/quorum/ui";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/** Icon + title used atop a settings section so the page reads as
 * distinct groups instead of one undifferentiated scroll. */
export function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-4" aria-hidden />
      </span>
      <div>
        <h2 className="font-display text-base font-semibold">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
    </div>
  );
}

/** One preference toggle rendered as its own glass card instead of a flat
 * list row, matching the rest of the app's surface styling. The label area
 * and Switch are independent sibling controls (not nested) so both are
 * clickable without double-firing onToggle. */
export function ToggleCard({
  label,
  hint,
  on,
  onToggle,
  action,
}: {
  label: string;
  hint: string;
  on: boolean;
  onToggle?: () => void;
  action?: ReactNode;
}) {
  const Wrapper = onToggle ? "button" : "div";
  return (
    <Card as="article" className="flex w-full items-center justify-between gap-4 p-4">
      <Wrapper
        type={onToggle ? "button" : undefined}
        onClick={onToggle}
        className={cn(
          "flex flex-1 items-center gap-4",
          onToggle && "text-left transition active:scale-[0.99]",
        )}
      >
        <span>
          <span className="block text-sm font-medium">{label}</span>
          <span className="block text-xs text-muted-foreground">{hint}</span>
        </span>
      </Wrapper>
      {onToggle ? <Switch checked={on} onCheckedChange={onToggle} aria-label={label} /> : null}
      {action}
    </Card>
  );
}
