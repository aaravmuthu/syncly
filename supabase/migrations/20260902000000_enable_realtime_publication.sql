-- =============================================================================
-- Enable Supabase Realtime for the tables the client actually subscribes to
-- =============================================================================
-- The supabase_realtime publication currently has zero tables in it (verified
-- live: `select * from pg_publication_tables where pubname = 'supabase_realtime'`
-- returns no rows). No prior migration or config.toml entry ever added a
-- table to it, so every client-side `.channel(...).on("postgres_changes", ...)`
-- subscription in src/ has been silently inert — inserts happen, but Postgres
-- never publishes them to Realtime, so no client is ever notified.
--
-- This surfaced as "the newest notification doesn't show up" (useNotifications.ts
-- falls back to a 60s poll, so new rows appear late rather than never) but the
-- same gap affects live chat updates too: SquadChat.tsx and dm/DirectChat.tsx
-- subscribe to group_messages, message_reads, direct_messages, and
-- direct_reactions with the identical pattern.
--
-- REPLICA IDENTITY doesn't need changing here: all five tables use gen_random_uuid()
-- primary keys, which is the default identity Postgres already uses to build the
-- old-row image on UPDATE/DELETE.

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_reactions;
