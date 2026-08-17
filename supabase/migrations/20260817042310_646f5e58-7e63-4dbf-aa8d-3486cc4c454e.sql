ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS cover_theme text NOT NULL DEFAULT 'obsidian_emerald';