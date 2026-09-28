-- Signed-in users read parent_approvals through a column-level SELECT grant
-- that leaves out token. decided_via (added in 20260928000000) wasn't in that
-- list, so the plan page's approvals query failed with permission denied.
grant select (decided_via) on public.parent_approvals to authenticated;
