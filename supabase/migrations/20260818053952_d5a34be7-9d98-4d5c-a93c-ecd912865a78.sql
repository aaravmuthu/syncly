-- ---------- profiles: role, sync code, contact ----------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'teen',
  ADD COLUMN IF NOT EXISTS sync_code text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS share_contact_with_parents boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS location_sharing_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_account_type_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_account_type_check CHECK (account_type IN ('teen','guardian'));

CREATE UNIQUE INDEX IF NOT EXISTS profiles_sync_code_key ON public.profiles (sync_code) WHERE sync_code IS NOT NULL;

CREATE OR REPLACE FUNCTION public.gen_sync_code()
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
declare candidate text;
begin
  loop
    candidate := lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (select 1 from public.profiles p where p.sync_code = candidate);
  end loop;
  return candidate;
end;
$$;

UPDATE public.profiles SET sync_code = public.gen_sync_code() WHERE sync_code IS NULL;

-- ---------- guardian links ----------
CREATE TABLE IF NOT EXISTS public.guardian_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  teen_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  relation text NOT NULL DEFAULT 'parent',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (guardian_profile_id, teen_profile_id)
);
GRANT SELECT, INSERT, DELETE ON public.guardian_links TO authenticated;
GRANT ALL ON public.guardian_links TO service_role;
ALTER TABLE public.guardian_links ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_my_teen(_teen uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.guardian_links gl
    WHERE gl.teen_profile_id = _teen AND gl.guardian_profile_id = public.my_profile_id()
  )
$$;

CREATE OR REPLACE FUNCTION public.is_my_guardian(_guardian uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.guardian_links gl
    WHERE gl.guardian_profile_id = _guardian AND gl.teen_profile_id = public.my_profile_id()
  )
$$;

CREATE POLICY "links visible to both sides" ON public.guardian_links FOR SELECT TO authenticated
USING (guardian_profile_id = public.my_profile_id() OR teen_profile_id = public.my_profile_id());
CREATE POLICY "guardian creates own link" ON public.guardian_links FOR INSERT TO authenticated
WITH CHECK (guardian_profile_id = public.my_profile_id());
CREATE POLICY "either side unlinks" ON public.guardian_links FOR DELETE TO authenticated
USING (guardian_profile_id = public.my_profile_id() OR teen_profile_id = public.my_profile_id());

-- ---------- safe zones ----------
CREATE TABLE IF NOT EXISTS public.safe_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teen_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  label text NOT NULL,
  kind text NOT NULL DEFAULT 'custom',
  lat double precision NOT NULL,
  lon double precision NOT NULL,
  radius_m integer NOT NULL DEFAULT 250,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.safe_zones TO authenticated;
GRANT ALL ON public.safe_zones TO service_role;
ALTER TABLE public.safe_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "zones readable by teen and guardian" ON public.safe_zones FOR SELECT TO authenticated
USING (teen_profile_id = public.my_profile_id() OR public.is_my_teen(teen_profile_id));
CREATE POLICY "zones written by teen and guardian" ON public.safe_zones FOR INSERT TO authenticated
WITH CHECK (teen_profile_id = public.my_profile_id() OR public.is_my_teen(teen_profile_id));
CREATE POLICY "zones updated by teen and guardian" ON public.safe_zones FOR UPDATE TO authenticated
USING (teen_profile_id = public.my_profile_id() OR public.is_my_teen(teen_profile_id))
WITH CHECK (teen_profile_id = public.my_profile_id() OR public.is_my_teen(teen_profile_id));
CREATE POLICY "zones removed by teen and guardian" ON public.safe_zones FOR DELETE TO authenticated
USING (teen_profile_id = public.my_profile_id() OR public.is_my_teen(teen_profile_id));

-- ---------- location pings ----------
CREATE TABLE IF NOT EXISTS public.location_pings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lat double precision NOT NULL,
  lon double precision NOT NULL,
  accuracy_m integer,
  battery_pct integer,
  status_label text,
  plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS location_pings_profile_time ON public.location_pings (profile_id, created_at DESC);
