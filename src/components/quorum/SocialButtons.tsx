import { ThinkingOrb } from "thinking-orbs";
import { cn } from "@/lib/utils";

/** Simple, non-branded marks so the buttons read clearly without copying vendor artwork. */
function GoogleMark() {
  return (
    <span className="grid size-5 place-items-center rounded-full border border-border bg-background text-sm font-bold leading-none text-foreground">
      G
    </span>
  );
}

export function SocialButtons({
  onGoogle,
  pending,
  disabled,
}: {
  onGoogle: () => void;
  pending?: "google" | null;
  disabled?: boolean;
}) {
  const base =
    "pressable active:pressable-active tap-target flex w-full items-center justify-center gap-2.5 rounded-2xl px-4 py-3.5 text-sm font-semibold transition-colors disabled:opacity-60";
  return (
    <div className="space-y-2.5">
      <button
        type="button"
        onClick={onGoogle}
        disabled={disabled || !!pending}
        className={cn(base, "border border-border bg-card text-foreground hover:bg-secondary")}
      >
        {pending === "google" ? (
          <ThinkingOrb state="connecting" size={20} aria-hidden="true" />
        ) : (
          <GoogleMark />
        )}
        Continue with Google
      </button>
    </div>
  );
}
