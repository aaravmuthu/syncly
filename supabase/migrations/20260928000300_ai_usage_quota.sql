-- =============================================================================
-- Syncly — per-user daily AI call counter
--
-- Every AI server function calls take_ai_call() through the service-role
-- client right before it reaches the model. One row per user per UTC day;
-- the upsert is atomic, so parallel requests can't slip past the limit.
-- by_feature keeps a per-feature breakdown for tuning the limit later.
--
-- Additive and safe to apply before or after the matching app code ships:
-- the app fails open (logs and allows the call) if this function is missing.
-- =============================================================================

create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default current_date,
  calls integer not null default 0,
  by_feature jsonb not null default '{}'::jsonb,
  primary key (user_id, day)
);

-- Server-only: RLS on with no policies, and no grants to the user roles.
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;

create or replace function public.take_ai_call(_user_id uuid, _feature text, _limit integer)
returns boolean
language sql
security definer
set search_path = public
as $$
  insert into public.ai_usage as u (user_id, day, calls, by_feature)
  values (_user_id, current_date, 1, jsonb_build_object(_feature, 1))
  on conflict (user_id, day) do update
    set calls = u.calls + 1,
        by_feature = u.by_feature
          || jsonb_build_object(_feature, coalesce((u.by_feature ->> _feature)::int, 0) + 1)
  returning calls <= _limit;
$$;

revoke execute on function public.take_ai_call(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.take_ai_call(uuid, text, integer) to service_role;
