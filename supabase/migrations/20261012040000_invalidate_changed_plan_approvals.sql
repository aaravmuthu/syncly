-- A decision applies to the plan that was reviewed, not future edits to it.
CREATE OR REPLACE FUNCTION public.invalidate_changed_plan_approvals()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF ROW(NEW.title, NEW.category, NEW.window_start, NEW.window_end, NEW.itinerary,
         NEW.selected_recommendation_id, NEW.location_area, NEW.est_cost_min, NEW.est_cost_max)
     IS DISTINCT FROM
     ROW(OLD.title, OLD.category, OLD.window_start, OLD.window_end, OLD.itinerary,
         OLD.selected_recommendation_id, OLD.location_area, OLD.est_cost_min, OLD.est_cost_max)
  THEN
    UPDATE public.parent_approvals SET status = 'pending', responded_at = NULL
      WHERE plan_id = NEW.id AND status <> 'pending';
    -- Preserve guardian ownership of the request and existing private conditions.
    -- Old bearer links must not regain permission to override a guardian decision.
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.invalidate_changed_plan_approvals() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS plans_invalidate_changed_approvals ON public.plans;
CREATE TRIGGER plans_invalidate_changed_approvals AFTER UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.invalidate_changed_plan_approvals();
