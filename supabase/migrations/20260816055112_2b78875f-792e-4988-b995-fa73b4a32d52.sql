-- 1. Move SECURITY DEFINER permission helpers out of the exposed API schema.
CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA app_private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.my_profile_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ select id from public.profiles where user_id = auth.uid() limit 1 $$;

CREATE OR REPLACE FUNCTION app_private.is_group_member(_group_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  select exists (
    select 1 from public.group_members gm
    join public.profiles p on p.id = gm.profile_id
    where gm.group_id = _group_id and p.user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION app_private.can_see_plan(_plan_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  select exists (
    select 1 from public.plans pl
    join public.group_members gm on gm.group_id = pl.group_id
    join public.profiles p on p.id = gm.profile_id
    where pl.id = _plan_id and p.user_id = auth.uid()
  )
$$;

REVOKE ALL ON FUNCTION app_private.my_profile_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.is_group_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.can_see_plan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.my_profile_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.is_group_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.can_see_plan(uuid) TO authenticated, service_role;

-- Public entry points become SECURITY INVOKER thin wrappers, so nothing in the
-- exposed API schema runs with elevated privileges anymore.
CREATE OR REPLACE FUNCTION public.my_profile_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $$ select app_private.my_profile_id() $$;

CREATE OR REPLACE FUNCTION public.is_group_member(_group_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $$ select app_private.is_group_member(_group_id) $$;

CREATE OR REPLACE FUNCTION public.can_see_plan(_plan_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $$ select app_private.can_see_plan(_plan_id) $$;

REVOKE ALL ON FUNCTION public.my_profile_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_group_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_see_plan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_profile_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_see_plan(uuid) TO authenticated, service_role;

-- 2. Self-insert into group_members only for the group's creator (bootstrap).
--    All other joins go through the invite-code server flow, which validates
--    the code before adding the member.
DROP POLICY IF EXISTS "members join self" ON public.group_members;
CREATE POLICY "members join as group creator"
ON public.group_members FOR INSERT TO authenticated
WITH CHECK (
  profile_id = public.my_profile_id()
  AND EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = group_members.group_id
      AND g.created_by = public.my_profile_id()
  )
);

-- 3. Parent approval rows (parent name, email, response token) are private to
--    the requesting member only.
DROP POLICY IF EXISTS "approvals readable by plan members" ON public.parent_approvals;
CREATE POLICY "approvals readable by owner"
ON public.parent_approvals FOR SELECT TO authenticated
USING (profile_id = public.my_profile_id());