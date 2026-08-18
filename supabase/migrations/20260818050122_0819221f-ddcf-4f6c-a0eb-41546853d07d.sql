drop policy "activity insert by members" on public.activity_events;
create policy "activity insert by members"
on public.activity_events
for insert
to authenticated
with check (
  ((group_id is null) or is_group_member(group_id))
  and (actor_profile_id is null or actor_profile_id = my_profile_id())
);