-- =============================================================================
-- Syncly — Row Level Security policies
-- =============================================================================
-- Applies on top of 20260820000000_initial_schema.sql, which enables RLS on
-- every table with zero policies (default-deny). This migration is authored
-- and reviewed table-by-table, highest-sensitivity first. Each section below
-- is only added once its access model has been explicitly confirmed.
--
-- Design notes that apply across all tables in this file:
--   * "own row" always means the row's profile_id/user_id resolves back to
--     the caller via public.my_profile_id() / auth.uid().
--   * Postgres combines multiple PERMISSIVE policies for the same command
--     with OR — so "own row OR linked guardian/teen" is expressed as two
--     separate policies rather than one big USING clause, to keep each
--     policy's intent readable in isolation.
--   * No DELETE policy is added unless explicitly called for. Absence of a
--     DELETE policy means authenticated/anon clients cannot delete rows at
--     all (service_role still can) — this is a deliberate default, not an
--     oversight, since most of these tables are meant to be an audit trail
--     (location_pings, guardian_alerts) rather than user-editable state.
-- =============================================================================


-- =============================================================================
-- profiles
-- =============================================================================
-- Access model confirmed 2026-08-20:
--   SELECT: caller's own profile, OR a profile the caller is linked to as
--           guardian<->teen (via guardian_links, through is_my_guardian/is_my_teen).
--           Group-member and DM-contact visibility were explicitly NOT
--           included in this pass — group rosters / chat sender names / DM
--           contact info will need their own policy (or a security-definer
--           RPC) added later if the UI needs to render other members' names.
--   INSERT: caller may only create a profile row for themself (onboarding).
--   UPDATE: caller may only update their own profile. Guardians do NOT get
--           write access to their teen's profile in this pass.
--   DELETE: none — account/profile deletion is a service_role/admin-only
--           operation, not exposed to clients.

CREATE POLICY profiles_select_own
  ON public.profiles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY profiles_select_linked_guardian_teen
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_my_guardian(id) OR public.is_my_teen(id));

CREATE POLICY profiles_insert_own
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY profiles_update_own
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- =============================================================================
-- location_pings
-- =============================================================================
-- Access model confirmed 2026-08-20:
--   SELECT: caller's own pings, OR a linked guardian's teen's pings (treats
--           the guardian_links relationship itself as standing consent,
--           independent of the more granular location_shares table).
--           location_shares-based viewer access and plan-participant access
--           were explicitly NOT included in this pass — add later if the
--           "who's arrived" live-plan view or peer location sharing needs it.
--   INSERT: caller may only insert pings for themself (own device reports
--           its own location; no one can write a ping on someone else's
--           behalf).
--   UPDATE / DELETE: none. This table is an append-only ping log — even the
--           owner cannot edit or erase history through the client.

CREATE POLICY location_pings_select_own
  ON public.location_pings FOR SELECT
  TO authenticated
  USING (profile_id = public.my_profile_id());

CREATE POLICY location_pings_select_guardian
  ON public.location_pings FOR SELECT
  TO authenticated
  USING (public.is_my_guardian(profile_id));

CREATE POLICY location_pings_insert_own
  ON public.location_pings FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = public.my_profile_id());


-- =============================================================================
-- guardian_alerts
-- =============================================================================
-- Access model confirmed 2026-08-20 by tracing actual call sites in src/:
--   SELECT: the addressed guardian only (guardian_profile_id = my_profile_id()).
--           Not teen-visible — matches the explicit privacy rule documented at
--           the top of src/lib/quorum/guardian.server.ts ("a guardian only
--           ever sees data about a teen they are explicitly linked to... never
--           the group's private answers or other members' accounts"); nothing
--           in src/ has a teen reading their own guardian_alerts rows. The
--           current guardian dashboard read (buildGuardianDashboard) goes
--           through supabaseAdmin/service_role and doesn't depend on this
--           policy, but it's added as a baseline for any future direct or
--           realtime client read.
--   INSERT: none. Both insert call sites — alertGuardians() and the
--           checkin-answered flow, both in guardian.server.ts — use
--           supabaseAdmin (service_role), which bypasses RLS entirely. No
--           authenticated/anon client ever inserts a guardian_alerts row.
--   UPDATE: the addressed guardian only. Required by markAlertsRead
--           (guardian.functions.ts), which runs
--           `context.supabase.from("guardian_alerts").update({ read: true })
--           .eq("guardian_profile_id", me)` on the user-scoped client, not
--           service_role — so this policy is load-bearing, not defense-in-depth.
--   DELETE: none — no delete call site exists.

CREATE POLICY guardian_alerts_select_own
  ON public.guardian_alerts FOR SELECT
  TO authenticated
  USING (guardian_profile_id = public.my_profile_id());

CREATE POLICY guardian_alerts_update_own
  ON public.guardian_alerts FOR UPDATE
  TO authenticated
  USING (guardian_profile_id = public.my_profile_id())
  WITH CHECK (guardian_profile_id = public.my_profile_id());


-- =============================================================================
-- groups
-- =============================================================================
-- Access model confirmed 2026-08-20 by tracing actual call sites in src/:
--   SELECT: a group member (is_group_member(id)), OR the row's own creator
--           (created_by = my_profile_id()). The creator clause is NOT
--           optional: createGroup (plan.functions.ts) does
--           `supabase.from("groups").insert({...}).select("*").single()` on
--           the user-scoped client, and only inserts the corresponding
--           group_members row (which would satisfy is_group_member) *after*
--           this call returns. Postgres filters INSERT ... RETURNING through
--           the table's SELECT policy, so without the created_by clause this
--           INSERT's own .select() would come back empty and createGroup
--           would break immediately, despite the insert succeeding.
--   INSERT: caller must be the row's creator (created_by = my_profile_id()) —
--           createGroup always sets created_by to the caller's own profile id.
--   UPDATE: a group admin/owner (is_group_admin(id)). updateGroupLook
--           (group.functions.ts) checks is_group_admin in application code
--           first, but then runs the update on the user-scoped client
--           (`supabase.from("groups").update(patch)`), so RLS must
--           independently allow it — this is load-bearing, not
--           defense-in-depth.
--   DELETE: none. deleteGroup (group.functions.ts) runs exclusively on
--           supabaseAdmin/service_role after an application-level
--           is-owner check; no authenticated/anon client ever deletes a
--           groups row directly.

CREATE POLICY groups_select_member_or_creator
  ON public.groups FOR SELECT
  TO authenticated
  USING (public.is_group_member(id) OR created_by = public.my_profile_id());

CREATE POLICY groups_insert_own
  ON public.groups FOR INSERT
  TO authenticated
  WITH CHECK (created_by = public.my_profile_id());

CREATE POLICY groups_update_admin
  ON public.groups FOR UPDATE
  TO authenticated
  USING (public.is_group_admin(id))
  WITH CHECK (public.is_group_admin(id));
