-- recommendations.suggested_start/suggested_end were declared timestamptz,
-- but every write and read site (recommend.server.ts, conflict.server.ts,
-- FinalizedPlanHub's pretty(), approval/compromise time extraction) treats
-- them as bare "HH:MM" time-of-day strings, not full timestamps. That type
-- mismatch makes every insert fail with "invalid input syntax for type
-- timestamp with time zone", so recommendation generation never succeeds.
alter table public.recommendations
  alter column suggested_start type time using suggested_start::time,
  alter column suggested_end type time using suggested_end::time;
