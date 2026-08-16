CREATE OR REPLACE FUNCTION app_private.shares_group_with_me(_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM group_members a
    JOIN group_members b ON b.group_id = a.group_id
    WHERE a.profile_id = _profile_id
      AND b.profile_id = app_private.my_profile_id()
  )
$$;

CREATE OR REPLACE FUNCTION public.shares_group_with_me(_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$ SELECT app_private.shares_group_with_me(_profile_id) $$;

GRANT EXECUTE ON FUNCTION public.shares_group_with_me(uuid) TO authenticated;

DROP POLICY IF EXISTS "profiles visible to co-members" ON public.profiles;
CREATE POLICY "profiles visible to co-members"
ON public.profiles FOR SELECT TO authenticated
USING (public.shares_group_with_me(id));