import { useCallback, useRef, useState } from "react";

export type Pending<P> = {
  cid: string;
  payload: P;
  /** Text shown in the pending bubble. */
  text: string;
  at: string;
  status: "sending" | "failed";
  error?: string;
  /** Server id once the send resolved; the entry drops when that row arrives. */
  serverId?: string;
  /** Ids already in the thread when this was queued, so reconciliation can't
   *  match an older identical message (and doesn't depend on clock skew). */
  seen: Set<string>;
};

type Settled = { id: string; sender: string | null; content: string };

const SAFETY_DROP_MS = 8000;

/**
 * Optimistic outgoing messages. A pending bubble shows instantly, becomes
 * "failed + tap to retry" on error, and disappears once the matching server
 * row is in the thread (matched by returned id, or by sender + text for the
 * race where realtime delivers the row before the send call resolves).
 */
export function usePendingMessages<P>(send: (payload: P) => Promise<{ id: string }>) {
  const [pending, setPending] = useState<Pending<P>[]>([]);
  const sendRef = useRef(send);
  sendRef.current = send;

  const run = useCallback(async (cid: string, payload: P) => {
    setPending((p) =>
      p.map((x) => (x.cid === cid ? { ...x, status: "sending", error: undefined } : x)),
    );
    try {
      const { id } = await sendRef.current(payload);
      setPending((p) => p.map((x) => (x.cid === cid ? { ...x, serverId: id } : x)));
      // If the row never shows up (RLS, dropped refetch) don't leave it forever.
      setTimeout(() => setPending((p) => p.filter((x) => x.cid !== cid)), SAFETY_DROP_MS);
    } catch (e) {
      const error = e instanceof Error ? e.message : "Please try again.";
      setPending((p) => p.map((x) => (x.cid === cid ? { ...x, status: "failed", error } : x)));
    }
  }, []);

  const enqueue = useCallback(
    (payload: P, text: string, seen: Iterable<string>) => {
      const cid = crypto.randomUUID();
      setPending((p) => [
        ...p,
        {
          cid,
          payload,
          text,
          at: new Date().toISOString(),
          status: "sending",
          seen: new Set(seen),
        },
      ]);
      void run(cid, payload);
      return cid;
    },
    [run],
  );

  const retry = useCallback(
    (cid: string) => {
      const entry = pending.find((x) => x.cid === cid);
      if (entry) void run(cid, entry.payload);
    },
    [pending, run],
  );

  const discard = useCallback(
    (cid: string) => setPending((p) => p.filter((x) => x.cid !== cid)),
    [],
  );

  /** Pending entries not yet represented by a real row. */
  const visible = useCallback(
    (rows: Settled[], me: string | null) => {
      const used = new Set<string>();
      return pending.filter((p) => {
        if (p.serverId && rows.some((r) => r.id === p.serverId)) return false;
        if (p.status === "failed") return true;
        const hit = rows.find(
          (r) => r.sender === me && r.content === p.text && !p.seen.has(r.id) && !used.has(r.id),
        );
        if (hit) {
          used.add(hit.id);
          return false;
        }
        return true;
      });
    },
    [pending],
  );

  return { pending, enqueue, retry, discard, visible };
}
