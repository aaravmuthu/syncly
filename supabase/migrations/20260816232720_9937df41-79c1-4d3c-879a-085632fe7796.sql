ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS school text,
  ADD COLUMN IF NOT EXISTS grad_year integer;

UPDATE public.profiles SET onboarded = true
WHERE onboarded = false AND display_name IS NOT NULL AND btrim(display_name) <> '' AND display_name <> 'New member';