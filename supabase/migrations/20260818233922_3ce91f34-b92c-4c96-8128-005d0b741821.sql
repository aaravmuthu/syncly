-- Approval bearer tokens and parent contact details must never be readable by clients.
REVOKE SELECT ON public.parent_approvals FROM authenticated;
REVOKE SELECT ON public.parent_approvals FROM anon;
GRANT SELECT (id, plan_id, profile_id, status, condition_text, expires_at, responded_at, created_at)
  ON public.parent_approvals TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.parent_approvals TO authenticated;
GRANT ALL ON public.parent_approvals TO service_role;

-- Guardian alerts: keep deletes impossible for clients and inserts scoped to own linked teens.
REVOKE DELETE ON public.guardian_alerts FROM authenticated;
REVOKE DELETE ON public.guardian_alerts FROM anon;
REVOKE ALL ON public.guardian_alerts FROM anon;