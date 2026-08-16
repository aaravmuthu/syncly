CREATE POLICY "groups readable by creator"
ON public.groups FOR SELECT TO authenticated
USING (created_by = public.my_profile_id());

DELETE FROM public.groups WHERE name IN ('curl test','curl test2');