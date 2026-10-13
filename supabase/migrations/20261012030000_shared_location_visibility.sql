-- location_shares has no user-role SELECT policy. Evaluate consent in a narrow
-- definer function so a valid friend can read a ping, while Ghost Mode and the
-- global sharing switch remain effective for direct database clients too.
CREATE OR REPLACE FUNCTION public.can_view_shared_location(_owner_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.location_shares ls
    JOIN public.profiles p ON p.id = ls.owner_profile_id
    WHERE ls.owner_profile_id = _owner_id
      AND ls.viewer_profile_id = public.my_profile_id()
      AND NOT coalesce(ls.hidden, false)
      AND (ls.expires_at IS NULL OR ls.expires_at > now())
      AND p.location_sharing_enabled = true
      AND NOT coalesce(p.location_pause_indefinite, false)
      AND (p.location_paused_until IS NULL OR p.location_paused_until <= now())
  );
$$;
REVOKE ALL ON FUNCTION public.can_view_shared_location(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_shared_location(uuid) TO authenticated, service_role;
DROP POLICY IF EXISTS location_pings_select_active_share_viewer ON public.location_pings;
CREATE POLICY location_pings_select_active_share_viewer ON public.location_pings
  FOR SELECT TO authenticated USING (public.can_view_shared_location(profile_id));
