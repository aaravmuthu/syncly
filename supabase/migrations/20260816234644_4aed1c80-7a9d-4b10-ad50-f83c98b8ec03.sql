ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS food_vibe text,
  ADD COLUMN IF NOT EXISTS search_radius_miles integer;