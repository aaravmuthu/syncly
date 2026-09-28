-- =============================================================================
-- Syncly — server-only approvals and plan state (part 2 of 2)
--
-- Apply only AFTER the app code that moves these writes to the service-role
-- client is published; the previous build writes them as the user and would
-- break.
--
--   * parent_approvals: any teen could insert a row with status 'approved'
--     straight over REST, which the Family hub then showed as approved. The
--     user roles now can't write the table at all; requestParentApproval,
--     respondToApproval, parentRespondToPlan and decideApproval all write it
--     through the service role after their own checks.
--   * plans: plans_update_member let any member rewrite any column, including
--     created_by (take over the plan) and status/selected_recommendation_id
--     (lock in an option). Direct updates are now host-only, and the columns
--     that drive the plan's lifecycle can't be set by the user roles at all —
--     finalizing, voting and conflict handling go through the server.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- parent_approvals
-- -----------------------------------------------------------------------------

revoke insert, update, delete on public.parent_approvals from anon, authenticated;
drop policy if exists parent_approvals_insert_own on public.parent_approvals;

-- -----------------------------------------------------------------------------
-- plans
-- -----------------------------------------------------------------------------

drop policy if exists plans_update_member on public.plans;
create policy plans_update_host
  on public.plans for update to authenticated
  using (created_by = public.my_profile_id())
  with check (created_by = public.my_profile_id());

create or replace function public.guard_plan_server_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- PostgREST switches to these roles for user requests; the service role and
  -- SECURITY DEFINER functions run as other roles and pass through.
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status not in ('draft', 'collecting')
       or new.selected_recommendation_id is not null
       or new.compatibility_score is not null then
      raise exception 'New plans start in draft or collecting with nothing selected'
        using errcode = '42501';
    end if;
  elsif new.created_by is distinct from old.created_by
     or new.group_id is distinct from old.group_id
     or new.status is distinct from old.status
     or new.selected_recommendation_id is distinct from old.selected_recommendation_id
     or new.compatibility_score is distinct from old.compatibility_score then
    raise exception 'created_by, group_id, status, selected_recommendation_id and compatibility_score are server-managed'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists plans_guard_server_columns on public.plans;
create trigger plans_guard_server_columns
  before insert or update on public.plans
  for each row execute function public.guard_plan_server_columns();
