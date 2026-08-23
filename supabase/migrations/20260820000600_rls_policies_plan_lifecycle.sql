-- =============================================================================
-- Syncly — Row Level Security policies, batch 5 (plan lifecycle)
-- =============================================================================
-- Continues from 20260820000500_rls_policies_safety_location.sql. Covers the
-- tables that hang off plans/plan_participants (batch 2): recommendations,
-- votes, plan_conflicts, plan_constraints, activity_events. delay_pings is
-- reviewed and needs no client-facing policy (see note at the end).
--
-- None of batches 2-5 have been pushed to the live database yet (only batch
-- 1 is live, confirmed via `supabase migration list --linked`).
-- =============================================================================


-- =============================================================================
-- recommendations
-- =============================================================================
-- Access model confirmed 2026-08-20 by tracing every recommendations call
-- site in src/ (plan.functions.ts, spots.functions.ts, get-plan.ts MCP tool;
-- planner.functions.ts/recommend.server.ts/conflict.server.ts/compromise.
-- server.ts/insight.functions.ts/memory.server.ts/approval.functions.ts/
-- guardian.server.ts all read or write this table exclusively via
-- supabaseAdmin — the AI recommendation engine, conflict-resolution
-- alternatives, and guardian dashboard all run at elevated privilege):
--   SELECT: can_see_plan(plan_id). getPlan, getDashboard, and finalizePlan's
--           read of the chosen option all have no app-level check beyond
--           what RLS provides.
--   INSERT: is_plan_owner(plan_id). addSpotToPlan (spots.functions.ts) is
--           the only client-side insert path — its own comment says "plan
--           host only" but nothing in the handler enforces it in code, so
--           this is RLS-enforced, matching the stated intent.
--   UPDATE / DELETE: none. Regeneration (recommend.server.ts) deletes and
--           re-inserts entirely via supabaseAdmin; no client path exists.

CREATE POLICY recommendations_select_visible_plan
  ON public.recommendations FOR SELECT
  TO authenticated
  USING (public.can_see_plan(plan_id));

CREATE POLICY recommendations_insert_plan_owner
  ON public.recommendations FOR INSERT
  TO authenticated
  WITH CHECK (public.is_plan_owner(plan_id));


-- =============================================================================
-- votes
-- =============================================================================
-- Access model confirmed 2026-08-20 (plan.functions.ts: castVote, getPlan,
-- getDashboard; conflict.functions.ts: castResolutionVote; get-plan.ts MCP
-- tool):
--   SELECT: can_see_plan(plan_id). getDashboard's read is unfiltered beyond
--           `.in("plan_id", ids)`, where ids already come from an
--           RLS-filtered plans query — same "trust the earlier filter, but
--           RLS re-checks anyway" shape seen throughout this app.
--   INSERT + UPDATE: profile_id = my_profile_id() (+ can_see_plan(plan_id)
--           on INSERT). Both castVote and castResolutionVote upsert without
--           ignoreDuplicates, so PostgREST generates a real
--           `ON CONFLICT DO UPDATE` — same two-policy shape as direct_reads.
--   DELETE: none via client. group.server.ts's cleanup on leaving a group
--           (clearMemberFromGroupPlans) runs on supabaseAdmin.

CREATE POLICY votes_select_visible_plan
  ON public.votes FOR SELECT
  TO authenticated
  USING (public.can_see_plan(plan_id));

CREATE POLICY votes_insert_own
  ON public.votes FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = public.my_profile_id() AND public.can_see_plan(plan_id));

CREATE POLICY votes_update_own
  ON public.votes FOR UPDATE
  TO authenticated
  USING (profile_id = public.my_profile_id())
  WITH CHECK (profile_id = public.my_profile_id());


-- =============================================================================
-- plan_conflicts
-- =============================================================================
-- Access model confirmed 2026-08-20 (conflict.functions.ts: getPlanConflicts,
-- flagConflict-equivalent insert, castResolutionVote's bulk resolve;
-- plan.functions.ts: getDashboard):
--   SELECT: can_see_plan(plan_id). getPlanConflicts explicitly checks
--           can_see_plan via RPC before reading (app-level belt, RLS is the
--           suspenders); getDashboard relies on RLS alone.
--   INSERT: (profile_id = my_profile_id() OR profile_id IS NULL) AND
--           can_see_plan(plan_id). The flagging handler passes
--           `profile_id: (me as string | null) ?? null` — the column is
--           genuinely nullable in the app's own insert shape, not just in
--           the schema, so the check has to allow both.
--   UPDATE: can_see_plan(plan_id) — deliberately not self- or owner-scoped.
--           castResolutionVote bulk-resolves EVERY open conflict on a plan
--           (`.eq("plan_id", ...).eq("resolved", false)`, no profile_id
--           filter) whenever any group member's vote clinches a majority —
--           same "any group member" trust level as plans_update_member
--           (batch 2), for the same reason: a stricter policy would
--           silently break this feature for non-flaggers.
--   DELETE: none. No call site exists.

CREATE POLICY plan_conflicts_select_visible_plan
  ON public.plan_conflicts FOR SELECT
  TO authenticated
  USING (public.can_see_plan(plan_id));

