-- =============================================================================
-- Syncly — missing UNIQUE constraints behind several .upsert(onConflict) calls
-- =============================================================================
-- Reported bug: "there is no unique or exclusion constraint matching the ON
-- CONFLICT specification" on location sharing. Same root cause as the
-- group_members fix earlier this session: the schema was reconstructed from
-- src/integrations/supabase/types.ts (no original migrations existed), and
-- Supabase's generated types capture columns/types/foreign keys but not
-- UNIQUE constraints — so any unique constraint the original project had is
-- silently missing here unless it happened to double as a PRIMARY KEY.
--
-- Every .upsert(..., { onConflict: ... }) call site in src/ was traced and
-- checked against live constraints (information_schema.table_constraints on
-- the linked project), then confirmed with a live dummy-value upsert against
-- each target (safe: Postgres validates the ON CONFLICT target — and 42P10s
-- on a bad one — before ever touching a row, so this doesn't require real
-- FK-valid data). Four call sites are broken, one looked suspicious but
-- isn't:
--
--   location_shares (owner_profile_id, viewer_profile_id)  -> 42P10, BROKEN
--     sharing.server.ts: setShare(), ensureGuardianShare()
--     This is the reported bug — every "share my location" / "watch a
--     friend" action, and every guardian-link's implied indefinite share,
--     fails here.
--
--   votes (plan_id, profile_id)                             -> 42P10, BROKEN
--     conflict.functions.ts, plan.functions.ts: casting/changing a vote
--
--   plan_constraints (plan_id, profile_id)                  -> 42P10, BROKEN
--     plan.functions.ts, recommend.server.ts: submitting your private
--     answers to a plan — this is the core "everyone answers privately"
--     flow the whole product is built around.
--
--   guardian_links (guardian_profile_id, teen_profile_id)   -> 42P10, BROKEN
--     guardian.server.ts: linking a teen and guardian account
--
--   direct_reads (thread_id, profile_id)                    -> fine, not touched
--     Already has a PRIMARY KEY on (profile_id, thread_id) — same column
--     SET as the onConflict target, just listed in the opposite order in
--     the app code. Postgres matches an ON CONFLICT target by column set,
--     not by the order they're listed in, so this one already works;
--     confirmed live (a dummy upsert here correctly fails on a foreign-key
--     violation, not 42P10, meaning it got past conflict resolution fine).
--
-- All four fixes below are additive UNIQUE constraints only — no data is
-- touched, no existing policy or application code changes, matching the
-- group_members fix from earlier tonight.
-- =============================================================================

ALTER TABLE public.location_shares
  ADD CONSTRAINT location_shares_owner_viewer_key UNIQUE (owner_profile_id, viewer_profile_id);

ALTER TABLE public.votes
  ADD CONSTRAINT votes_plan_id_profile_id_key UNIQUE (plan_id, profile_id);

ALTER TABLE public.plan_constraints
  ADD CONSTRAINT plan_constraints_plan_id_profile_id_key UNIQUE (plan_id, profile_id);

ALTER TABLE public.guardian_links
  ADD CONSTRAINT guardian_links_guardian_teen_key UNIQUE (guardian_profile_id, teen_profile_id);
