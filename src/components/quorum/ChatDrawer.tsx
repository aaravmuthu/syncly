import { useState } from "react";
import { createPortal } from "react-dom";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
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
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+4.5rem)] right-4 z-[60] flex flex-col items-end gap-2 md:bottom-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
      {open ? (
        <div className="w-[min(92vw,380px)] overflow-hidden rounded-3xl">
          <div className="flex flex-wrap gap-1.5 rounded-t-3xl border border-b-0 border-white/10 bg-neutral-950/80 p-3 backdrop-blur-xl">
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
                className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/75 hover:border-emerald-400/40 hover:bg-emerald-400/10"
              >
                {r.label}
              </button>
            ))}
          </div>
          <SquadChat
            groupId={groupId}
            planId={planId}
            className="h-[60vh] max-h-[520px] rounded-t-none"
          />
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "rounded-full border border-white/10 bg-neutral-950/85 px-4 py-3 text-sm font-semibold text-white shadow-2xl backdrop-blur-xl transition hover:border-emerald-400/40",
        )}
      >
        {open ? "Close chat ✕" : "Squad Chat 💬"}
      </button>
    </div>,
    document.body,
  );
}
