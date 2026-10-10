-- =============================================================================
-- ai_quota_events: record which fallback model answered
-- =============================================================================
-- The AI chain (src/lib/ai-gateway.server.ts) logs every (model, key) that
-- fails. Failures alone can't show whether a fallback such as Groq actually
-- answered or was skipped, so a call saved by a fallback now also writes one
-- 'served' row naming the model that answered. Same table, same
-- service-role-only access; this only widens the allowed error_type values.

ALTER TABLE public.ai_quota_events DROP CONSTRAINT IF EXISTS ai_quota_events_error_type_check;
ALTER TABLE public.ai_quota_events
  ADD CONSTRAINT ai_quota_events_error_type_check CHECK (error_type IN ('quota', 'other', 'served'));
