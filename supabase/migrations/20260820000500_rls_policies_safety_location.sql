-- =============================================================================
-- Syncly — Row Level Security policies, batch 4 (guardian safety / location)
-- =============================================================================
-- Continues from 20260820000400_rls_policies_messaging.sql. Covers the
-- "location-sharing" stage of the onboarding -> group creation -> messaging
-- -> location-sharing flow: guardian_links, safe_zones, checkin_requests.
-- location_shares and geofence_events are reviewed and need no client-facing
-- policy (see notes at the end). Also includes a follow-up policy on
-- location_pings (already-applied in batch 1) per your explicit go-ahead —
-- does NOT edit 20260820000100_rls_policies.sql itself.
--
-- None of batches 2-4 have been pushed to the live database yet (only batch
-- 1 is live, confirmed via `supabase migration list --linked`).
-- =============================================================================


-- =============================================================================
-- guardian_links
-- =============================================================================
-- Access model confirmed 2026-08-20 by tracing every guardian_links call
-- site in src/ (guardian.functions.ts, guardian.server.ts, friend.server.ts):
--   SELECT: teen_profile_id = my_profile_id(). Both call sites
--           (getMyGuardians, getMyRadar) are teen-side reads of "who are my
--           guardians". No guardian-side SELECT via the user-scoped client
--           exists — buildGuardianDashboard and friend.server.ts's reads all
--           go through supabaseAdmin.
--   DELETE: guardian_profile_id = my_profile_id() OR
--           teen_profile_id = my_profile_id(). unlinkGuardian
--           (guardian.functions.ts) has no ownership check before deleting
--           by id — RLS is the only gate — and nothing in the naming or
--           product shape suggests only one side of the link should be able
--           to sever it, so both directions are allowed.
--   INSERT / UPDATE: none. Creating a link (linkTeenByCode, via the sync-code
--           flow) runs entirely on supabaseAdmin.

CREATE POLICY guardian_links_select_teen
  ON public.guardian_links FOR SELECT
  TO authenticated
  USING (teen_profile_id = public.my_profile_id());

CREATE POLICY guardian_links_delete_either_party
  ON public.guardian_links FOR DELETE
  TO authenticated
  USING (guardian_profile_id = public.my_profile_id() OR teen_profile_id = public.my_profile_id());


-- =============================================================================
-- safe_zones
-- =============================================================================
-- Access model confirmed 2026-08-20 (guardian.functions.ts: addSafeZone,
-- removeSafeZone, getMyRadar):
--   SELECT: teen_profile_id = my_profile_id(). getMyRadar's only client-side
--           read. No guardian-side SELECT via the user-scoped client exists.
--   DELETE: teen_profile_id = my_profile_id() OR is_my_guardian(teen_profile_id).
--           removeSafeZone has NO ownership/link check in application code
--           at all — RLS is the sole gate here, and it needs to mirror the
--           trust boundary addSafeZone already enforces at the app layer
--           (assertLinked lets a linked guardian create a zone for their
--           teen), so a linked guardian can also remove one.
--   INSERT / UPDATE: none. addSafeZone runs on supabaseAdmin after an
--           explicit assertLinked() check; no client-side insert/update path
--           exists.

CREATE POLICY safe_zones_select_teen
  ON public.safe_zones FOR SELECT
  TO authenticated
  USING (teen_profile_id = public.my_profile_id());

CREATE POLICY safe_zones_delete_teen_or_guardian
  ON public.safe_zones FOR DELETE
  TO authenticated
  USING (teen_profile_id = public.my_profile_id() OR public.is_my_guardian(teen_profile_id));


-- =============================================================================
-- checkin_requests
-- =============================================================================
-- Access model confirmed 2026-08-20 (guardian.functions.ts: getMyCheckins;
-- guardian.server.ts: requestCheckin, answerCheckin):
--   SELECT: teen_profile_id = my_profile_id(). getMyCheckins is the only
--           client-side read (filtered to status='pending' at the app
--           layer, not the RLS layer — the policy allows the teen to see
--           all of their own rows regardless of status). No guardian-side
--           SELECT via the user-scoped client exists.
--   INSERT / UPDATE / DELETE: none. requestCheckin (the guardian asking for
--           a check-in) and answerCheckin (the teen responding) both run
--           entirely on supabaseAdmin in guardian.server.ts.

CREATE POLICY checkin_requests_select_teen
  ON public.checkin_requests FOR SELECT
  TO authenticated
  USING (teen_profile_id = public.my_profile_id());


-- =============================================================================
-- location_shares — reviewed, no policy added
-- =============================================================================
-- Every call site (friend.server.ts, sharing.server.ts — the entire "Find My
-- Friends" engine, per that file's own header comment: "Every read is
-- authorised in code against location_shares before any pin leaves the
-- server: the admin client is used only after the caller has been proven to
-- be an active viewer") uses supabaseAdmin exclusively. RLS stays enabled
-- with zero policies; nothing in src/ ever needs direct client access to
-- this table.


-- =============================================================================
-- geofence_events — reviewed, no policy added
-- =============================================================================
-- Single call site total across src/ (guardian.server.ts's zone-entry/exit
-- recorder), using supabaseAdmin. RLS stays enabled with zero policies.


-- =============================================================================
-- location_pings — follow-up (does not edit 20260820000100_rls_policies.sql)
-- =============================================================================
-- Confirmed 2026-08-20: dm.functions.ts's getThread reads a DM peer's latest
-- location_pings row directly (`.eq("profile_id", peer.id)`), with no
-- location_shares check in application code — RLS is the only gate. Batch 1
-- scoped location_pings SELECT to own-row + linked-guardian only (an
-- explicit choice at the time), so this read has been silently returning
-- nothing for ordinary friend DMs. Per your go-ahead, adding a third SELECT
-- clause: an active (not hidden, not expired) location_shares viewer.

CREATE POLICY location_pings_select_active_share_viewer
  ON public.location_pings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.location_shares ls
      WHERE ls.owner_profile_id = location_pings.profile_id
        AND ls.viewer_profile_id = public.my_profile_id()
        AND ls.hidden = false
        AND (ls.expires_at IS NULL OR ls.expires_at > now())
    )
  );
