-- =============================================================================
-- AI quota/failure event log
-- =============================================================================
-- Every AI feature already degrades to a deterministic fallback on any model
-- failure, so a quota-exceeded error never breaks the app -- but that also
-- meant it was invisible. This table records every AI call that failed
-- (quota-exceeded specifically flagged, everything else as "other") so usage
-- against the free-tier daily cap can actually be observed instead of guessed
-- at, e.g. via: select error_type, count(*) from ai_quota_events where
-- created_at > now() - interval '7 days' group by 1;
--
-- Internal ops table, not part of the app's user-facing data model: RLS is
-- enabled with zero policies (same "no policy = default-deny for
-- anon/authenticated, service_role still has full access" convention used
-- elsewhere in this project), since only the server-side service-role client
-- ever writes or reads it.

CREATE TABLE public.ai_quota_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  feature text NOT NULL,
  model text NOT NULL,
  error_type text NOT NULL CHECK (error_type IN ('quota', 'other')),
  message text
);

CREATE INDEX ai_quota_events_created_at_idx ON public.ai_quota_events (created_at DESC);

ALTER TABLE public.ai_quota_events ENABLE ROW LEVEL SECURITY;
