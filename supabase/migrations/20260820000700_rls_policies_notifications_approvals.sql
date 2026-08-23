-- =============================================================================
-- Syncly — Row Level Security policies, batch 6 (notifications, approvals,
-- transport) — final batch, completes RLS coverage for all 30 tables
-- =============================================================================
-- Continues from 20260820000600_rls_policies_plan_lifecycle.sql. Covers
-- notifications, parent_approvals, transport_assignments. transport_profiles
-- is reviewed and needs no client-facing policy (see note at the end).
--
-- None of batches 2-6 have been pushed to the live database yet (only batch
-- 1 is live, confirmed via `supabase migration list --linked`).
-- =============================================================================


-- =============================================================================
-- notifications
-- =============================================================================
-- Access model confirmed 2026-08-20 by tracing every notifications call site
-- in src/ (insight.functions.ts: listNotifications, markNotificationsRead;
-- this app's own rlscheck.server.ts probe explicitly tests that another
-- user's notifications SELECT/UPDATE/DELETE must all be blocked — its
-- checks are titled "notifications · SELECT/UPDATE/DELETE another user's
-- rows"). guardian.server.ts, friend.server.ts, notify.server.ts, and
-- sharing.server.ts all write notifications exclusively via supabaseAdmin
-- (the shared notify* helpers that fan out to multiple recipients at once —
-- a role a single caller's own-row policy could never satisfy anyway).
--   SELECT: profile_id = my_profile_id(). listNotifications has no
--           .eq("profile_id", ...) filter at all — fully RLS-dependent.
--   UPDATE: profile_id = my_profile_id(). markNotificationsRead already
--           self-filters at the app layer too, but RLS is what the probe
--           actually verifies.
--   INSERT / DELETE: none via client. All inserts are the admin-only fan-out
--           helpers; the only delete is rlscheck's own probe cleanup, via
--           the admin client.

CREATE POLICY notifications_select_own
  ON public.notifications FOR SELECT
  TO authenticated
  USING (profile_id = public.my_profile_id());

CREATE POLICY notifications_update_own
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (profile_id = public.my_profile_id())
  WITH CHECK (profile_id = public.my_profile_id());


-- =============================================================================
-- parent_approvals
-- =============================================================================
-- Access model confirmed 2026-08-20 (plan.functions.ts: requestParentApproval,
-- getPlan's approvals read; guardian.server.ts: decideApproval, admin-only;
-- this app's own rlscheck.server.ts probe: "parent_approvals · token
-- exposure").
--
-- *** COLUMN-LEVEL RESTRICTION — different from every other table in this
-- migration set, and deliberately so ***
-- requestParentApproval's own comment states the intended design outright:
-- "The token is a bearer credential: it is generated here and handed back
-- exactly once. Clients can no longer read the token column at all." And
-- getPlan's read comment: "Never ship the parent token to plan viewers — it
-- is a bearer credential that lets the holder answer the approval." Unlike
-- the profiles column-scoping question flagged in
-- 20260820000300_profiles_group_visibility.sql, there's no already-applied
-- policy whose column reach this would narrow — this table has had zero
-- policies until now, and nothing in src/ ever re-reads the token column
-- after insert (requestParentApproval returns the token from its own local
-- variable, not from a SELECT). Restricting the authenticated role's SELECT
-- grant to every column except `token` therefore has no functional
-- downside, and is exactly what both code comments and the rlscheck probe
-- require: any plan member should see who's approved/pending (status), but
-- never anyone's actual token — a thing RLS row-policies alone cannot
-- express, since it's a column-level, not row-level, restriction.
--
--   SELECT: can_see_plan(plan_id) at the row level, `token` column excluded
--           from the authenticated role's grant entirely. getPlan reads
--           every participant's approval status for a plan, not just the
--           caller's own.
--   INSERT: profile_id = my_profile_id() AND can_see_plan(plan_id).
--           requestParentApproval has no app-level check beyond this.
--   UPDATE / DELETE: none via client. decideApproval (the guardian
--           responding) runs entirely on supabaseAdmin.

REVOKE SELECT ON public.parent_approvals FROM authenticated;
GRANT SELECT (
  id, plan_id, profile_id, status, parent_name, parent_email,
  condition_text, created_at, expires_at, responded_at
) ON public.parent_approvals TO authenticated;

CREATE POLICY parent_approvals_select_visible_plan
  ON public.parent_approvals FOR SELECT
  TO authenticated
  USING (public.can_see_plan(plan_id));

CREATE POLICY parent_approvals_insert_own
  ON public.parent_approvals FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = public.my_profile_id() AND public.can_see_plan(plan_id));


-- =============================================================================
-- transport_assignments
-- =============================================================================
-- Access model confirmed 2026-08-20 (plan.functions.ts: getDashboard,
-- getPlan; guardian.functions.ts: saveVehicleDetails; get-plan.ts MCP tool):
--   SELECT: can_see_plan(plan_id). No app-level check beyond RLS on either
--           read site.
--   UPDATE: (driver_profile_id = my_profile_id() OR driver_profile_id IS NULL)
--           AND can_see_plan(plan_id). saveVehicleDetails has zero
--           ownership check in code — RLS is the only gate. driver_profile_id
--           is nullable in the schema (an assignment can exist before anyone
--           claims it), so a strict driver-only policy would make it
--           impossible to ever fill in vehicle details on an unclaimed
--           assignment; allowing any visible-plan member to edit a
--           driverless row (in addition to the assigned driver editing
--           their own) matches that nullability while still requiring plan
--           membership as a floor. This is an inferred default, not a
--           literal transcription of an app-level check — flag if your
--           mental model for "who can edit ride details" differs.
--   INSERT / DELETE: none via client. recommend.server.ts's regeneration
--           (delete-then-reinsert) runs entirely on supabaseAdmin.

CREATE POLICY transport_assignments_select_visible_plan
  ON public.transport_assignments FOR SELECT
  TO authenticated
  USING (public.can_see_plan(plan_id));

CREATE POLICY transport_assignments_update_driver_or_unclaimed
  ON public.transport_assignments FOR UPDATE
  TO authenticated
  USING (
    (driver_profile_id = public.my_profile_id() OR driver_profile_id IS NULL)
    AND public.can_see_plan(plan_id)
  )
  WITH CHECK (
    (driver_profile_id = public.my_profile_id() OR driver_profile_id IS NULL)
    AND public.can_see_plan(plan_id)
  );


-- =============================================================================
-- transport_profiles — reviewed, no policy added
-- =============================================================================
-- Single call site total across src/ (approval.functions.ts, reading transport
-- preferences during recommendation/carpool logic), using supabaseAdmin.
-- Despite the column shape looking like user-editable settings
-- (has_car, can_drive, passenger_capacity, needs_ride, ...), nothing in
-- src/ currently exposes a client-side write path for it at all — confirmed
-- via a repo-wide search, not just the quorum/mcp directories. RLS stays
-- enabled with zero policies. Worth a product check on your end: if this
-- table is meant to be user-editable (e.g. during onboarding) and just
-- doesn't have a wired-up UI yet, that's a src/ gap to close separately —
-- not something to guess a policy for here.


-- =============================================================================
-- group_preferences
-- =============================================================================
-- Caught while writing this migration's closing summary — every other table
-- from the original 30 had been traced across batches 1-6, but this one was
-- missed. Access model confirmed 2026-08-20 (insight.functions.ts:
-- getGroupMemory; memory.server.ts's aggregate-writer):
--   SELECT: is_group_member(group_id). getGroupMemory already checks this
--           via RPC before reading — belt and suspenders, RLS is not the
--           sole gate here, unlike most of this rollout.
--   INSERT / UPDATE / DELETE: none via client. memory.server.ts upserts the
--           aggregated group-memory row exclusively via supabaseAdmin.

CREATE POLICY group_preferences_select_member
  ON public.group_preferences FOR SELECT
  TO authenticated
  USING (public.is_group_member(group_id));


-- =============================================================================
-- END OF RLS ROLLOUT — all 30 tables from 20260820000000_initial_schema.sql
-- have now been explicitly reviewed across batches 1-6. Tables with policies:
-- profiles, groups, direct_threads, plans, recommendations, safe_zones,
-- group_members, group_messages, group_preferences, guardian_links,
-- guardian_alerts, checkin_requests, direct_messages, direct_reactions,
-- direct_reads, location_pings, message_reads, notifications,
-- parent_approvals, plan_conflicts, plan_constraints, plan_participants,
-- activity_events, transport_assignments, votes. Tables deliberately left
-- at zero policies (reviewed, all client access confirmed admin-only):
-- contact_nicknames, delay_pings, location_shares, geofence_events,
-- transport_profiles.
-- =============================================================================
