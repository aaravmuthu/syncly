-- Teen approval for parent links.
--
-- Entering a teen's sync code used to create the guardian_links row outright,
-- which grants indefinite location visibility. Now it only files a request;
-- the teen approves (creating the link) or declines. Pending requests live in
-- their own table so nothing that authorizes on guardian_links (RLS helpers
-- is_my_guardian / is_my_teen, assertLinked, the dashboard) ever sees one.

CREATE TABLE public.guardian_link_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  teen_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  CONSTRAINT guardian_link_requests_guardian_teen_key UNIQUE (guardian_profile_id, teen_profile_id)
);

CREATE INDEX guardian_link_requests_teen_idx
  ON public.guardian_link_requests (teen_profile_id, expires_at);

-- No policies: only the service role (server functions that check the caller
-- is the teen or guardian on the row) can read or write requests.
ALTER TABLE public.guardian_link_requests ENABLE ROW LEVEL SECURITY;
