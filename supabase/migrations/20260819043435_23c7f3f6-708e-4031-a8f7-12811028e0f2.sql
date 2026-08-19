REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (
  id, user_id, display_name, avatar_emoji, avatar_url, bio, school, grad_year, age,
  independence_level, parent_approval_required, parent_features_enabled, curfew_time,
  needs_transportation, transport_features_enabled, notifications_enabled,
  personalization_enabled, preferred_categories, budget_preference, home_area,
  is_demo, onboarded, theme_preference, account_type, created_at, updated_at
) ON public.profiles TO anon;