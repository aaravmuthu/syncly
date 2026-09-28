-- =============================================================================
-- Syncly — approval source + server-managed profile columns (part 1 of 2)
--
-- Safe to apply before the matching app code ships: everything here is either
-- additive or blocks writes the app never makes from the user client.
--
--   * parent_approvals.decided_via records who answered: the linked guardian
--     in the Family hub ('guardian') or whoever opened a shared link ('link').
--     A teen holds their own approval link, so a link answer must never pass
--     as the guardian's decision.
--   * sync_code / sync_code_expires_at / is_demo are written only by the
--     service-role client (guardian.server.ts). Column grants can't express
--     "every column but these" without freezing the list, so a trigger rejects
--     changes to them from the user roles instead.
--   * plan_participants: a member may add themselves; only the plan's host
--     may add other people.
--   * parent approval links live about two weeks at most (the server issues
--     7- and 14-day links; the extra day absorbs clock skew with the worker).
-- =============================================================================

alter table public.parent_approvals
  add column if not exists decided_via text
    check (decided_via in ('guardian', 'link'));

alter table public.parent_approvals
  add constraint parent_approvals_expiry_max
    check (expires_at <= created_at + interval '15 days');

-- -----------------------------------------------------------------------------
-- profiles: server-managed columns
-- -----------------------------------------------------------------------------

create or replace function public.guard_profile_server_columns()
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
    if new.sync_code is not null or new.sync_code_expires_at is not null or new.is_demo then
      raise exception 'sync_code, sync_code_expires_at and is_demo are server-managed'
        using errcode = '42501';
    end if;
  elsif new.sync_code is distinct from old.sync_code
     or new.sync_code_expires_at is distinct from old.sync_code_expires_at
     or new.is_demo is distinct from old.is_demo then
    raise exception 'sync_code, sync_code_expires_at and is_demo are server-managed'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_server_columns on public.profiles;
create trigger profiles_guard_server_columns
  before insert or update on public.profiles
  for each row execute function public.guard_profile_server_columns();

-- -----------------------------------------------------------------------------
-- plan_participants: self, or the host adding people
-- -----------------------------------------------------------------------------

drop policy if exists plan_participants_insert_visible_plan on public.plan_participants;
create policy plan_participants_insert_self_or_host
  on public.plan_participants for insert to authenticated
  with check (
    public.can_see_plan(plan_id)
    and (profile_id = public.my_profile_id() or public.is_plan_owner(plan_id))
  );
