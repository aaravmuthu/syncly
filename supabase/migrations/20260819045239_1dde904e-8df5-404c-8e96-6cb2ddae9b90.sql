-- 1) Circle preferences: deletion restricted to the circle owner only
CREATE OR REPLACE FUNCTION public.is_group_owner(_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = _group_id
      AND g.created_by = public.my_profile_id()
  )
$$;

DROP POLICY IF EXISTS "group prefs delete" ON public.group_preferences;
CREATE POLICY "group prefs delete"
ON public.group_preferences
FOR DELETE
TO authenticated
USING (public.is_group_owner(group_id));

-- 2) Profiles: block self-assignment of privileged attributes on insert
CREATE OR REPLACE FUNCTION public.enforce_profile_insert_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Identity must belong to the caller
  NEW.user_id := auth.uid();

  -- Account type may only be one of the allowed self-serve values
  IF NEW.account_type IS NULL OR NEW.account_type NOT IN ('teen','adult','parent') THEN
    NEW.account_type := 'teen';
  END IF;

  -- Parental / safety flags cannot be self-relaxed at creation time
  IF NEW.account_type = 'teen' THEN
    NEW.parent_approval_required := true;
    NEW.parent_features_enabled := true;
  ELSE
    NEW.parent_approval_required := false;
    NEW.parent_features_enabled := COALESCE(NEW.parent_features_enabled, false);
  END IF;

  NEW.is_demo := false;

  -- Sync codes are always system generated
  NEW.sync_code := public.gen_sync_code();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS t_profiles_insert_defaults ON public.profiles;
CREATE TRIGGER t_profiles_insert_defaults
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_insert_defaults();