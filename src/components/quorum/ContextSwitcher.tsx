import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMe } from "@/lib/quorum/plan.functions";
import { cn } from "@/lib/utils";
import { LAST_CONTEXT_KEY } from "./last-context";

/**
 * Two-option segmented pill for hybrid people (a teen in their own squad who
 * also guardians a sibling). Only rendered when hasLinkedTeens is true --
 * "My Squad" is always available to any account, so that's the sole
 * variable. Reflects whichever shell the current route is actually in, and
 * persists the choice so the next login lands there (read by
 * _authenticated/route.tsx's beforeLoad).
 */
export function ContextSwitcher({ className }: { className?: string }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const me = useQuery({ queryKey: ["me"], queryFn: useServerFn(getMe), retry: false });

  if (!me.data?.hasLinkedTeens) return null;

  const onFamily = pathname.startsWith("/guardian");

  const go = (target: "squad" | "family") => {
    if ((target === "family") === onFamily) return;
    localStorage.setItem(LAST_CONTEXT_KEY, target);
    void navigate({ to: target === "family" ? "/guardian" : "/home" });
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-secondary/50 p-0.5",
        className,
      )}
      role="tablist"
      aria-label="Switch between My Squad and Family Hub"
    >
      <button
        type="button"
        role="tab"
        aria-selected={!onFamily}
        onClick={() => go("squad")}
        className={cn(
          "tap-target flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium transition sm:px-3",
          !onFamily ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
        )}
      >
        <span aria-hidden>🎒</span>
        <span className="hidden sm:inline">My Squad</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={onFamily}
        onClick={() => go("family")}
        className={cn(
          "tap-target flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium transition sm:px-3",
          onFamily ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
        )}
      >
        <span aria-hidden>🛡️</span>
        <span className="hidden sm:inline">Family Hub</span>
      </button>
    </div>
  );
}
