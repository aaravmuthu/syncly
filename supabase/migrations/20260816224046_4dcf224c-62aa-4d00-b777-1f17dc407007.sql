-- parent_approvals: replace broad owner ALL policy with scoped policies
DROP POLICY IF EXISTS "approvals write own" ON public.parent_approvals;

CREATE POLICY "approvals insert own"
ON public.parent_approvals FOR INSERT TO authenticated
WITH CHECK (profile_id = my_profile_id() AND status = 'pending'::approval_status AND responded_at IS NULL);

CREATE POLICY "approvals delete own"
ON public.parent_approvals FOR DELETE TO authenticated
USING (profile_id = my_profile_id());

-- Owner may tweak parent contact details while pending, but cannot record a decision.
CREATE POLICY "approvals update own pending"
ON public.parent_approvals FOR UPDATE TO authenticated
USING (profile_id = my_profile_id() AND status = 'pending'::approval_status)
WITH CHECK (profile_id = my_profile_id() AND status = 'pending'::approval_status AND responded_at IS NULL);

-- votes: split ALL policy so every command validates plan visibility
DROP POLICY IF EXISTS "votes own write" ON public.votes;

CREATE POLICY "votes insert own"
ON public.votes FOR INSERT TO authenticated
WITH CHECK (profile_id = my_profile_id() AND can_see_plan(plan_id));

CREATE POLICY "votes update own"
ON public.votes FOR UPDATE TO authenticated
USING (profile_id = my_profile_id() AND can_see_plan(plan_id))
WITH CHECK (profile_id = my_profile_id() AND can_see_plan(plan_id));

CREATE POLICY "votes delete own"
ON public.votes FOR DELETE TO authenticated
USING (profile_id = my_profile_id() AND can_see_plan(plan_id));