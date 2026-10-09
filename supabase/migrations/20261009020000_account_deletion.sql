-- Account deletion removes the auth user, which cascades to profiles. About
-- twenty foreign keys to profiles (and to groups/plans) had no ON DELETE rule,
-- so deleting anyone who had ever made a group, plan or message failed. Each
-- key now says what happens to its rows: personal data goes with the account,
-- shared content stays with the author cleared.

DO $$
DECLARE
  spec record;
  con record;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      -- Personal or about-the-user rows: removed with the account.
      ('direct_threads', 'a_profile_id', 'profiles', 'CASCADE'),
      ('direct_threads', 'b_profile_id', 'profiles', 'CASCADE'),
      ('direct_reactions', 'profile_id', 'profiles', 'CASCADE'),
      ('guardian_links', 'guardian_profile_id', 'profiles', 'CASCADE'),
      ('guardian_links', 'teen_profile_id', 'profiles', 'CASCADE'),
      ('guardian_alerts', 'guardian_profile_id', 'profiles', 'CASCADE'),
      ('guardian_alerts', 'teen_profile_id', 'profiles', 'CASCADE'),
      ('checkin_requests', 'guardian_profile_id', 'profiles', 'CASCADE'),
      ('checkin_requests', 'teen_profile_id', 'profiles', 'CASCADE'),
      ('delay_pings', 'profile_id', 'profiles', 'CASCADE'),
      ('geofence_events', 'profile_id', 'profiles', 'CASCADE'),
      ('parent_approvals', 'profile_id', 'profiles', 'CASCADE'),
      ('plan_conflicts', 'profile_id', 'profiles', 'CASCADE'),
      -- Shared content: stays for everyone else, author cleared.
      ('group_messages', 'sender_id', 'profiles', 'SET NULL'),
      ('direct_messages', 'sender_id', 'profiles', 'SET NULL'),
      ('activity_events', 'actor_profile_id', 'profiles', 'SET NULL'),
      ('transport_assignments', 'driver_profile_id', 'profiles', 'SET NULL'),
      ('safe_zones', 'created_by', 'profiles', 'SET NULL'),
      -- Rows hanging off a group or plan that is deleted. This also unblocks
      -- deleteGroup, which failed once a group had notifications or activity.
      ('notifications', 'group_id', 'groups', 'CASCADE'),
      ('notifications', 'plan_id', 'plans', 'CASCADE'),
      ('activity_events', 'group_id', 'groups', 'CASCADE'),
      ('activity_events', 'plan_id', 'plans', 'CASCADE'),
      ('group_messages', 'plan_id', 'plans', 'SET NULL'),
      ('guardian_alerts', 'plan_id', 'plans', 'SET NULL'),
      ('location_pings', 'plan_id', 'plans', 'SET NULL')
    ) AS t(tbl, col, ref, rule)
  LOOP
    FOR con IN
      SELECT c.conname
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
      WHERE c.contype = 'f'
        AND c.conrelid = format('public.%I', spec.tbl)::regclass
        AND c.confrelid = format('public.%I', spec.ref)::regclass
        AND a.attname = spec.col
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', spec.tbl, con.conname);
    END LOOP;
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.%I(id) ON DELETE %s',
      spec.tbl, spec.tbl || '_' || spec.col || '_fkey', spec.col, spec.ref, spec.rule
    );
  END LOOP;
END $$;

-- groups.created_by and plans.created_by stay NO ACTION: nothing should be
-- left without an owner by accident. This runs first and hands them over.
-- A group goes to its longest-standing admin, else its longest-standing
-- member, and is deleted only when nobody else is in it. A plan goes to
-- another attending participant still in the group, else the group's owner.
CREATE OR REPLACE FUNCTION public.prepare_account_deletion(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  me uuid;
  g record;
  pl record;
  heir uuid;
BEGIN
  SELECT id INTO me FROM public.profiles WHERE user_id = _user_id;
  IF me IS NULL THEN
    RETURN;
  END IF;

  FOR g IN SELECT id FROM public.groups WHERE created_by = me FOR UPDATE LOOP
    SELECT profile_id INTO heir
    FROM public.group_members
    WHERE group_id = g.id AND profile_id <> me
    ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, created_at, profile_id
    LIMIT 1;
    IF heir IS NULL THEN
      DELETE FROM public.groups WHERE id = g.id;
    ELSE
      UPDATE public.group_members SET role = 'owner'
      WHERE group_id = g.id AND profile_id = heir;
      UPDATE public.groups SET created_by = heir WHERE id = g.id;
    END IF;
  END LOOP;

  FOR pl IN
    SELECT p.id, p.group_id, gr.created_by AS group_owner
    FROM public.plans p
    JOIN public.groups gr ON gr.id = p.group_id
    WHERE p.created_by = me
    FOR UPDATE OF p
  LOOP
    SELECT pp.profile_id INTO heir
    FROM public.plan_participants pp
    JOIN public.group_members gm ON gm.group_id = pl.group_id AND gm.profile_id = pp.profile_id
    WHERE pp.plan_id = pl.id AND pp.profile_id <> me
    ORDER BY pp.attending DESC, pp.created_at, pp.profile_id
    LIMIT 1;
    heir := coalesce(heir, nullif(pl.group_owner, me));
    IF heir IS NULL THEN
      DELETE FROM public.plans WHERE id = pl.id;
    ELSE
      UPDATE public.plans SET created_by = heir WHERE id = pl.id;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_account_deletion(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_account_deletion(uuid) TO service_role;
