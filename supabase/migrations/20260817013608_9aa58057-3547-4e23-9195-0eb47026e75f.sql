ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS est_cost_min numeric,
  ADD COLUMN IF NOT EXISTS est_cost_max numeric;