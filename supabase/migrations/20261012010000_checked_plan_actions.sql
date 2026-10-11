-- Persist the wall-clock zone and keep AI/manual mutations under identical guards.
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS time_zone text;

-- Only the deterministic server engine may write feasibility flags.
DROP POLICY IF EXISTS recommendations_insert_plan_owner ON public.recommendations;
REVOKE INSERT ON public.recommendations FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.lock_checked_plan(_plan_id uuid, _recommendation_id uuid, _transport jsonb DEFAULT '[]'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.plans; r public.recommendations;
BEGIN
  SELECT * INTO p FROM public.plans WHERE id = _plan_id FOR UPDATE;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Plan not found'; END IF;
  IF p.status IN ('completed','cancelled') OR
     (p.status <> 'draft' AND coalesce(p.window_end,p.window_start) + interval '4 hours' < now())
  THEN RAISE EXCEPTION 'This plan has already ended'; END IF;
  IF p.window_start IS NOT NULL AND p.time_zone IS NULL THEN RAISE EXCEPTION 'Ask the host to refresh options to save the plan timezone'; END IF;
  IF p.status NOT IN ('voting','finalized') THEN RAISE EXCEPTION 'Refresh the options before locking in this plan'; END IF;
  SELECT * INTO r FROM public.recommendations WHERE id = _recommendation_id AND plan_id = _plan_id FOR UPDATE;
  IF r.id IS NULL OR NOT r.feasible THEN RAISE EXCEPTION 'Choose an available option that works for everyone'; END IF;
  UPDATE public.plans SET status = 'finalized', selected_recommendation_id = r.id,
    itinerary = coalesce(r.breakdown->'itinerary',p.itinerary),
    window_end = CASE WHEN p.window_start IS NOT NULL AND r.breakdown ? 'itineraryDurationMinutes'
      THEN p.window_start + make_interval(mins => (r.breakdown->>'itineraryDurationMinutes')::integer) ELSE p.window_end END
    WHERE id = p.id;
  DELETE FROM public.transport_assignments WHERE plan_id = p.id;
  INSERT INTO public.transport_assignments(plan_id,car_label,driver_label,passenger_profile_ids,leg)
    SELECT p.id, x->>'label', x->>'driver', ARRAY(SELECT jsonb_array_elements_text(x->'passengers')::uuid), 'both'
    FROM jsonb_array_elements(_transport) x;
END;
$$;

CREATE OR REPLACE FUNCTION public.retime_checked_plan(_plan_id uuid, _expected_start timestamptz, _start timestamptz, _end timestamptz, _itinerary jsonb, _time_zone text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.plans;
BEGIN
  SELECT * INTO p FROM public.plans WHERE id = _plan_id FOR UPDATE;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Plan not found'; END IF;
  IF p.status IN ('completed','cancelled') OR
     (p.status <> 'draft' AND coalesce(p.window_end,p.window_start) + interval '4 hours' < now())
  THEN RAISE EXCEPTION 'This plan has already ended'; END IF;
  IF p.window_start IS DISTINCT FROM _expected_start THEN RAISE EXCEPTION 'The plan changed. Refresh before changing its time'; END IF;
  IF _start IS NULL OR (_end IS NOT NULL AND _end <= _start) THEN RAISE EXCEPTION 'Invalid plan window'; END IF;
  IF coalesce(_end,_start) + interval '4 hours' < now() THEN RAISE EXCEPTION 'Choose a future plan time'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = _time_zone) THEN RAISE EXCEPTION 'Invalid timezone'; END IF;
  UPDATE public.plans SET window_start = _start, window_end = _end, itinerary = _itinerary, time_zone = _time_zone,
    status = 'collecting', selected_recommendation_id = NULL, compatibility_score = NULL WHERE id = p.id;
  DELETE FROM public.votes WHERE plan_id = p.id;
  DELETE FROM public.recommendations WHERE plan_id = p.id;
  DELETE FROM public.transport_assignments WHERE plan_id = p.id;
END;
$$;
REVOKE ALL ON FUNCTION public.lock_checked_plan(uuid,uuid,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.retime_checked_plan(uuid,timestamptz,timestamptz,timestamptz,jsonb,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lock_checked_plan(uuid,uuid,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.retime_checked_plan(uuid,timestamptz,timestamptz,timestamptz,jsonb,text) TO service_role;

-- Changing timing through a direct user-role UPDATE would leave old feasibility
-- flags and votes attached. Use the checked server mutation instead.
CREATE OR REPLACE FUNCTION public.guard_plan_timing_changes()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('anon','authenticated') AND
     (NEW.window_start IS DISTINCT FROM OLD.window_start OR NEW.window_end IS DISTINCT FROM OLD.window_end
      OR NEW.time_zone IS DISTINCT FROM OLD.time_zone OR NEW.itinerary IS DISTINCT FROM OLD.itinerary)
  THEN RAISE EXCEPTION 'Use the checked planning action to change this outing' USING ERRCODE = '42501'; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS plans_guard_timing_changes ON public.plans;
CREATE TRIGGER plans_guard_timing_changes BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.guard_plan_timing_changes();
