-- 1) Defense in depth against role self-escalation on group_members.
REVOKE UPDATE ON public.group_members FROM authenticated;

CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  actor uuid := public.my_profile_id();
  owner uuid;
begin
  if new.role is distinct from old.role then
    select g.created_by into owner from public.groups g where g.id = old.group_id;
    if actor is null or actor is distinct from owner then
      raise exception 'Only the circle owner can change member roles';
    end if;
    if old.role = 'owner' or new.role = 'owner' then
      raise exception 'Ownership cannot be reassigned here';
    end if;
  end if;
  return new;
end;
$$;

DROP TRIGGER IF EXISTS t_group_members_no_escalation ON public.group_members;
CREATE TRIGGER t_group_members_no_escalation
BEFORE UPDATE ON public.group_members
FOR EACH ROW EXECUTE FUNCTION public.prevent_role_escalation();

-- 2) Parent approval bearer tokens must never be readable by other plan viewers.
REVOKE SELECT (token) ON public.parent_approvals FROM authenticated;
GRANT SELECT (
  id, plan_id, profile_id, parent_name, parent_email, status,
  condition_text, expires_at, responded_at, created_at
) ON public.parent_approvals TO authenticated;