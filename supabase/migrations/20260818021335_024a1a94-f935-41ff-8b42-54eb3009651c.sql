CREATE TABLE public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  plan_id uuid references public.plans(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  content text not null default '',
  media_url text,
  reply_to_id uuid references public.group_messages(id) on delete set null,
  system_type text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
CREATE INDEX group_messages_group_idx ON public.group_messages(group_id, created_at);
CREATE INDEX group_messages_plan_idx ON public.group_messages(plan_id, created_at);

GRANT SELECT, INSERT ON public.group_messages TO authenticated;
GRANT ALL ON public.group_messages TO service_role;
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read group messages" ON public.group_messages
  FOR SELECT TO authenticated USING (public.is_group_member(group_id));
CREATE POLICY "members send group messages" ON public.group_messages
  FOR INSERT TO authenticated WITH CHECK (
    public.is_group_member(group_id)
    AND (sender_id IS NULL OR sender_id = public.my_profile_id())
  );

CREATE TABLE public.message_reads (
  message_id uuid not null references public.group_messages(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (message_id, profile_id)
);
GRANT SELECT, INSERT ON public.message_reads TO authenticated;
GRANT ALL ON public.message_reads TO service_role;
ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read receipts" ON public.message_reads
  FOR SELECT TO authenticated USING (
    exists (select 1 from public.group_messages m where m.id = message_id and public.is_group_member(m.group_id))
  );
CREATE POLICY "members mark read" ON public.message_reads
  FOR INSERT TO authenticated WITH CHECK (
    profile_id = public.my_profile_id()
    AND exists (select 1 from public.group_messages m where m.id = message_id and public.is_group_member(m.group_id))
  );

ALTER TABLE public.group_messages REPLICA IDENTITY FULL;
ALTER TABLE public.message_reads REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reads;