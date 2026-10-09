-- Email MFA is a separate trusted factor; it does not claim Supabase AAL2.
create table public.account_security (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_mfa_enabled boolean not null default false
);
create table public.email_mfa_sessions (
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  email_address text not null,
  verified_at timestamptz not null default now(),
  primary key(user_id, session_id)
);
create table public.email_mfa_challenges (
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  challenge_id uuid not null,
  email_address text not null,
  code_hash text not null,
  purpose text not null check(purpose in ('enroll', 'verify', 'disable')),
  expires_at timestamptz not null,
  attempts integer not null default 0,
  consumed_at timestamptz,
  primary key(user_id, session_id)
);
create table public.email_mfa_send_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null default now(),
  send_count integer not null default 0,
  last_sent_at timestamptz
);

alter table public.account_security enable row level security;
alter table public.email_mfa_sessions enable row level security;
alter table public.email_mfa_challenges enable row level security;
alter table public.email_mfa_send_limits enable row level security;
revoke all on public.account_security, public.email_mfa_sessions, public.email_mfa_challenges, public.email_mfa_send_limits from anon, authenticated;
grant all on public.account_security, public.email_mfa_sessions, public.email_mfa_challenges, public.email_mfa_send_limits to service_role;

create or replace function public.email_mfa_status(_user_id uuid, _session_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'enabled', coalesce((select email_mfa_enabled from public.account_security where user_id = _user_id), false),
    'verified', exists(select 1 from public.email_mfa_sessions s join auth.users u on u.id = s.user_id
      where s.user_id = _user_id and s.session_id = _session_id and s.email_address = u.email
        and u.email_confirmed_at is not null and s.verified_at > now() - interval '12 hours')
  );
$$;

create or replace function public.reserve_email_mfa_challenge(
  _user_id uuid, _session_id uuid, _challenge_id uuid, _code_hash text,
  _email_address text, _purpose text
) returns void language plpgsql security definer set search_path = '' as $$
declare limits public.email_mfa_send_limits;
begin
  -- Serialize sends across sessions so parallel requests cannot bypass limits.
  perform pg_advisory_xact_lock(hashtextextended(_user_id::text, 0));
  insert into public.email_mfa_send_limits(user_id) values (_user_id) on conflict do nothing;
  select * into limits from public.email_mfa_send_limits where user_id = _user_id for update;
  if limits.last_sent_at > now() - interval '60 seconds' then
    raise exception 'Wait at least a minute before requesting another email code.';
  end if;
  if limits.window_start <= now() - interval '1 hour' then
    limits.send_count := 0;
    limits.window_start := now();
  end if;
  if limits.send_count >= 10 then raise exception 'Too many email codes requested. Try again in an hour.'; end if;
  update public.email_mfa_send_limits set last_sent_at = now(), window_start = limits.window_start,
    send_count = limits.send_count + 1 where user_id = _user_id;
  -- Bound history: only the active challenge per session is retained.
  delete from public.email_mfa_challenges where user_id = _user_id and expires_at < now();
  delete from public.email_mfa_sessions where user_id = _user_id and verified_at <= now() - interval '12 hours';
  insert into public.email_mfa_challenges(user_id,session_id,challenge_id,email_address,code_hash,purpose,expires_at)
    values (_user_id,_session_id,_challenge_id,_email_address,_code_hash,_purpose,now() + interval '10 minutes')
    on conflict(user_id,session_id) do update set challenge_id = excluded.challenge_id,
      email_address = excluded.email_address, code_hash = excluded.code_hash, purpose = excluded.purpose,
      expires_at = excluded.expires_at, attempts = 0, consumed_at = null;
end;
$$;

create or replace function public.verify_email_mfa_challenge(
  _user_id uuid, _session_id uuid, _challenge_id uuid, _code_hash text, _email_address text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare challenge public.email_mfa_challenges;
begin
  select * into challenge from public.email_mfa_challenges
    where user_id = _user_id and session_id = _session_id and challenge_id = _challenge_id for update;
  if not found or challenge.consumed_at is not null or challenge.expires_at <= now()
    or challenge.attempts >= 5 or challenge.email_address <> _email_address then
    return jsonb_build_object('verified', false, 'message', 'This code has expired or cannot be used. Request a new code.');
  end if;
  update public.email_mfa_challenges set attempts = attempts + 1
    where user_id = _user_id and session_id = _session_id;
  if challenge.code_hash <> _code_hash then
    return jsonb_build_object('verified', false, 'message', 'The code does not match. Check your email and try again.');
  end if;
  update public.email_mfa_challenges set consumed_at = now() where user_id = _user_id and session_id = _session_id;
  if challenge.purpose = 'enroll' then
    insert into public.account_security(user_id,email_mfa_enabled) values (_user_id,true)
      on conflict(user_id) do update set email_mfa_enabled = true;
  elsif challenge.purpose = 'disable' then
    update public.account_security set email_mfa_enabled = false where user_id = _user_id;
  end if;
  insert into public.email_mfa_sessions(user_id,session_id,email_address,verified_at)
    values (_user_id,_session_id,_email_address,now())
    on conflict(user_id,session_id) do update set email_address = excluded.email_address, verified_at = now();
  return jsonb_build_object('verified', true);
end;
$$;

revoke all on function public.email_mfa_status(uuid,uuid) from public,anon,authenticated;
revoke all on function public.reserve_email_mfa_challenge(uuid,uuid,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.verify_email_mfa_challenge(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.email_mfa_status(uuid,uuid) to service_role;
grant execute on function public.reserve_email_mfa_challenge(uuid,uuid,uuid,text,text,text) to service_role;
grant execute on function public.verify_email_mfa_challenge(uuid,uuid,uuid,text,text) to service_role;

-- Native MFA users must present an AAL2 token. Checking auth.mfa_factors rather
-- than user-editable metadata prevents an AAL1 client disabling this gate.
create or replace function public.has_required_mfa()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select auth.uid() is not null and (
    (auth.jwt() ->> 'aal') = 'aal2'
    or not exists (
      select 1 from auth.mfa_factors
      where user_id = auth.uid() and status = 'verified'
    )
  ) and (
    not coalesce((select email_mfa_enabled from public.account_security where user_id = auth.uid()), false)
    or exists (
      select 1 from public.email_mfa_sessions s join auth.users u on u.id = s.user_id
      where s.user_id = auth.uid() and s.session_id::text = (auth.jwt() ->> 'session_id')
        and s.email_address = u.email and u.email_confirmed_at is not null
        and s.verified_at > now() - interval '12 hours'
    )
  );
$$;
revoke all on function public.has_required_mfa() from public, anon;
grant execute on function public.has_required_mfa() to authenticated;

-- Restrictive policies compose with the existing authorization policies;
-- they grant no new access. Service-role server operations use the RPC gate
-- in requireSupabaseAuth before accessing data.
do $$
declare target record;
begin
  for target in
    select schemaname, tablename from pg_tables
    where schemaname = 'public'
      and tablename in (select relname from pg_class where relrowsecurity)
  loop
    execute format(
      'create policy require_verified_mfa on %I.%I as restrictive for all to authenticated using ((select public.has_required_mfa())) with check ((select public.has_required_mfa()))',
      target.schemaname, target.tablename
    );
  end loop;
end;
$$;

create policy require_verified_mfa on storage.objects
as restrictive for all to authenticated
using ((select public.has_required_mfa()))
with check ((select public.has_required_mfa()));
