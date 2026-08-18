CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  actor uuid := public.my_profile_id();
  owner uuid;
begin
  -- Trusted server code (ownership transfer, invite joins) is allowed through.
  if auth.role() = 'service_role' then
    return new;
  end if;

  select g.created_by into owner from public.groups g
   where g.id = coalesce(new.group_id, old.group_id);

  if tg_op = 'INSERT' then
    if new.role in ('owner','admin') and (actor is null or actor is distinct from owner) then
      raise exception 'Only the circle owner can grant admin roles';
    end if;
    return new;
  end if;

  if new.role is distinct from old.role then
    if actor is null or actor is distinct from owner then
      raise exception 'Only the circle owner can change member roles';
    end if;
    if old.role = 'owner' or new.role = 'owner' then
      raise exception 'Ownership cannot be reassigned here';
    end if;
  end if;
  return new;
end;
$function$;