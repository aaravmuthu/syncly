CREATE POLICY "owner manages member roles" ON public.group_members
FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_members.group_id AND g.created_by = public.my_profile_id())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_members.group_id AND g.created_by = public.my_profile_id())
  AND role <> 'owner'
);