CREATE TABLE public.contact_nicknames (
  owner_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nickname text NOT NULL CHECK (length(btrim(nickname)) BETWEEN 1 AND 40),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_profile_id, target_profile_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_nicknames TO authenticated;
GRANT ALL ON public.contact_nicknames TO service_role;

ALTER TABLE public.contact_nicknames ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own nicknames read" ON public.contact_nicknames
  FOR SELECT TO authenticated USING (owner_profile_id = public.my_profile_id());
CREATE POLICY "own nicknames insert" ON public.contact_nicknames
  FOR INSERT TO authenticated WITH CHECK (owner_profile_id = public.my_profile_id());
CREATE POLICY "own nicknames update" ON public.contact_nicknames
  FOR UPDATE TO authenticated USING (owner_profile_id = public.my_profile_id())
  WITH CHECK (owner_profile_id = public.my_profile_id());
CREATE POLICY "own nicknames delete" ON public.contact_nicknames
  FOR DELETE TO authenticated USING (owner_profile_id = public.my_profile_id());

CREATE TRIGGER t_contact_nicknames_touch BEFORE UPDATE ON public.contact_nicknames
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.location_shares ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;