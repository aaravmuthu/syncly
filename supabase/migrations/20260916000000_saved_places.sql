-- =============================================================================
-- Saved places
-- =============================================================================
-- Spots surfaced in the browser (src/lib/quorum/spots.functions.ts,
-- BrowseSpot) previously had no persistence path other than adding them
-- straight to a plan's recommendations -- there was no way to bookmark one
-- for later without rebuilding the search that found it. This table lets a
-- member save a spot to their own list; `key` is the same stable identifier
-- BrowseSpot already carries, so save/unsave is a straightforward upsert/
-- delete keyed on (profile_id, key) rather than needing a second lookup.
--
-- Strictly self-owned, same pattern as plan_constraints
-- (rls_policies_plan_lifecycle.sql): every policy checks
-- profile_id = my_profile_id(), no group-visibility case at all -- a saved
-- place is never shared with anyone else by default.

CREATE TABLE public.saved_places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  key text NOT NULL,
  title text NOT NULL,
  subtitle text,
  address text,
  cuisine text,
  price_level text,
  kind text NOT NULL CHECK (kind IN ('food', 'activity')),
  cost_min numeric,
  cost_max numeric,
  lat numeric NOT NULL,
  lon numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, key)
);

CREATE INDEX saved_places_profile_id_idx ON public.saved_places (profile_id, created_at DESC);

ALTER TABLE public.saved_places ENABLE ROW LEVEL SECURITY;

CREATE POLICY saved_places_select_own
  ON public.saved_places FOR SELECT
  USING (profile_id = public.my_profile_id());

CREATE POLICY saved_places_insert_own
  ON public.saved_places FOR INSERT
  WITH CHECK (profile_id = public.my_profile_id());

CREATE POLICY saved_places_delete_own
  ON public.saved_places FOR DELETE
  USING (profile_id = public.my_profile_id());
