-- =============================================================================
-- Syncly — guardian pairing hardening
--
-- Sync codes used to be permanent 6-digit numbers with no attempt limit, so any
-- account could guess codes until one matched and be linked to a stranger's
-- teen (with indefinite location sharing). Now:
--   * codes expire an hour after the teen reveals them and are single-use
--     (sync_code_expires_at; the server clears the code on a successful link);
--   * every link attempt is logged so the server can cap failed guesses per
--     account (guardian_link_attempts, service-role only).
-- =============================================================================

alter table public.profiles
  add column if not exists sync_code_expires_at timestamptz;

-- Existing permanent codes are invalidated; teens get a fresh one next time
-- they open the pairing card.
update public.profiles set sync_code = null, sync_code_expires_at = null
where sync_code is not null;

create table if not exists public.guardian_link_attempts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  succeeded boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists guardian_link_attempts_recent
  on public.guardian_link_attempts (profile_id, created_at desc);

-- Server-only table: RLS on with no policies means the user role can't read or
-- write it at all; only the service-role client in guardian.server.ts can.
alter table public.guardian_link_attempts enable row level security;
