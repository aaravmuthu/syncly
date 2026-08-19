
CREATE TABLE public.direct_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  a_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  b_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT direct_threads_ordered CHECK (a_profile_id < b_profile_id),
  CONSTRAINT direct_threads_pair UNIQUE (a_profile_id, b_profile_id)
);

CREATE TABLE public.direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.direct_threads(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'text',
  content text NOT NULL DEFAULT '',
  media_url text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX direct_messages_thread_idx ON public.direct_messages (thread_id, created_at);

CREATE TABLE public.direct_reads (
  thread_id uuid NOT NULL REFERENCES public.direct_threads(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, profile_id)
);

CREATE TABLE public.direct_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.direct_messages(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, profile_id, emoji)
);

CREATE OR REPLACE FUNCTION public.is_thread_member(_thread_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.direct_threads t
    WHERE t.id = _thread_id
      AND public.my_profile_id() IN (t.a_profile_id, t.b_profile_id)
  )
$$;

GRANT SELECT, INSERT, UPDATE ON public.direct_threads TO authenticated;
GRANT ALL ON public.direct_threads TO service_role;
GRANT SELECT, INSERT ON public.direct_messages TO authenticated;
GRANT ALL ON public.direct_messages TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.direct_reads TO authenticated;
GRANT ALL ON public.direct_reads TO service_role;
GRANT SELECT, INSERT, DELETE ON public.direct_reactions TO authenticated;
GRANT ALL ON public.direct_reactions TO service_role;

ALTER TABLE public.direct_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "threads_select_member" ON public.direct_threads FOR SELECT TO authenticated
  USING (public.my_profile_id() IN (a_profile_id, b_profile_id));
CREATE POLICY "threads_insert_self" ON public.direct_threads FOR INSERT TO authenticated
  WITH CHECK (public.my_profile_id() IN (a_profile_id, b_profile_id));
CREATE POLICY "threads_update_member" ON public.direct_threads FOR UPDATE TO authenticated
  USING (public.my_profile_id() IN (a_profile_id, b_profile_id))
  WITH CHECK (public.my_profile_id() IN (a_profile_id, b_profile_id));

CREATE POLICY "dm_select_member" ON public.direct_messages FOR SELECT TO authenticated
  USING (public.is_thread_member(thread_id));
CREATE POLICY "dm_insert_self" ON public.direct_messages FOR INSERT TO authenticated
  WITH CHECK (public.is_thread_member(thread_id) AND sender_id = public.my_profile_id());

CREATE POLICY "dm_reads_select" ON public.direct_reads FOR SELECT TO authenticated
  USING (public.is_thread_member(thread_id));
CREATE POLICY "dm_reads_insert_self" ON public.direct_reads FOR INSERT TO authenticated
  WITH CHECK (profile_id = public.my_profile_id() AND public.is_thread_member(thread_id));
CREATE POLICY "dm_reads_update_self" ON public.direct_reads FOR UPDATE TO authenticated
  USING (profile_id = public.my_profile_id())
  WITH CHECK (profile_id = public.my_profile_id());

CREATE POLICY "dm_react_select" ON public.direct_reactions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.direct_messages m WHERE m.id = message_id AND public.is_thread_member(m.thread_id)));
CREATE POLICY "dm_react_insert_self" ON public.direct_reactions FOR INSERT TO authenticated
  WITH CHECK (profile_id = public.my_profile_id()
    AND EXISTS (SELECT 1 FROM public.direct_messages m WHERE m.id = message_id AND public.is_thread_member(m.thread_id)));
CREATE POLICY "dm_react_delete_own" ON public.direct_reactions FOR DELETE TO authenticated
  USING (profile_id = public.my_profile_id());

ALTER TABLE public.direct_messages REPLICA IDENTITY FULL;
ALTER TABLE public.direct_reactions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_reactions;
