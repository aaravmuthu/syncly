create or replace function public.is_group_admin(_group_id uuid)
returns boolean language sql stable security invoker set search_path = public as $$
  select exists (
    select 1 from public.group_members gm
    where gm.group_id = _group_id
      and gm.profile_id = public.my_profile_id()
      and gm.role in ('owner','admin')
  )
$$;

create or replace function public.is_plan_owner(_plan_id uuid)
returns boolean language sql stable security invoker set search_path = public as $$
  select exists (
    select 1 from public.plans p
    where p.id = _plan_id and p.created_by = public.my_profile_id()
  )
$$;

revoke execute on function public.is_group_admin(uuid) from public, anon;
revoke execute on function public.is_plan_owner(uuid) from public, anon;
grant execute on function public.is_group_admin(uuid) to authenticated, service_role;
grant execute on function public.is_plan_owner(uuid) to authenticated, service_role;