-- Family Plus: the optional paid plan for parents.
--
-- One row per guardian profile that has ever started Family Plus; no row means
-- the free plan. Billing isn't connected yet, so every row today is a
-- founding-family trial started from the Family Plus page. When a payment
-- provider is added, its webhook writes status/current_period_end here and the
-- app keeps reading the same columns.
--
-- A plan is in effect while status is trialing/active and current_period_end
-- is in the future. A teen gets Plus limits when any linked guardian has it.

CREATE TABLE public.family_plans (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  tier text NOT NULL DEFAULT 'plus' CHECK (tier IN ('plus')),
  status text NOT NULL CHECK (status IN ('trialing', 'active', 'canceled')),
  billing_interval text NOT NULL CHECK (billing_interval IN ('month', 'year')),
  source text NOT NULL DEFAULT 'founding' CHECK (source IN ('founding', 'billing')),
  current_period_end timestamptz NOT NULL,
  -- Set once, so canceling and restarting can't hand out a second free trial.
  trial_used_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- No policies: only the service role (server functions that resolve the
-- caller's own profile) can read or write plans.
ALTER TABLE public.family_plans ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.family_plans FROM anon, authenticated;
