CREATE TABLE public.location_shares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewer_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('hour','end_of_day','indefinite')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_profile_id, viewer_profile_id),
  CHECK (owner_profile_id <> viewer_profile_id)
);

CREATE INDEX location_shares_viewer_idx ON public.location_shares (viewer_profile_id);
CREATE INDEX location_shares_owner_idx ON public.location_shares (owner_profile_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.location_shares TO authenticated;
GRANT ALL ON public.location_shares TO service_role;

ALTER TABLE public.location_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read their outgoing shares"
ON public.location_shares FOR SELECT TO authenticated
USING (owner_profile_id = my_profile_id());

CREATE POLICY "Viewers read shares aimed at them"
ON public.location_shares FOR SELECT TO authenticated
USING (viewer_profile_id = my_profile_id());

CREATE POLICY "Owners create their own shares"
ON public.location_shares FOR INSERT TO authenticated
WITH CHECK (owner_profile_id = my_profile_id() AND viewer_profile_id <> my_profile_id());

CREATE POLICY "Owners update their own shares"
ON public.location_shares FOR UPDATE TO authenticated
USING (owner_profile_id = my_profile_id())
WITH CHECK (owner_profile_id = my_profile_id());

CREATE POLICY "Owners delete their own shares"
ON public.location_shares FOR DELETE TO authenticated
USING (owner_profile_id = my_profile_id());

CREATE POLICY "Viewers can remove themselves"
ON public.location_shares FOR DELETE TO authenticated
USING (viewer_profile_id = my_profile_id());

CREATE OR REPLACE FUNCTION public.touch_location_shares_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER location_shares_updated_at
BEFORE UPDATE ON public.location_shares
FOR EACH ROW EXECUTE FUNCTION public.touch_location_shares_updated_at();

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS location_paused_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS location_pause_indefinite BOOLEAN NOT NULL DEFAULT false;