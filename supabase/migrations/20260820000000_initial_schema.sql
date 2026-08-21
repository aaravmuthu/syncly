-- =============================================================================
-- Syncly — Initial schema reconstruction
-- =============================================================================
--
-- WHY THIS FILE EXISTS
-- The Supabase project this app currently points at is missing its database
-- schema entirely (no supabase/migrations/ existed before this file). This
-- migration was reverse-engineered from src/integrations/supabase/types.ts,
-- which is a `supabase gen types typescript` snapshot of the ORIGINAL working
-- project's live schema. Table shapes, nullability, and foreign keys are
-- derived directly from that file's Row/Insert/Update/Relationships blocks.
-- Anything that could not be read directly off the types (column defaults,
-- exact Postgres types for ambiguous string fields, function bodies) is a
-- best-effort reconstruction and is flagged inline with "-- TODO: verify".
--
-- *** ROW LEVEL SECURITY WARNING — READ BEFORE USING THIS APP ***
-- This migration intentionally contains NO RLS policies. Every table below
-- gets `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` and nothing else. This is
-- the safe failure mode: with RLS enabled and zero policies, the anon and
-- authenticated roles (i.e. every normal client-side Supabase call made with
-- the publishable/anon key) get ZERO rows back on every table — no accidental
-- exposure of location data, guardian/parent links, messages, etc. Only the
-- service_role key bypasses RLS.
--
-- This means: after applying this migration, the app will still be unusable
-- for real (non-service-role) users — every select/insert/update/delete from
-- the client will silently return no rows / be rejected — until someone
-- authors and applies real RLS policies for each table based on the actual
-- access model (profile ownership, group membership, guardian/teen links,
-- direct-message thread membership, etc.). Given this app handles sensitive
-- data (live location, guardian/parent controls), those policies must be
-- deliberately designed and reviewed, not guessed — they are NOT included
-- here.
-- =============================================================================


-- =============================================================================
-- SECTION 1: ENUMS
-- =============================================================================
-- Confirmed from Database["public"]["Enums"] in types.ts (lines ~1582-1599),
-- cross-referenced against which Row columns actually reference
-- Database["public"]["Enums"][...] (only 4 columns do; every other
-- "status"/"kind"-shaped column in the Row types is plain `string`, so it
-- stays `text` below rather than being coerced into an enum).

CREATE TYPE public.approval_status AS ENUM (
  'pending',
  'approved',
  'approved_with_condition',
  'declined',
  'expired'
);

CREATE TYPE public.group_kind AS ENUM (
  'permanent',
  'temporary'
);

CREATE TYPE public.member_role AS ENUM (
  'owner',
  'admin',
  'member'
);

CREATE TYPE public.plan_status AS ENUM (
  'draft',
  'collecting',
  'recommending',
  'voting',
  'finalized',
  'cancelled',
  'completed'
);


