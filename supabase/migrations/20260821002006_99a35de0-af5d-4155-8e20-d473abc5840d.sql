GRANT EXECUTE ON FUNCTION app_private.can_see_plan(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.is_group_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.is_my_guardian(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.is_my_teen(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.is_thread_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.my_profile_id() TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.shares_group_with_me(uuid) TO authenticated;