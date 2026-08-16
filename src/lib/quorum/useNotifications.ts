import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { listNotifications, markNotificationsRead } from "./insight.functions";
import { showPush } from "./push";

export type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  plan_id: string | null;
  group_id: string | null;
  created_at: string;
};

/** Live notification list + unread count, refreshed over realtime. */
export function useNotifications() {
  const qc = useQueryClient();
  const fetchAll = useServerFn(listNotifications);
  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fetchAll() as Promise<Notification[]>,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    // Unique per subscriber: reusing one channel name across mounted
    // components makes supabase-js throw once the channel is subscribed.
    const channel = supabase
      .channel(`quorum-notifications-${Math.random().toString(36).slice(2)}`)
      .on(

        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          const row = payload.new as Notification;
          showPush(row.title, row.body ?? undefined, row.id);
          void qc.invalidateQueries({ queryKey: ["notifications"] });
          void qc.invalidateQueries({ queryKey: ["activity"] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);

  const unread = (query.data ?? []).filter((n) => !n.read).length;
  return { ...query, notifications: query.data ?? [], unread };
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  const mark = useServerFn(markNotificationsRead);
  return async (ids?: string[]) => {
    await mark({ data: ids?.length ? { ids } : {} });
    await qc.invalidateQueries({ queryKey: ["notifications"] });
  };
}
