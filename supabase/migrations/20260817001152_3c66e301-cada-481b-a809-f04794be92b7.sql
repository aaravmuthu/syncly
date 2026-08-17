create or replace function public.is_group_admin(_group_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.group_members gm
    where gm.group_id = _group_id
      and gm.profile_id = public.my_profile_id()
      and gm.role in ('owner','admin')
  )
$$;

create or replace function public.is_plan_owner(_plan_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.plans p
    where p.id = _plan_id and p.created_by = public.my_profile_id()
  )
$$;

-- group_preferences
drop policy if exists "group prefs write" on public.group_preferences;
create policy "group prefs insert" on public.group_preferences for insert to authenticated
  with check (public.is_group_admin(group_id));
create policy "group prefs update" on public.group_preferences for update to authenticated
  using (public.is_group_admin(group_id)) with check (public.is_group_admin(group_id));
create policy "group prefs delete" on public.group_preferences for delete to authenticated
  using (public.is_group_admin(group_id));

-- plan_participants
drop policy if exists "participants write" on public.plan_participants;
create policy "participants insert" on public.plan_participants for insert to authenticated
  with check (can_see_plan(plan_id) and (profile_id = public.my_profile_id() or public.is_plan_owner(plan_id)));
create policy "participants update" on public.plan_participants for update to authenticated
  using (can_see_plan(plan_id) and (profile_id = public.my_profile_id() or public.is_plan_owner(plan_id)))
  with check (can_see_plan(plan_id) and (profile_id = public.my_profile_id() or public.is_plan_owner(plan_id)));
create policy "participants delete" on public.plan_participants for delete to authenticated
  using (can_see_plan(plan_id) and (profile_id = public.my_profile_id() or public.is_plan_owner(plan_id)));

-- recommendations
drop policy if exists "recs write" on public.recommendations;
create policy "recs insert" on public.recommendations for insert to authenticated
  with check (public.is_plan_owner(plan_id));
create policy "recs update" on public.recommendations for update to authenticated
  using (public.is_plan_owner(plan_id)) with check (public.is_plan_owner(plan_id));
create policy "recs delete" on public.recommendations for delete to authenticated
  using (public.is_plan_owner(plan_id));

-- transport_assignments
drop policy if exists "transport assignments write" on public.transport_assignments;
create policy "transport insert" on public.transport_assignments for insert to authenticated
  with check (public.is_plan_owner(plan_id));
create policy "transport update" on public.transport_assignments for update to authenticated
  using (public.is_plan_owner(plan_id)) with check (public.is_plan_owner(plan_id));
create policy "transport delete" on public.transport_assignments for delete to authenticated
  using (public.is_plan_owner(plan_id));

-- storage: avatars owned by folder = auth uid
drop policy if exists "avatars own select" on storage.objects;
drop policy if exists "avatars own insert" on storage.objects;
drop policy if exists "avatars own update" on storage.objects;
drop policy if exists "avatars own delete" on storage.objects;
create policy "avatars own select" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "avatars own insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "avatars own update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "avatars own delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);