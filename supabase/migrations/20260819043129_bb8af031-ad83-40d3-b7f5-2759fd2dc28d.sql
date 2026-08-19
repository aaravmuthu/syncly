-- 1) Column-level read scoping on profiles: co-members can no longer read
-- contact/precise-location columns even though the row is visible to them.
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (
  id, user_id, display_name, avatar_emoji, avatar_url, bio, school, grad_year, age,
  independence_level, parent_approval_required, parent_features_enabled, curfew_time,
  needs_transportation, transport_features_enabled, notifications_enabled,
  personalization_enabled, preferred_categories, budget_preference, home_area,
  is_demo, onboarded, theme_preference, account_type, created_at, updated_at
) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- 2) Freeze group membership identity on update so the admin checks that
-- group_preferences relies on cannot be re-pointed at another group/profile.
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_owner boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = COALESCE(NEW.group_id, OLD.group_id)
      AND g.created_by = public.my_profile_id()
  ) INTO is_owner;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.group_id IS DISTINCT FROM OLD.group_id
       OR NEW.profile_id IS DISTINCT FROM OLD.profile_id THEN
      RAISE EXCEPTION 'Membership identity cannot be changed';
    END IF;
    IF NEW.role IS DISTINCT FROM OLD.role AND NOT is_owner THEN
      RAISE EXCEPTION 'Only the group owner can change member roles';
    END IF;
    IF NEW.role = 'owner' AND OLD.role <> 'owner' AND NOT is_owner THEN
      RAISE EXCEPTION 'Ownership cannot be self-assigned';
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    IF NEW.role <> 'member' AND NOT is_owner THEN
      RAISE EXCEPTION 'Only the group owner can grant elevated roles';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;