ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS zip_code text,
  ADD COLUMN IF NOT EXISTS theme_preference text NOT NULL DEFAULT 'system';