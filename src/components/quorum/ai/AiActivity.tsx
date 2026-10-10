import { ThinkingOrb, type OrbState } from "thinking-orbs";
import { cn } from "@/lib/utils";
import { SyncAvatar } from "@/components/quorum/auth/SyncAvatar";

/**
 * The one way an AI wait shows itself: a tuned thinking orb beside a short
 * line of status copy. The copy is the live announcement, so the orb stays
 * hidden from assistive tech. Pick the orb state from what is actually
 * happening (searching, solving, composing, shaping), never for looks.
 * 20px sits inline with text; 64px is for a wait that owns its whole panel.
 *
 * `sync` swaps the orb for Sync, the companion, thinking -- for waits where
 * the AI itself is working (a reply, a summary, a write-up), so the model
 * always has the same face. Plain loading (maps, sign-in) keeps the orb.
 */
export function AiActivity({
  state,
  label,
  size = 20,
  sync = false,
  className,
}: {
  state: OrbState;
  label: string;
  size?: 20 | 64;
  sync?: boolean;
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
      {sync ? (
        <span aria-hidden="true" className="shrink-0">
          <SyncAvatar mood="thinking" size={size === 64 ? 80 : 28} />
        </span>
      ) : (
        <ThinkingOrb state={state} size={size} aria-hidden="true" />
      )}
      <span>{label}</span>
    </div>
  );
}
