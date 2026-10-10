-- =============================================================================
-- AI itineraries on plans
-- =============================================================================
-- The Magic AI plan builder now drafts a whole night (dinner -> bowling ->
-- dessert): ordered stops, up to three real venues each, the host's pick per
-- stop, timing, and an invite line. It's stored as one jsonb document on the
-- plan so every member sees the same itinerary. It holds public place data
-- only -- venue names, addresses and coordinates -- never anyone's home or
-- private answers, so the plan's existing RLS (members of the group) covers it
-- with no new policy. Validated in the app by itinerarySchema
-- (src/lib/quorum/itinerary.ts); null for every plan made the old way.

ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS itinerary jsonb;

ALTER TABLE public.plans
  ADD CONSTRAINT plans_itinerary_is_object
  CHECK (itinerary IS NULL OR (jsonb_typeof(itinerary) = 'object' AND pg_column_size(itinerary) < 32768));
