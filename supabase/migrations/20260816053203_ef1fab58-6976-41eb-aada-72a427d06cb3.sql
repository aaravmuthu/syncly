
revoke execute on function public.my_profile_id() from public, anon;
revoke execute on function public.is_group_member(uuid) from public, anon;
revoke execute on function public.can_see_plan(uuid) from public, anon;
grant execute on function public.my_profile_id() to authenticated, service_role;
grant execute on function public.is_group_member(uuid) to authenticated, service_role;
grant execute on function public.can_see_plan(uuid) to authenticated, service_role;
