CREATE OR REPLACE FUNCTION app_private.is_thread_member(_thread_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.direct_threads t
    WHERE t.id = _thread_id
      AND public.my_profile_id() IN (t.a_profile_id, t.b_profile_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.is_thread_member(_thread_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY INVOKER
SET search_path TO 'public'
AS $$ SELECT app_private.is_thread_member(_thread_id) $$;