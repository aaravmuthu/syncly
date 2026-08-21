-- =============================================================================
-- Syncly — Row Level Security policies, batch 2
-- =============================================================================
-- Continues from 20260820000100_rls_policies.sql (profiles, location_pings,
-- guardian_alerts, groups — applied and verified 32/32 live checks passing).
-- Does NOT modify any already-applied migration. Authored table-by-table,
-- traced against actual src/ call sites, in the order the app actually
-- touches them along the onboarding -> group creation -> messaging ->
-- location-sharing flow. Same design notes as batch 1 apply throughout
-- (own-row baseline, no DELETE unless a real call site needs it, etc.).
-- =============================================================================


-- =============================================================================
-- group_members
-- =============================================================================
-- Fixes a known issue found during batch-1 live verification: createGroup
-- (plan.functions.ts) inserts the creator into group_members as 'owner' using
-- the user-scoped client, right after creating the groups row. With RLS
-- enabled and zero group_members policies, that insert silently fails (the
-- app doesn't check its error) — so group creators never actually become
-- members/admins of their own group, and groups_update_admin (batch 1) can
-- never resolve true for them either.
--
-- Access model confirmed 2026-08-20 by tracing every group_members call site
-- in src/ (list-circles.ts, planner.functions.ts, dm.functions.ts,
-- plan.functions.ts, group.functions.ts, sharing.server.ts, friend.server.ts,
-- notify.server.ts, fairpoint.server.ts):
--   SELECT: is_group_member(group_id) — i.e. "if I'm a member of this row's
--           group, I can see the whole roster." This single clause covers
--           both observed query shapes: "which groups am I in"
--           (.eq("profile_id", me), matched via the caller's own row
--           trivially satisfying is_group_member) and "who else is in group
--           X" (.eq("group_id", X) / .in("group_id", [...])), used in
--           listGroups, getGroup, listContacts, list_circles (MCP tool),
--           getPlanDefaults/fairSpot (as a bare membership gate: a
--           .select("id").limit(1) call whose only purpose is "throw
--           Forbidden if this comes back empty").
--   INSERT: only the group's own creator may insert themselves as 'owner'.
--           This is intentionally narrow — it exists solely to un-break
--           createGroup's self-insert. The join-by-invite-code path
--           (joinGroup, plan.functions.ts) inserts new 'member' rows via
--           supabaseAdmin/service_role and does not need a client policy.
--   UPDATE: none. Every role change/ownership transfer (transferGroupOwnership,
--           leaveGroup's ownership handoff) runs on supabaseAdmin.
--   DELETE: none. Leaving a group (leaveGroup) runs on supabaseAdmin.
--
-- Known follow-on gap (not fixed here, flagging for later): the embedded
-- `profiles(...)` joins in listGroups/getGroup/listContacts/list_circles all
-- read other members' display_name/avatar through this table's roster
-- visibility, but the `profiles` SELECT policy from batch 1 only allows
-- own-row + guardian/teen-linked visibility — not group-member visibility.
-- Those embedded profile fields will come back null for co-members who
-- aren't also a linked guardian/teen. Worth a `profiles_select_group_member`
-- policy in a later batch once you're ready to revisit an already-applied
-- table.

CREATE POLICY group_members_select_roster
  ON public.group_members FOR SELECT
  TO authenticated
  USING (public.is_group_member(group_id));

CREATE POLICY group_members_insert_creator_as_owner
  ON public.group_members FOR INSERT
  TO authenticated
  WITH CHECK (
    profile_id = public.my_profile_id()
    AND role = 'owner'
    AND EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = group_id
        AND g.created_by = public.my_profile_id()
    )
  );


-- =============================================================================
-- plans
-- =============================================================================
-- Access model confirmed 2026-08-20 by tracing every plans call site in
-- src/ (plan.functions.ts, planner.functions.ts, conflict.functions.ts,
-- ai.functions.ts, spots.functions.ts, and the create-plan/get-plan/list-plans
-- MCP tools):
--   SELECT: is_group_member(group_id). Two call sites (listPlans, getDashboard
--           in plan.functions.ts) run an UNFILTERED select — no .eq("group_id",
--           ...) at all — and rely entirely on RLS to scope results to plans
--           the caller can see. This is the same relationship can_see_plan()
--           already encodes, but that function queries plans itself, so using
--           it as *this* table's own policy would self-reference; is_group_member
--           (which only touches group_members) is the direct, non-recursive
--           equivalent and is what plans_select below uses.
--   INSERT: created_by = my_profile_id() AND is_group_member(group_id).
--           IMPORTANT: createPlan (plan.functions.ts) and launchAiPlan
--           (planner.functions.ts) insert a new plan with no app-level
--           membership check beforehand — RLS is the ONLY thing standing
--           between an authenticated user and creating a plan inside a group
--           they don't belong to. The is_group_member(group_id) clause is
--           therefore load-bearing for abuse prevention, not just correctness.
--   UPDATE: is_group_member(group_id) — deliberately broader than "owner
--           only". Tracing every update call site shows this table has two
--           different trust levels that don't map to one RLS rule:
--             - applyAiCompromise (ai.functions.ts) explicitly checks
--               is_plan_owner() in application code before updating ("Only
--               the host can apply a compromise") — host-only enforcement
--               already happens above the DB layer for this action.
--             - addSpotToPlan (spots.functions.ts, comment says "plan host
--               only") and launchAiPlan's own status flip both update as the
--               plan's own creator, so is_plan_owner would also hold, but
--               nothing forces it.
--             - castResolutionVote (conflict.functions.ts) is an explicitly
--               documented "any group member" action ("One-tap resolution
--               vote... plan locks itself in") that flips status to
--               'finalized' — it is NOT gated by is_plan_owner anywhere, by
--               design. A policy of is_plan_owner(id) here would silently
--               break this feature for every non-host voter.
--             - finalizePlan (plan.functions.ts) has no app-level ownership
--               check at all before its update.
--           Given that spread, RLS enforces the coarse boundary this app
--           consistently relies on elsewhere (must be a group member);
--           finer-grained "host only" rules stay an application-layer
--           concern, exactly as applyAiCompromise already implements it.
--   DELETE: none. group.functions.ts's deleteGroup cascades plan deletion
--           via supabaseAdmin only; no client ever deletes a plans row
--           directly.
--
-- Same known follow-on gap as group_members: several SELECTs here embed
-- `groups(...)` — that's fine, is_group_member(group_id) covers it directly
-- — but plan_participants/plan-adjacent queries elsewhere embed `profiles(...)`
-- for other members, which batch 1's profiles policy doesn't yet cover.

CREATE POLICY plans_select_member
  ON public.plans FOR SELECT
  TO authenticated
  USING (public.is_group_member(group_id));

CREATE POLICY plans_insert_member
  ON public.plans FOR INSERT
  TO authenticated
  WITH CHECK (created_by = public.my_profile_id() AND public.is_group_member(group_id));

CREATE POLICY plans_update_member
  ON public.plans FOR UPDATE
  TO authenticated
  USING (public.is_group_member(group_id))
  WITH CHECK (public.is_group_member(group_id));


-- =============================================================================
-- plan_participants
-- =============================================================================
-- Access model confirmed 2026-08-20 by tracing every plan_participants call
-- site in src/ (plan.functions.ts, planner.functions.ts, conflict.functions.ts,
-- and the create-plan/get-plan/rsvp-plan MCP tools):
--   SELECT: can_see_plan(plan_id). This table has no group_id column of its
--           own, so visibility has to route through the parent plan; reusing
--           can_see_plan() here is safe (no self-reference — it queries
--           plans, not plan_participants) and matches getPlan/getDashboard's
--           roster + response-progress reads exactly.
--   INSERT: can_see_plan(plan_id) — deliberately NOT restricted to
--           profile_id = my_profile_id(). createPlan, launchAiPlan, and the
--           create_plan MCP tool all insert one row per intended attendee
--           (host + every participantId) in a single batch call, as the
--           plan's creator, on behalf of everyone — not just themselves.
--           rsvp_plan's self-only insert (profile_id: me, when no existing
--           row) is a strict subset of what this allows, so it's covered too.
--   UPDATE: profile_id = my_profile_id() — narrower than INSERT. Every
--           observed update (rsvp_plan's attending toggle, submitConstraints'
--           "responded" flip, the conflict-flag "I'm not locked in" update)
--           is strictly self-scoped: the caller only ever updates their own
--           row. No call site updates another participant's row.
--   DELETE: none. No client-side delete call site exists (group-delete
--           cascades run through supabaseAdmin).

CREATE POLICY plan_participants_select_visible_plan
  ON public.plan_participants FOR SELECT
  TO authenticated
  USING (public.can_see_plan(plan_id));

CREATE POLICY plan_participants_insert_visible_plan
  ON public.plan_participants FOR INSERT
  TO authenticated
  WITH CHECK (public.can_see_plan(plan_id));

CREATE POLICY plan_participants_update_own
  ON public.plan_participants FOR UPDATE
  TO authenticated
  USING (profile_id = public.my_profile_id())
  WITH CHECK (profile_id = public.my_profile_id());
