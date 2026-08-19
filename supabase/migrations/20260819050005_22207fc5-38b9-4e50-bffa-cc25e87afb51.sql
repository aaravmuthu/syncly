REVOKE EXECUTE ON FUNCTION public.is_thread_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_thread_member(uuid) TO authenticated, service_role;