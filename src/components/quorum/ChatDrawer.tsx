import { useState } from "react";
import { createPortal } from "react-dom";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "@/lib/quorum/toast";
import { MessageCircle, X } from "lucide-react";
import { SquadChat } from "@/components/quorum/SquadChat";
import { postRideUpdate } from "@/lib/quorum/chat.functions";
import { cn } from "@/lib/utils";

const RIDES = [
  { label: "🚗 Driving", status: "Driving", seats: 3 },
  { label: "🙋 Need a ride", status: "Needs a ride", seats: null },
  { label: "🚶 Meeting there", status: "Meeting there", seats: null },
];

/** Collapsible floating squad chat for active plan screens. */
export function ChatDrawer({ groupId, planId }: { groupId: string; planId: string }) {
  const [open, setOpen] = useState(false);
  const ride = useServerFn(postRideUpdate);

  // Portaled to <body>: must stay pinned to the real viewport even though
  // route content (its natural DOM ancestor) sits inside RouteTransition's
  // animated wrapper, whose transform would otherwise become the
  // containing block for our `fixed` positioning.
  return createPortal(
    <div
      data-open={open}
      className="plan-floating-action floating-chat fixed bottom-[var(--chat-bottom)] right-[max(1rem,env(safe-area-inset-right,0px))] z-[60] flex flex-col items-end gap-2"
    >
      {open ? (
        <div className="flex max-h-[calc(var(--visual-viewport-height,100dvh)-var(--chat-bottom)-var(--chrome-top)-4rem)] w-[min(calc(100vw-env(safe-area-inset-left,0px)-env(safe-area-inset-right,0px)-2rem),380px)] flex-col overflow-hidden rounded-3xl">
          <div className="floating-chat-ride-actions flex shrink-0 flex-wrap gap-1.5 rounded-t-3xl border border-b-0 border-white/10 bg-neutral-950/80 p-3 backdrop-blur-xl">
            {RIDES.map((r) => (
              <button
                key={r.status}
                type="button"
                onClick={async () => {
                  try {
                    await ride({ data: { groupId, planId, status: r.status, seats: r.seats } });
                    toast.success("Ride status shared in chat");
                  } catch {
                    toast.error("Could not post your ride status");
                  }
                }}
                className="tap-target rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-caption text-white/75 hover:border-emerald-400/40 hover:bg-emerald-400/10"
              >
                {r.label}
              </button>
            ))}
          </div>
          <SquadChat
            groupId={groupId}
            planId={planId}
            className="min-h-0 h-[60dvh] max-h-[520px] shrink rounded-t-none"
          />
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          // Icon-only circle on phones so it and Ask AI don't wall off the
          // bottom of a long plan page; the label comes back from md up.
          "grid size-12 place-items-center rounded-full border border-white/10 bg-neutral-950/85 text-sm font-semibold text-white shadow-2xl backdrop-blur-xl transition hover:border-emerald-400/40 md:inline-flex md:size-auto md:gap-2 md:px-4 md:py-3",
        )}
      >
        {open ? (
          <X className="size-5 md:size-4" aria-hidden />
        ) : (
          <MessageCircle className="size-5 md:size-4" aria-hidden />
        )}
        <span className="sr-only md:not-sr-only">{open ? "Close chat" : "Squad Chat"}</span>
      </button>
    </div>,
    document.body,
  );
}
