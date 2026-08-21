-- =============================================================================
-- Syncly — profiles: group co-member visibility (follow-up)
-- =============================================================================
-- Requested follow-up to batch 1 (20260820000100_rls_policies.sql), which
-- deliberately scoped `profiles` SELECT to own-row + linked guardian/teen
-- only. That gap turned out to be load-bearing: every group roster query
-- traced in batch 2 (listGroups, getGroup, listContacts, list_circles,
-- getDashboard, getPlan — all in plan.functions.ts / dm.functions.ts /
-- the MCP tools) embeds `profiles(display_name, avatar_emoji, avatar_url)`
-- for OTHER group members, which came back null for anyone not also a
-- guardian/teen link.
--
-- Does NOT edit 20260820000100_rls_policies.sql — this is a pure addition:
-- one new helper function and one new SELECT policy on profiles.
--
-- *** COLUMN-SCOPING CAVEAT — READ BEFORE RELYING ON THIS ***
-- The ask was to expose only display_name/avatar_emoji/avatar_url to group
-- co-members, not the full row. Postgres RLS is ROW-level only: a policy
-- decides which ROWS a query is allowed to touch, not which COLUMNS of an
-- allowed row it can read. Column-level restriction in Postgres is done via
-- GRANT/REVOKE on the (role, table, column) tuple, which is role-wide, not
-- policy-scoped — there's no way to say "columns X/Y/Z for rows reached via
-- policy A, all columns for rows reached via policy B" when both policies
-- apply to the same `authenticated` role on the same table. Restricting
-- profiles' SELECT grant to just those 3 columns would also cap what batch
-- 1's profiles_select_own and profiles_select_linked_guardian_teen policies
-- can return through the user-scoped client — silently narrowing
-- already-applied, already-reviewed behavior via a grant change rather than
-- a policy edit. That felt like the wrong call to make unilaterally, so this
-- migration adds ROW-level visibility only.
--
-- In practice this still matches the ask: every real call site that embeds
-- `profiles(...)` for group co-members only ever requests display_name,
-- avatar_emoji, and avatar_url (confirmed across all 5 files listed above).
-- But it is not hard-enforced — a client with a valid session could
-- technically SELECT other columns (phone, bio, home_address, etc.) for a
-- co-member's row too, since nothing stops that at the database level once
-- the row is visible. If you want that hard-enforced, two real options:
--   (a) REVOKE/GRANT profiles' SELECT privilege for the authenticated role
--       down to a safe column set — accepting that this also caps own-row
--       and guardian/teen reads to the same columns (no functional loss
--       today, since getMe/saveProfile always read/write via supabaseAdmin
--       and never the user-scoped client for profiles — but a real,
--       deliberate policy change worth its own review).
--   (b) A dedicated view exposing only the safe columns, with its own RLS —
--       requires updating every embedded-select call site in src/ to query
--       the view's relationship instead of `profiles(...)` directly, since
--       PostgREST embedding follows the actual foreign key to the base
--       table.
-- Neither is implemented here; flag if you want (a) or (b) done separately.

-- -----------------------------------------------------------------------------
-- shares_group_with_me — reconstructs the "shares_group_with_me" RPC
-- -----------------------------------------------------------------------------
-- This name/shape was already listed among the original schema's 12 RPC
-- functions (per types.ts's Functions list, called out as unreconstructed in
-- 20260820000000_initial_schema.sql's Section 3 comment) — nothing in src/
-- calls it directly, but it's exactly the relationship this policy needs, so
-- it's reconstructed now rather than inlining the same EXISTS/self-join
-- logic directly into the policy.
-- Best-effort reconstruction; verify logic against original project if possible.

CREATE OR REPLACE FUNCTION public.shares_group_with_me(_other_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- True if the caller and the given profile are both members of at least
  -- one common group.
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members gm_self
    JOIN public.group_members gm_other
      ON gm_other.group_id = gm_self.group_id
    WHERE gm_self.profile_id = public.my_profile_id()
      AND gm_other.profile_id = _other_profile_id
  );
$$;

CREATE POLICY profiles_select_group_member
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.shares_group_with_me(id));
