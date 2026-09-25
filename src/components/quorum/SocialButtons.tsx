import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Simple, non-branded marks so the buttons read clearly without copying vendor artwork. */
function GoogleMark() {
  return (
    <span className="grid size-5 place-items-center rounded-full border border-border bg-background text-sm font-bold leading-none text-foreground">
      G
    </span>
  );
}

function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-5" fill="currentColor">
      <path d="M16.2 12.6c0-2 1.6-3 1.7-3.1-1-1.4-2.4-1.6-2.9-1.6-1.2-.1-2.4.7-3 .7-.6 0-1.6-.7-2.6-.7-1.3 0-2.6.8-3.3 2-1.4 2.4-.4 6 1 8 .7 1 1.5 2.1 2.5 2 1-.1 1.4-.6 2.6-.6s1.5.6 2.6.6c1.1 0 1.8-1 2.4-2 .8-1.1 1.1-2.2 1.1-2.3 0 0-2.1-.8-2.1-3zM14.4 6.3c.5-.7.9-1.6.8-2.5-.8 0-1.8.5-2.4 1.2-.5.6-1 1.6-.8 2.5.9.1 1.8-.4 2.4-1.2z" />
    </svg>
  );
}

export function SocialButtons({
  onGoogle,
  onApple,
  pending,
  disabled,
}: {
  onGoogle: () => void;
  onApple: () => void;
  pending?: "google" | "apple" | null;
  disabled?: boolean;
}) {
  const base =
    "pressable active:pressable-active flex w-full items-center justify-center gap-2.5 rounded-xl px-4 py-3.5 text-sm font-semibold transition disabled:opacity-60";
  return (
    <div className="space-y-2.5">
      <button
        type="button"
        onClick={onGoogle}
        disabled={disabled || !!pending}
        className={cn(base, "border border-border bg-card text-foreground hover:bg-secondary")}
      >
        {pending === "google" ? <Loader2 className="size-4 animate-spin" /> : <GoogleMark />}
        Continue with Google
      </button>
      <button
        type="button"
        onClick={onApple}
        disabled={disabled || !!pending}
        className={cn(base, "bg-foreground text-background hover:opacity-90")}
      >
        {pending === "apple" ? <Loader2 className="size-4 animate-spin" /> : <AppleMark />}
        Continue with Apple
      </button>
    </div>
  );
}
