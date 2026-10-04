import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { listInbox } from "./dm.functions";

/** The shared inbox query ("dm-inbox"). Read-only: see useChatUnread for the realtime nudge. */
export function useChatInbox() {
  const fetchInbox = useServerFn(listInbox);
  return useQuery({
    queryKey: ["dm-inbox"],
    queryFn: () => fetchInbox(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

/**
 * Realtime nudge for the inbox: a new DM or squad message refetches it, so
 * unread badges update the moment something arrives instead of on a poll.
 * Rows for other people never reach this client (RLS filters realtime
 * delivery), so the unfiltered subscription only fires for chats the user is
 * in. Mount this exactly once (the nav badge does): a second subscription to
 * the same channel name throws.
 */
function useInboxRealtime(me: string | null) {
  const qc = useQueryClient();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!me) return;
    const nudge = () => {
      if (timer.current) return;
      timer.current = setTimeout(() => {
        timer.current = null;
        void qc.invalidateQueries({ queryKey: ["dm-inbox"] });
      }, 250);
    };
    const channel = supabase
      .channel("chat-inbox")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages" },
        nudge,
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "group_messages" }, nudge)
      .subscribe();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      void supabase.removeChannel(channel);
    };
  }, [me, qc]);
}

/** Total unread across DMs and squad chats, for the nav badge. */
export function useChatUnread(): number {
  const { data } = useChatInbox();
  useInboxRealtime(data?.me ?? null);
  if (!data) return 0;
  return (
    data.threads.reduce((n, t) => n + t.unread, 0) + data.squads.reduce((n, s) => n + s.unread, 0)
  );
}
