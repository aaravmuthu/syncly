alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.activity_events;
alter table public.notifications replica identity full;
alter table public.activity_events replica identity full;