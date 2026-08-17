CREATE TABLE public.plan_conflicts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL,
  detail text,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.plan_conflicts TO authenticated;
GRANT ALL ON public.plan_conflicts TO service_role;

ALTER TABLE public.plan_conflicts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plan_conflicts_select" ON public.plan_conflicts
  FOR SELECT TO authenticated
  USING (public.can_see_plan(plan_id));

CREATE POLICY "plan_conflicts_insert" ON public.plan_conflicts
  FOR INSERT TO authenticated
  WITH CHECK (public.can_see_plan(plan_id) AND (profile_id IS NULL OR profile_id = public.my_profile_id()));

CREATE POLICY "plan_conflicts_update" ON public.plan_conflicts
  FOR UPDATE TO authenticated
  USING (public.can_see_plan(plan_id))
  WITH CHECK (public.can_see_plan(plan_id));

CREATE INDEX plan_conflicts_plan_idx ON public.plan_conflicts(plan_id) WHERE resolved = false;