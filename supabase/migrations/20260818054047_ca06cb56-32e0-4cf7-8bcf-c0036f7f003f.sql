GRANT EXECUTE ON FUNCTION app_private.is_my_teen(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.is_my_guardian(uuid) TO authenticated, service_role;