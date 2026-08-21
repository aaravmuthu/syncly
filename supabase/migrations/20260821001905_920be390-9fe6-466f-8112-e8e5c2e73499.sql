DROP POLICY IF EXISTS "activity readable by members" ON public.activity_events;
CREATE POLICY "activity readable by members"
ON public.activity_events FOR SELECT TO authenticated
USING (
  CASE
    WHEN group_id IS NOT NULL THEN public.is_group_member(group_id)
    WHEN plan_id IS NOT NULL THEN public.can_see_plan(plan_id)
    ELSE actor_profile_id = public.my_profile_id()
  END
);

DROP POLICY IF EXISTS "activity insert by members" ON public.activity_events;
CREATE POLICY "activity insert by members"
ON public.activity_events FOR INSERT TO authenticated
WITH CHECK (
  ((actor_profile_id IS NULL) OR (actor_profile_id = public.my_profile_id()))
  AND CASE
    WHEN group_id IS NOT NULL THEN public.is_group_member(group_id)
    WHEN plan_id IS NOT NULL THEN public.can_see_plan(plan_id)
    ELSE actor_profile_id = public.my_profile_id()
  END
);

REVOKE EXECUTE ON FUNCTION public.enforce_profile_insert_defaults() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.lock_checkin_fields() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.lock_message_history() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.lock_parent_approval_fields() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_role_escalation() FROM anon, authenticated;