-- =============================================================================
-- SECTION 2: TABLES
-- =============================================================================
-- Ordered so foreign-key dependencies come first. One circular dependency
-- exists (plans.selected_recommendation_id <-> recommendations.plan_id); it
-- is resolved with an ALTER TABLE ... ADD CONSTRAINT at the end of this
-- section instead of an inline reference.

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
-- Relationships: [] in types.ts (empty) — user_id has no recorded FK because
-- the generator only sees the public schema; it almost certainly links to
-- Supabase's built-in auth.users(id). Added below as a best-effort inference.
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE, -- TODO: verify this FK; not present in generated Relationships (auth schema not in types.ts)
  display_name text NOT NULL DEFAULT '', -- TODO: verify default
  account_type text NOT NULL DEFAULT 'teen', -- TODO: verify default/allowed values (e.g. teen/parent/guardian)
  avatar_emoji text NOT NULL DEFAULT '😀', -- TODO: verify default
  avatar_url text,
  bio text,
  phone text,
  age integer,
  grad_year integer,
  school text,
  zip_code text,
  home_address text,
  home_area text,
  home_lat numeric,
  home_lon numeric,
  curfew_time text, -- TODO: verify type — may be `time` rather than free-text
  independence_level text,
  budget_preference text,
  preferred_categories text[] NOT NULL DEFAULT '{}',
  sync_code text UNIQUE, -- nullable in source; UNIQUE inferred since it's used as a lookup/join code
  theme_preference text NOT NULL DEFAULT 'system',
  onboarded boolean NOT NULL DEFAULT false,
  is_demo boolean NOT NULL DEFAULT false,
  notifications_enabled boolean NOT NULL DEFAULT true,
  location_sharing_enabled boolean NOT NULL DEFAULT true, -- TODO: verify default — safety-relevant
  location_pause_indefinite boolean NOT NULL DEFAULT false,
  location_paused_until timestamptz,
  needs_transportation boolean NOT NULL DEFAULT false,
  transport_features_enabled boolean NOT NULL DEFAULT false, -- TODO: verify default
  parent_approval_required boolean NOT NULL DEFAULT false, -- TODO: verify default — safety-relevant
  parent_features_enabled boolean NOT NULL DEFAULT false, -- TODO: verify default
  share_contact_with_parents boolean NOT NULL DEFAULT false, -- TODO: verify default — privacy-relevant
  personalization_enabled boolean NOT NULL DEFAULT true, -- TODO: verify default
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- groups
-- -----------------------------------------------------------------------------
CREATE TABLE public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  emoji text NOT NULL DEFAULT '🎉', -- TODO: verify default
  avatar_url text,
  cover_theme text NOT NULL DEFAULT 'default', -- TODO: verify default
  purpose text,
  kind public.group_kind NOT NULL DEFAULT 'permanent', -- TODO: verify which kind is the default
  -- Original schema likely generates this via a `gen_invite_code()` helper
  -- function (visible in Database["public"]["Functions"] but not reconstructed
  -- here per task scope). Using an inline random code instead so this DDL is
  -- self-contained. UNIQUE inferred since group joining is presumably done by code.
  invite_code text NOT NULL UNIQUE DEFAULT upper(substr(md5(random()::text), 1, 6)), -- TODO: verify default/generation strategy (original may use gen_invite_code())
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- direct_threads
-- -----------------------------------------------------------------------------
CREATE TABLE public.direct_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  a_profile_id uuid NOT NULL REFERENCES public.profiles(id),
  b_profile_id uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- plans
-- -----------------------------------------------------------------------------
-- selected_recommendation_id is added via ALTER TABLE after `recommendations`
-- exists below, to break the plans <-> recommendations circular dependency.
CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  title text NOT NULL,
  category text NOT NULL,
  status public.plan_status NOT NULL DEFAULT 'draft',
  notes text,
  location_area text,
  search_radius_miles numeric,
  est_cost_min numeric,
  est_cost_max numeric,
  food_vibe text,
  adult_supervised boolean NOT NULL DEFAULT false,
  supervision_note text,
  window_start timestamptz,
  window_end timestamptz,
  compatibility_score numeric,
  selected_recommendation_id uuid, -- FK added below after public.recommendations is created
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- recommendations
-- -----------------------------------------------------------------------------
CREATE TABLE public.recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  title text NOT NULL,
  subtitle text,
  category text,
  address text,
  location_name text,
  lat numeric,
  lon numeric,
  cost_min numeric,
  cost_max numeric,
  travel_minutes integer,
  suggested_start timestamptz,
  suggested_end timestamptz,
  score numeric NOT NULL DEFAULT 0,
  rank integer NOT NULL DEFAULT 0,
  feasible boolean NOT NULL DEFAULT true,
  breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Resolve the plans <-> recommendations circular dependency.
ALTER TABLE public.plans
  ADD CONSTRAINT plans_selected_recommendation_id_fkey
  FOREIGN KEY (selected_recommendation_id)
  REFERENCES public.recommendations(id)
  ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- safe_zones
