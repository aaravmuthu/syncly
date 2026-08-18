-- 1. Avatars bucket: writes are server-side only; clients keep read access to their own folder.
DROP POLICY IF EXISTS "avatars own insert" ON storage.objects;
DROP POLICY IF EXISTS "avatars own update" ON storage.objects;
DROP POLICY IF EXISTS "avatars own delete" ON storage.objects;

DROP POLICY IF EXISTS "avatars own select" ON storage.objects;
CREATE POLICY "avatars own select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'avatars'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND (owner IS NULL OR owner = auth.uid())
);

-- 2. group_messages: senders may edit/retract their own messages only.
CREATE POLICY "senders edit own messages"
ON public.group_messages FOR UPDATE TO authenticated
USING (sender_id = public.my_profile_id() AND public.is_group_member(group_id))
WITH CHECK (
  sender_id = public.my_profile_id()
  AND public.is_group_member(group_id)
  AND system_type IS NULL
);

CREATE POLICY "senders delete own messages"
ON public.group_messages FOR DELETE TO authenticated
USING (sender_id = public.my_profile_id() AND public.is_group_member(group_id));

-- 3. Block self-granted admin/owner roles at insert time (group_preferences writes gate on is_group_admin).
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

DROP TRIGGER IF EXISTS t_group_members_no_escalation_insert ON public.group_members;
CREATE TRIGGER t_group_members_no_escalation_insert
BEFORE INSERT ON public.group_members
FOR EACH ROW EXECUTE FUNCTION public.prevent_role_escalation();