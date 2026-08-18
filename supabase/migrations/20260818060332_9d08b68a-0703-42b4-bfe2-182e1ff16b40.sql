-- 1. Freeze identity/history fields on check-in requests; teens may only answer a pending request.
CREATE OR REPLACE FUNCTION public.lock_checkin_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
  NEW.id := OLD.id;
  NEW.guardian_profile_id := OLD.guardian_profile_id;
  NEW.teen_profile_id := OLD.teen_profile_id;
  NEW.created_at := OLD.created_at;
  NEW.note := OLD.note;
  IF OLD.status <> 'pending' THEN
    RAISE EXCEPTION 'This check-in has already been answered';
  END IF;
  IF NEW.status NOT IN ('pending','ok','help') THEN
    RAISE EXCEPTION 'Invalid check-in status';
  END IF;
  IF NEW.status <> OLD.status THEN NEW.responded_at := now(); END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS t_checkin_lock ON public.checkin_requests;
CREATE TRIGGER t_checkin_lock BEFORE UPDATE ON public.checkin_requests
FOR EACH ROW EXECUTE FUNCTION public.lock_checkin_fields();

-- 2. Controlled creation path for guardian alerts: a guardian may only create alerts for their own teen.
CREATE POLICY "guardians create alerts for own teens" ON public.guardian_alerts
FOR INSERT TO authenticated
WITH CHECK (
  guardian_profile_id = public.my_profile_id()
  AND (teen_profile_id IS NULL OR public.is_my_teen(teen_profile_id))
);

-- 3. Group message edits may only change text content; media, metadata and routing stay immutable.
CREATE OR REPLACE FUNCTION public.lock_message_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
  NEW.id := OLD.id;
  NEW.group_id := OLD.group_id;
  NEW.plan_id := OLD.plan_id;
  NEW.sender_id := OLD.sender_id;
  NEW.reply_to_id := OLD.reply_to_id;
  NEW.system_type := OLD.system_type;
  NEW.media_url := OLD.media_url;
  NEW.meta := OLD.meta;
  NEW.created_at := OLD.created_at;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS t_group_messages_lock ON public.group_messages;
CREATE TRIGGER t_group_messages_lock BEFORE UPDATE ON public.group_messages
FOR EACH ROW EXECUTE FUNCTION public.lock_message_history();