GRANT SELECT, INSERT ON public.location_pings TO authenticated;
GRANT ALL ON public.location_pings TO service_role;
ALTER TABLE public.location_pings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pings readable by teen and guardian" ON public.location_pings FOR SELECT TO authenticated
USING (profile_id = public.my_profile_id() OR public.is_my_teen(profile_id));
CREATE POLICY "teen posts own pings" ON public.location_pings FOR INSERT TO authenticated
WITH CHECK (profile_id = public.my_profile_id());

-- ---------- geofence events ----------
CREATE TABLE IF NOT EXISTS public.geofence_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  zone_id uuid REFERENCES public.safe_zones(id) ON DELETE CASCADE,
  zone_label text NOT NULL,
  kind text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.geofence_events TO authenticated;
GRANT ALL ON public.geofence_events TO service_role;
ALTER TABLE public.geofence_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "geofence readable by teen and guardian" ON public.geofence_events FOR SELECT TO authenticated
USING (profile_id = public.my_profile_id() OR public.is_my_teen(profile_id));

-- ---------- guardian alerts ----------
CREATE TABLE IF NOT EXISTS public.guardian_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  teen_profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.plans(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  priority text NOT NULL DEFAULT 'normal',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.guardian_alerts TO authenticated;
GRANT ALL ON public.guardian_alerts TO service_role;
ALTER TABLE public.guardian_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alerts readable by guardian" ON public.guardian_alerts FOR SELECT TO authenticated
USING (guardian_profile_id = public.my_profile_id());
CREATE POLICY "alerts marked read by guardian" ON public.guardian_alerts FOR UPDATE TO authenticated
USING (guardian_profile_id = public.my_profile_id())
WITH CHECK (guardian_profile_id = public.my_profile_id());

-- ---------- urgent check-in requests ----------
CREATE TABLE IF NOT EXISTS public.checkin_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  teen_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  note text,
  lat double precision,
  lon double precision,
  place_label text,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.checkin_requests TO authenticated;
GRANT ALL ON public.checkin_requests TO service_role;
ALTER TABLE public.checkin_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "checkins readable by both sides" ON public.checkin_requests FOR SELECT TO authenticated
USING (guardian_profile_id = public.my_profile_id() OR teen_profile_id = public.my_profile_id());
CREATE POLICY "guardian requests checkin" ON public.checkin_requests FOR INSERT TO authenticated
WITH CHECK (guardian_profile_id = public.my_profile_id() AND public.is_my_teen(teen_profile_id));
CREATE POLICY "teen answers checkin" ON public.checkin_requests FOR UPDATE TO authenticated
USING (teen_profile_id = public.my_profile_id())
WITH CHECK (teen_profile_id = public.my_profile_id());

-- ---------- delay pings ----------
CREATE TABLE IF NOT EXISTS public.delay_pings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  reason text NOT NULL,
  minutes integer NOT NULL DEFAULT 15,
  new_eta timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.delay_pings TO authenticated;
GRANT ALL ON public.delay_pings TO service_role;
ALTER TABLE public.delay_pings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "delays readable by teen and guardian" ON public.delay_pings FOR SELECT TO authenticated
USING (profile_id = public.my_profile_id() OR public.is_my_teen(profile_id));
CREATE POLICY "teen sends own delay" ON public.delay_pings FOR INSERT TO authenticated
WITH CHECK (profile_id = public.my_profile_id());

-- ---------- rides: vehicle + departure ----------
ALTER TABLE public.transport_assignments
  ADD COLUMN IF NOT EXISTS vehicle_desc text,
  ADD COLUMN IF NOT EXISTS vehicle_color text,
  ADD COLUMN IF NOT EXISTS vehicle_plate text,
  ADD COLUMN IF NOT EXISTS departed_at timestamptz,
  ADD COLUMN IF NOT EXISTS eta_minutes integer;

-- ---------- plans: adult supervision ----------
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS adult_supervised boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS supervision_note text;