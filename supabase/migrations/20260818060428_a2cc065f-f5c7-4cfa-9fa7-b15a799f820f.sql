CREATE POLICY "reporters or hosts delete conflicts" ON public.plan_conflicts
FOR DELETE TO authenticated
USING (profile_id = public.my_profile_id() OR public.is_plan_owner(plan_id));