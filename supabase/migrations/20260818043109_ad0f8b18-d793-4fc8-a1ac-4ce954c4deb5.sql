-- plan_conflicts: restrict updates to reporter or plan owner
DROP POLICY IF EXISTS "plan_conflicts_update" ON public.plan_conflicts;
CREATE POLICY "plan_conflicts_update" ON public.plan_conflicts
FOR UPDATE TO authenticated
USING (
  can_see_plan(plan_id)
  AND (profile_id = my_profile_id() OR is_plan_owner(plan_id))
)
WITH CHECK (
  can_see_plan(plan_id)
  AND (profile_id = my_profile_id() OR is_plan_owner(plan_id))
);

-- parent_approvals: only allow deleting requests that are still pending
DROP POLICY IF EXISTS "approvals delete own" ON public.parent_approvals;
CREATE POLICY "approvals delete own" ON public.parent_approvals
FOR DELETE TO authenticated
USING (
  profile_id = my_profile_id()
  AND status = 'pending'::approval_status
  AND responded_at IS NULL
);

-- parent_approvals: freeze token / parent identity fields after creation
CREATE OR REPLACE FUNCTION public.lock_parent_approval_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  NEW.token := OLD.token;
  NEW.plan_id := OLD.plan_id;
  NEW.profile_id := OLD.profile_id;
  NEW.parent_email := OLD.parent_email;
  NEW.parent_name := OLD.parent_name;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lock_parent_approval_fields ON public.parent_approvals;
CREATE TRIGGER lock_parent_approval_fields
BEFORE UPDATE ON public.parent_approvals
FOR EACH ROW EXECUTE FUNCTION public.lock_parent_approval_fields();