-- -----------------------------------------------------------------------------
CREATE TABLE public.safe_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teen_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.profiles(id),
  label text NOT NULL,
  kind text NOT NULL DEFAULT 'custom', -- TODO: verify default
  lat numeric NOT NULL,
  lon numeric NOT NULL,
  radius_m integer NOT NULL DEFAULT 150, -- TODO: verify default radius
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- group_members
-- -----------------------------------------------------------------------------
CREATE TABLE public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.member_role NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- group_messages (self-referencing via reply_to_id)
-- -----------------------------------------------------------------------------
CREATE TABLE public.group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.plans(id),
  sender_id uuid REFERENCES public.profiles(id),
  reply_to_id uuid REFERENCES public.group_messages(id) ON DELETE SET NULL,
  content text NOT NULL DEFAULT '', -- TODO: verify default (e.g. system messages may omit content)
  media_url text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  system_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- group_preferences (1:1 with groups)
-- -----------------------------------------------------------------------------
CREATE TABLE public.group_preferences (
  group_id uuid PRIMARY KEY REFERENCES public.groups(id) ON DELETE CASCADE,
  avg_spend_min numeric,
  avg_spend_max numeric,
  common_locations jsonb NOT NULL DEFAULT '[]'::jsonb, -- TODO: verify default shape (array vs object)
  favorite_activities jsonb NOT NULL DEFAULT '[]'::jsonb, -- TODO: verify default shape
  favorite_places jsonb NOT NULL DEFAULT '[]'::jsonb, -- TODO: verify default shape
  typical_travel_minutes integer,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- guardian_links
-- -----------------------------------------------------------------------------
CREATE TABLE public.guardian_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_profile_id uuid NOT NULL REFERENCES public.profiles(id),
  teen_profile_id uuid NOT NULL REFERENCES public.profiles(id),
  relation text NOT NULL DEFAULT 'guardian', -- TODO: verify default
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- guardian_alerts
-- -----------------------------------------------------------------------------
CREATE TABLE public.guardian_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_profile_id uuid NOT NULL REFERENCES public.profiles(id),
  teen_profile_id uuid REFERENCES public.profiles(id),
  plan_id uuid REFERENCES public.plans(id),
  type text NOT NULL,
  title text NOT NULL,
  body text,
  priority text NOT NULL DEFAULT 'normal', -- TODO: verify default/allowed values
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- checkin_requests
-- -----------------------------------------------------------------------------
CREATE TABLE public.checkin_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_profile_id uuid NOT NULL REFERENCES public.profiles(id),
  teen_profile_id uuid NOT NULL REFERENCES public.profiles(id),
  lat numeric,
  lon numeric,
  note text,
  place_label text,
  responded_at timestamptz,
  status text NOT NULL DEFAULT 'pending', -- TODO: verify default/allowed values
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- contact_nicknames (composite PK, no id column in source)
-- -----------------------------------------------------------------------------
CREATE TABLE public.contact_nicknames (
  owner_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nickname text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_profile_id, target_profile_id)
);

-- -----------------------------------------------------------------------------
-- delay_pings
-- -----------------------------------------------------------------------------
CREATE TABLE public.delay_pings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid REFERENCES public.plans(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id),
  minutes integer NOT NULL DEFAULT 0,
  new_eta timestamptz,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- direct_messages
-- -----------------------------------------------------------------------------
CREATE TABLE public.direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.direct_threads(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES public.profiles(id),
  content text NOT NULL DEFAULT '', -- TODO: verify default
  kind text NOT NULL DEFAULT 'text', -- TODO: verify default/allowed values
  media_url text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- direct_reactions
-- -----------------------------------------------------------------------------
CREATE TABLE public.direct_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.direct_messages(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id),
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- direct_reads (composite PK, no id column in source)
-- -----------------------------------------------------------------------------
CREATE TABLE public.direct_reads (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  thread_id uuid NOT NULL REFERENCES public.direct_threads(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, thread_id)
);

-- -----------------------------------------------------------------------------
-- geofence_events
-- -----------------------------------------------------------------------------
CREATE TABLE public.geofence_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id),
  zone_id uuid REFERENCES public.safe_zones(id),
  kind text NOT NULL,
  zone_label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- location_pings
-- -----------------------------------------------------------------------------
CREATE TABLE public.location_pings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.plans(id),
  lat numeric NOT NULL,
  lon numeric NOT NULL,
  accuracy_m numeric,
  battery_pct integer,
  status_label text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- location_shares
