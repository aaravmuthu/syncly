-- Keep existing row visibility for rosters/guardian links, but grant only the
-- public member-card projection. RLS cannot distinguish columns of one row.
-- Own full profiles use my_profile(); guardian details keep using the trusted
-- server after its relationship and MFA checks. Apply with the avatar writer
-- change in this branch. No historical migration is modified.
begin;

-- Clear both table-level grants (which override column revocations) and any
-- independent column grants, including PUBLIC inheritance. New columns remain
-- private unless a future migration explicitly grants them.
revoke select on public.profiles from public, anon, authenticated;
do $$
declare col record;
begin
  for col in select attname from pg_attribute
    where attrelid = 'public.profiles'::regclass and attnum > 0 and not attisdropped
  loop
    execute format('revoke select (%I) on public.profiles from public, anon, authenticated', col.attname);
  end loop;
end;
$$;
grant select (id, display_name, avatar_emoji, avatar_url, bio, school, grad_year)
  on public.profiles to authenticated;

-- No input identity: the only full row this RPC can return belongs to the
-- signed JWT. SECURITY DEFINER bypasses RLS, so enforce MFA explicitly as well.
create or replace function public.my_profile()
returns setof public.profiles
language sql stable security definer
set search_path = ''
as $$
  select p.* from public.profiles p
  where p.user_id = auth.uid() and public.has_required_mfa();
$$;
revoke all on function public.my_profile() from public, anon, authenticated;
grant execute on function public.my_profile() to authenticated;
comment on function public.my_profile() is
  'Full caller-owned profile, derived from signed JWT and gated by required MFA; never a peer lookup.';

commit;