CREATE POLICY plan_conflicts_insert_visible_plan
  ON public.plan_conflicts FOR INSERT
  TO authenticated
  WITH CHECK (
    (profile_id = public.my_profile_id() OR profile_id IS NULL)
    AND public.can_see_plan(plan_id)
  );

CREATE POLICY plan_conflicts_update_visible_plan
  ON public.plan_conflicts FOR UPDATE
  TO authenticated
  USING (public.can_see_plan(plan_id))
  WITH CHECK (public.can_see_plan(plan_id));


-- =============================================================================
-- plan_constraints
-- =============================================================================
-- Access model confirmed 2026-08-20 (plan.functions.ts: getPlan,
-- submitConstraints):
--   SELECT: profile_id = my_profile_id() — strictly self-only, NOT
--           can_see_plan-based. This matches an explicit design comment in
--           getPlan itself: "Only the caller's own private answers are ever
--           returned." Other plan members, including the host, never see
--           each other's constraint answers through the client; aggregation
--           for recommendation-generation happens exclusively inside
--           recommend.server.ts via supabaseAdmin ("Private answers are
--           read with elevated access ONLY inside the engine, aggregated
--           there, and never returned per person").
--   INSERT + UPDATE: profile_id = my_profile_id() (+ can_see_plan(plan_id)
--           on INSERT). submitConstraints upserts without ignoreDuplicates —
--           same two-policy shape as votes/direct_reads.
--   DELETE: none. No call site exists.

CREATE POLICY plan_constraints_select_own
  ON public.plan_constraints FOR SELECT
  TO authenticated
  USING (profile_id = public.my_profile_id());

CREATE POLICY plan_constraints_insert_own
  ON public.plan_constraints FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = public.my_profile_id() AND public.can_see_plan(plan_id));

CREATE POLICY plan_constraints_update_own
  ON public.plan_constraints FOR UPDATE
  TO authenticated
  USING (profile_id = public.my_profile_id())
  WITH CHECK (profile_id = public.my_profile_id());


-- =============================================================================
-- delay_pings — reviewed, no policy added
-- =============================================================================
-- Single call site total across src/ (guardian.server.ts's sendDelayPing),
-- using supabaseAdmin. RLS stays enabled with zero policies.


-- =============================================================================
-- activity_events
-- =============================================================================
-- Access model confirmed 2026-08-20 by tracing every activity_events call
-- site in src/ (plan.functions.ts, planner.functions.ts, conflict.functions.ts;
-- approval.functions.ts/conflict.server.ts/group.functions.ts/recommend.
-- server.ts write system-attributed events via supabaseAdmin):
--   Rows come in three shapes depending on which handler wrote them:
--     1. group_id + plan_id + actor_profile_id (createGroup, createPlan,
--        launchAiPlan — a member did something attributable to both a group
--        and a plan)
--     2. plan_id only, no group_id, no actor_profile_id (finalizePlan,
--        submitConstraints, castResolutionVote's resolve — deliberately
--        anonymized "Someone submitted..." / system-toned events)
--     3. actor_profile_id only, no group_id or plan_id (not observed from a
--        client-side call site today, but the column shapes allow it)
--   listActivity's own comment states the intended policy outright:
--   "Group-visible feed only: RLS keeps it to groups the caller belongs to."
--
--   SELECT / INSERT both use a CASE across the three shapes: group_id
--   present -> is_group_member(group_id); else plan_id present ->
--   can_see_plan(plan_id); else -> actor_profile_id = my_profile_id().
--   INSERT additionally requires actor_profile_id to be null or the caller's
--   own id (never lets a client attribute an event to someone else).
--
--   Note on provenance: this CASE structure independently matches the
--   activity_events portion of the 3 non-functional remote migrations found
--   during this session's git-history investigation (the ones referencing
--   app_private.is_thread_member, which don't exist on this project and
--   were confirmed never actually applied). That migration's grant/revoke
--   portion doesn't apply here, but its activity_events policy only
--   references functions this project actually has (is_group_member,
--   can_see_plan, my_profile_id) — it was verified against real call sites
--   independently, not copied on trust, and the two derivations agreeing is
--   a good sign rather than a coincidence to be suspicious of.
--   UPDATE / DELETE: none. No call site performs either.

CREATE POLICY activity_events_select_visible
  ON public.activity_events FOR SELECT
  TO authenticated
  USING (
    CASE
      WHEN group_id IS NOT NULL THEN public.is_group_member(group_id)
      WHEN plan_id IS NOT NULL THEN public.can_see_plan(plan_id)
      ELSE actor_profile_id = public.my_profile_id()
    END
  );

CREATE POLICY activity_events_insert_visible
  ON public.activity_events FOR INSERT
  TO authenticated
  WITH CHECK (
    (actor_profile_id IS NULL OR actor_profile_id = public.my_profile_id())
    AND CASE
      WHEN group_id IS NOT NULL THEN public.is_group_member(group_id)
      WHEN plan_id IS NOT NULL THEN public.can_see_plan(plan_id)
      ELSE actor_profile_id = public.my_profile_id()
    END
  );
