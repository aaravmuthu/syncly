CREATE OR REPLACE FUNCTION public.is_group_owner(_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = _group_id
      AND g.created_by = public.my_profile_id()
  )
$$;

REVOKE ALL ON FUNCTION public.enforce_profile_insert_defaults() FROM PUBLIC, anon, authenticated;