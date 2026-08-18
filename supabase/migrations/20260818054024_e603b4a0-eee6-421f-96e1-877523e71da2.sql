CREATE SCHEMA IF NOT EXISTS app_private;

CREATE OR REPLACE FUNCTION app_private.is_my_teen(_teen uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.guardian_links gl
    WHERE gl.teen_profile_id = _teen AND gl.guardian_profile_id = public.my_profile_id()
  )
$$;

CREATE OR REPLACE FUNCTION app_private.is_my_guardian(_guardian uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.guardian_links gl
    WHERE gl.guardian_profile_id = _guardian AND gl.teen_profile_id = public.my_profile_id()
  )
$$;

REVOKE ALL ON FUNCTION app_private.is_my_teen(uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.is_my_guardian(uuid) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_my_teen(_teen uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path TO 'public'
AS $$ SELECT app_private.is_my_teen(_teen) $$;

CREATE OR REPLACE FUNCTION public.is_my_guardian(_guardian uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path TO 'public'
AS $$ SELECT app_private.is_my_guardian(_guardian) $$;

REVOKE ALL ON FUNCTION public.gen_sync_code() FROM public, anon, authenticated;