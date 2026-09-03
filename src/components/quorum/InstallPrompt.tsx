import { useEffect, useState } from "react";
import { Download, Share, SquarePlus, X } from "lucide-react";
import { useInstallPrompt } from "@/lib/quorum/pwa";
import { haptic } from "@/lib/quorum/haptics";

const DISMISS_KEY = "syncly:install-prompt-dismissed-until";
const DISMISS_DAYS = 14;

function isDismissed() {
  if (typeof window === "undefined") return true;
  try {
    const until = Number(window.localStorage.getItem(DISMISS_KEY) ?? 0);
    return Date.now() < until;
  } catch {
    return false;
  }
}

function dismiss() {
  try {
    window.localStorage.setItem(
      DISMISS_KEY,
      String(Date.now() + DISMISS_DAYS * 24 * 3600_000),
    );
  } catch {
    /* private browsing / storage disabled — just won't persist the dismissal */
  }
}

/** Inline "Add to Home Screen" card shown once per AppShell mount, above the fold. */
export function InstallPrompt() {
  const { standalone, platform, canPromptInstall, promptInstall } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(isDismissed());
  }, []);

  if (standalone || dismissed) return null;
  if (platform === "other" && !canPromptInstall) return null;

  const onDismiss = () => {
    haptic("select");
    dismiss();
    setDismissed(true);
  };

  return (
    <div className="surface mb-4 flex items-center gap-3 px-4 py-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/15 text-base">
        <Download className="size-4 text-primary" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 text-xs text-muted-foreground">
        <span className="block text-sm font-medium text-foreground">Install Syncly</span>
        {platform === "ios" ? (
          <span className="flex flex-wrap items-center gap-1">
            Tap <Share className="inline size-3.5" aria-hidden /> Share, then
            <SquarePlus className="inline size-3.5" aria-hidden /> Add to Home Screen.
          </span>
        ) : (
          "Add it to your home screen for a faster, full-screen experience."
        )}
      </div>
      {platform !== "ios" ? (
        <button
          onClick={async () => {
            haptic("tap");
            const outcome = await promptInstall();
            if (outcome !== "unavailable") dismiss();
            setDismissed(true);
          }}
          className="shrink-0 rounded-full bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          Install
        </button>
      ) : null}
      <button
        aria-label="Dismiss"
        onClick={onDismiss}
        className="tap-target grid shrink-0 place-items-center rounded-full p-1.5 text-muted-foreground hover:bg-secondary"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