-- -----------------------------------------------------------------------------
CREATE TABLE public.location_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewer_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mode text NOT NULL,
  hidden boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- message_reads (composite PK, no id column in source)
-- -----------------------------------------------------------------------------
CREATE TABLE public.message_reads (
  message_id uuid NOT NULL REFERENCES public.group_messages(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, profile_id)
);

-- -----------------------------------------------------------------------------
-- notifications
-- -----------------------------------------------------------------------------
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.groups(id),
  plan_id uuid REFERENCES public.plans(id),
  type text NOT NULL,
  title text NOT NULL,
  body text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- parent_approvals
-- -----------------------------------------------------------------------------
CREATE TABLE public.parent_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id),
  -- Original likely uses a dedicated token-generation function/extension
  -- (e.g. pgcrypto's gen_random_bytes). Using a uuid-derived hex string here
  -- to keep this file self-contained without assuming extra extensions.
  token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''), -- TODO: verify token generation strategy
  status public.approval_status NOT NULL DEFAULT 'pending',
  parent_name text,
  parent_email text,
  condition_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL, -- no DB default in source (Insert requires this field) — TODO: verify caller always supplies this
  responded_at timestamptz
);

-- -----------------------------------------------------------------------------
-- plan_conflicts
-- -----------------------------------------------------------------------------
CREATE TABLE public.plan_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(id),
  kind text NOT NULL,
  detail text,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- plan_constraints
-- -----------------------------------------------------------------------------
CREATE TABLE public.plan_constraints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- plan_participants
-- -----------------------------------------------------------------------------
CREATE TABLE public.plan_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  attending boolean NOT NULL DEFAULT true, -- TODO: verify default (true = assumed attending until they decline)
  responded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- activity_events
-- -----------------------------------------------------------------------------
CREATE TABLE public.activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_profile_id uuid REFERENCES public.profiles(id),
  group_id uuid REFERENCES public.groups(id),
  plan_id uuid REFERENCES public.plans(id),
  message text NOT NULL,
  type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- transport_assignments
-- -----------------------------------------------------------------------------
CREATE TABLE public.transport_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  driver_profile_id uuid REFERENCES public.profiles(id),
  driver_label text,
  car_label text NOT NULL,
  vehicle_desc text,
  vehicle_color text,
  vehicle_plate text,
  leg text NOT NULL DEFAULT 'there', -- TODO: verify default/allowed values (e.g. there/back)
  passenger_profile_ids uuid[] NOT NULL DEFAULT '{}',
  eta_minutes integer,
  departed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- transport_profiles (1:1 with profiles, no id column in source)
-- -----------------------------------------------------------------------------
CREATE TABLE public.transport_profiles (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  has_car boolean NOT NULL DEFAULT false,
  can_drive boolean NOT NULL DEFAULT false,
  passenger_capacity integer NOT NULL DEFAULT 0,
  needs_ride boolean NOT NULL DEFAULT false,
  parent_can_drive boolean NOT NULL DEFAULT false,
  max_drive_minutes integer,
  required_return_time text, -- TODO: verify type — may be `time` rather than free-text
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- votes
-- -----------------------------------------------------------------------------
CREATE TABLE public.votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recommendation_id uuid NOT NULL REFERENCES public.recommendations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);


