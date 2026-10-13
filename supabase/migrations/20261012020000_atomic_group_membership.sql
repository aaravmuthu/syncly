-- A failed transfer/departure must not leave an ownerless or partially edited circle.
CREATE OR REPLACE FUNCTION public.change_group_membership(
  _group_id uuid, _actor_id uuid, _new_owner_id uuid DEFAULT NULL, _leave boolean DEFAULT false
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor_role text; transferred boolean := false;
BEGIN
  PERFORM 1 FROM public.groups WHERE id = _group_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Group not found'; END IF;
  SELECT role INTO actor_role FROM public.group_members
    WHERE group_id = _group_id AND profile_id = _actor_id FOR UPDATE;
  IF actor_role IS NULL THEN RAISE EXCEPTION 'You are not in this group'; END IF;
  IF _new_owner_id = _actor_id THEN RAISE EXCEPTION 'Choose another member as the new owner'; END IF;
  IF _new_owner_id IS NOT NULL THEN
    IF actor_role <> 'owner' THEN RAISE EXCEPTION 'Only the group owner can transfer ownership'; END IF;
    PERFORM 1 FROM public.group_members
      WHERE group_id = _group_id AND profile_id = _new_owner_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'That member is not in this group'; END IF;
    UPDATE public.group_members SET role = 'owner'
      WHERE group_id = _group_id AND profile_id = _new_owner_id;
    UPDATE public.groups SET created_by = _new_owner_id WHERE id = _group_id;
    UPDATE public.group_members SET role = 'member'
      WHERE group_id = _group_id AND profile_id = _actor_id;
    transferred := true;
  ELSIF NOT _leave OR actor_role = 'owner' THEN
    RAISE EXCEPTION 'Choose a new owner or delete the group before leaving';
  END IF;
  IF _leave THEN
    DELETE FROM public.votes WHERE profile_id = _actor_id
      AND plan_id IN (SELECT id FROM public.plans WHERE group_id = _group_id);
    DELETE FROM public.plan_constraints WHERE profile_id = _actor_id
      AND plan_id IN (SELECT id FROM public.plans WHERE group_id = _group_id);
    DELETE FROM public.plan_participants WHERE profile_id = _actor_id
      AND plan_id IN (SELECT id FROM public.plans WHERE group_id = _group_id);
    DELETE FROM public.group_members WHERE group_id = _group_id AND profile_id = _actor_id;
  END IF;
  RETURN transferred;
END;
$$;
REVOKE ALL ON FUNCTION public.change_group_membership(uuid,uuid,uuid,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.change_group_membership(uuid,uuid,uuid,boolean) TO service_role;
