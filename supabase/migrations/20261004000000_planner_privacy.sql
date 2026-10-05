-- Conditions are private to the teen and their linked guardian. Group-visible
-- approval reads need status, never the parent's free-text private condition.
-- Deploy the updated getPlan reader before applying this column restriction.
revoke select (condition_text) on public.parent_approvals from authenticated;

-- Prior planner versions persisted identifying curfew explanations. Remove
-- those from existing group-readable recommendations as well as new writes.
update public.recommendations
set breakdown = jsonb_set(
  breakdown,
  '{fair,curfewNote}',
  to_jsonb('This option does not meet every member''s timing requirements'::text)
)
where jsonb_typeof(breakdown) = 'object'
  and (breakdown #>> '{fair,curfewNote}') ~* 'past .+curfew';

update public.recommendations as r
set breakdown = jsonb_set(
  r.breakdown,
  '{cautions}',
  (
    select coalesce(jsonb_agg(
      case when (caution #>> '{}') ~* 'past .+curfew'
        then to_jsonb('This option does not meet every member''s timing requirements'::text)
        else caution
      end
      order by ord
    ), '[]'::jsonb)
    from jsonb_array_elements(r.breakdown -> 'cautions') with ordinality as c(caution, ord)
  )
)
where jsonb_typeof(r.breakdown -> 'cautions') = 'array'
  and exists (
    select 1 from jsonb_array_elements(r.breakdown -> 'cautions') as c(caution)
    where (caution #>> '{}') ~* 'past .+curfew'
  );