-- =============================================================================
-- SECTION 3: FUNCTIONS
-- =============================================================================
-- Database["public"]["Functions"] in types.ts lists 12 RPC functions total,
-- but only signatures (Args/Returns) are visible — no bodies. Per task scope,
-- only the 5 functions actually called from src/ (confirmed via
-- `grep -rn "rpc(" src/`) are reconstructed below:
--   my_profile_id()          <- src/lib/quorum/*.ts, src/lib/mcp/supabase.ts
--   can_see_plan(_plan_id)   <- src/lib/quorum/ai.functions.ts, conflict.functions.ts, insight.functions.ts, plan.functions.ts
--   is_plan_owner(_plan_id)  <- src/lib/quorum/ai.functions.ts
--   is_group_member(_group_id) <- src/lib/quorum/insight.functions.ts
--   is_group_admin(_group_id)  <- src/lib/quorum/group.functions.ts
--
-- Two more — is_my_guardian(_teen_profile_id) and is_my_teen(_guardian_profile_id)
-- — are added below even though nothing in src/ calls them directly, because
-- they're needed as RLS-policy building blocks for the guardian/safety tables
-- (location_pings, guardian_alerts, checkin_requests, safe_zones). They exist
-- in the original schema per types.ts's Functions list; only the bodies here
-- are new.
--
-- The remaining 5 (gen_invite_code, gen_sync_code, is_group_owner,
-- is_thread_member, shares_group_with_me) exist in the original schema per
-- types.ts but are not called anywhere in src/ and are NOT reconstructed
-- here — table defaults above use inline SQL expressions instead of
-- depending on them.
--
-- Best-effort reconstruction; verify logic against original project if possible.

CREATE OR REPLACE FUNCTION public.my_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Best-effort reconstruction; verify logic against original project if possible.
  SELECT id FROM public.profiles WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_group_member(_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Best-effort reconstruction; verify logic against original project if possible.
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = _group_id
      AND gm.profile_id = public.my_profile_id()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_group_admin(_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Best-effort reconstruction; verify logic against original project if possible.
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = _group_id
      AND gm.profile_id = public.my_profile_id()
      AND gm.role IN ('owner', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_plan_owner(_plan_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Best-effort reconstruction; verify logic against original project if possible.
  SELECT EXISTS (
    SELECT 1
    FROM public.plans p
    WHERE p.id = _plan_id
      AND p.created_by = public.my_profile_id()
  );
$$;

CREATE OR REPLACE FUNCTION public.can_see_plan(_plan_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Best-effort reconstruction; verify logic against original project if possible.
  -- Assumes: a plan is visible to anyone who is a member of the plan's group
  -- (ownership is a subset of group membership, so is_plan_owner is not
  -- separately checked here).
  SELECT EXISTS (
    SELECT 1
    FROM public.plans p
    WHERE p.id = _plan_id
      AND public.is_group_member(p.group_id)
  );
$$;

-- -----------------------------------------------------------------------------
-- Guardian-relationship helpers
-- -----------------------------------------------------------------------------
-- Added (not part of the original 5-function scope) because RLS policies for
-- location_pings, guardian_alerts, checkin_requests, and safe_zones all need
-- "is caller a guardian of this teen / a teen of this guardian" checks.
-- Mirrors the is_group_member() pattern above rather than repeating the raw
-- EXISTS-against-guardian_links subquery in every policy.
-- Best-effort reconstruction; verify logic against original project if possible
-- (the original schema's is_my_guardian/is_my_teen function bodies are not
-- visible in types.ts — only their names were listed as unused RPCs).

CREATE OR REPLACE FUNCTION public.is_my_guardian(_teen_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- True if the caller is a guardian linked to the given teen.
  SELECT EXISTS (
    SELECT 1
    FROM public.guardian_links gl
    WHERE gl.teen_profile_id = _teen_profile_id
      AND gl.guardian_profile_id = public.my_profile_id()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_my_teen(_guardian_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- True if the caller is a teen linked to the given guardian.
  SELECT EXISTS (
    SELECT 1
    FROM public.guardian_links gl
    WHERE gl.guardian_profile_id = _guardian_profile_id
      AND gl.teen_profile_id = public.my_profile_id()
  );
$$;


-- =============================================================================
-- SECTION 4: ROW LEVEL SECURITY (enable only — no policies)
-- =============================================================================
-- See the warning at the top of this file. Enabling RLS with zero policies
-- blocks all anon/authenticated access by default; service_role still bypasses
-- RLS. Real policies must be authored separately before this app is usable.

ALTER TABLE public.profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_threads         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safe_zones             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_preferences      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardian_links         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardian_alerts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkin_requests       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_nicknames      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delay_pings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_reactions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_reads           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geofence_events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_pings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_shares        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reads          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_approvals       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_conflicts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_constraints       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_participants      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_assignments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes                  ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- END OF MIGRATION — REMINDER: no RLS policies exist yet. Real users reading
-- or writing data through the anon/authenticated Supabase client will get
-- zero rows until policies are authored and applied for every table above.
-- =============================================================================
