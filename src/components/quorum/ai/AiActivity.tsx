import { ThinkingOrb, type OrbState } from "thinking-orbs";
import { cn } from "@/lib/utils";

/**
 * The one way an AI wait shows itself: a tuned thinking orb beside a short
 * line of status copy. The copy is the live announcement, so the orb stays
 * hidden from assistive tech. Pick the orb state from what is actually
 * happening (searching, solving, composing, shaping), never for looks.
 * 20px sits inline with text; 64px is for a wait that owns its whole panel.
 */
export function AiActivity({
  state,
  label,
  size = 20,
  className,
}: {
  state: OrbState;
  label: string;
  size?: 20 | 64;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center text-sm text-muted-foreground",
        size === 64 ? "flex-col gap-3 py-6 text-center" : "gap-2",
        className,
      )}
    >
      <ThinkingOrb state={state} size={size} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
