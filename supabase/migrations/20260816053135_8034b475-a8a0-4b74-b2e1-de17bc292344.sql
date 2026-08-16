
-- ============ enums ============
create type public.group_kind as enum ('permanent','temporary');
create type public.plan_status as enum ('draft','collecting','recommending','voting','finalized','cancelled','completed');
create type public.approval_status as enum ('pending','approved','approved_with_condition','declined','expired');
create type public.member_role as enum ('owner','admin','member');

-- ============ profiles ============
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique,
  display_name text not null default 'New member',
  avatar_emoji text not null default '🙂',
  age int,
  independence_level text,
  parent_approval_required boolean not null default false,
  parent_features_enabled boolean not null default false,
  curfew_time time,
  needs_transportation boolean not null default false,
  transport_features_enabled boolean not null default true,
  notifications_enabled boolean not null default true,
  personalization_enabled boolean not null default true,
  preferred_categories text[] not null default '{}',
  budget_preference text,
  home_area text,
  is_demo boolean not null default false,
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

-- helper: current user's profile id
create or replace function public.my_profile_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.profiles where user_id = auth.uid() limit 1
$$;

-- ============ groups ============
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind public.group_kind not null default 'permanent',
  purpose text,
  emoji text not null default '👥',
  invite_code text not null unique default upper(substr(replace(gen_random_uuid()::text,'-',''),1,7)),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.groups to authenticated;
grant all on public.groups to service_role;
alter table public.groups enable row level security;

create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role public.member_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (group_id, profile_id)
);
grant select, insert, update, delete on public.group_members to authenticated;
grant all on public.group_members to service_role;
alter table public.group_members enable row level security;

create or replace function public.is_group_member(_group_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.group_members gm
    join public.profiles p on p.id = gm.profile_id
    where gm.group_id = _group_id and p.user_id = auth.uid()
  )
$$;

create table public.group_preferences (
  group_id uuid primary key references public.groups(id) on delete cascade,
  favorite_places jsonb not null default '[]'::jsonb,
  favorite_activities jsonb not null default '[]'::jsonb,
  avg_spend_min numeric,
  avg_spend_max numeric,
  typical_travel_minutes int,
  common_locations jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.group_preferences to authenticated;
grant all on public.group_preferences to service_role;
alter table public.group_preferences enable row level security;

-- ============ plans ============
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  category text not null,
  window_start timestamptz,
  window_end timestamptz,
  location_area text,
  status public.plan_status not null default 'collecting',
  selected_recommendation_id uuid,
  notes text,
  compatibility_score int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.plans to authenticated;
grant all on public.plans to service_role;
alter table public.plans enable row level security;

create table public.plan_participants (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  responded boolean not null default false,
  attending boolean not null default true,
  created_at timestamptz not null default now(),
  unique (plan_id, profile_id)
);
grant select, insert, update, delete on public.plan_participants to authenticated;
grant all on public.plan_participants to service_role;
alter table public.plan_participants enable row level security;

create or replace function public.can_see_plan(_plan_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.plans pl
    join public.group_members gm on gm.group_id = pl.group_id
    join public.profiles p on p.id = gm.profile_id
    where pl.id = _plan_id and p.user_id = auth.uid()
  )
$$;

-- ============ PRIVATE constraints ============
create table public.plan_constraints (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, profile_id)
);
grant select, insert, update, delete on public.plan_constraints to authenticated;
grant all on public.plan_constraints to service_role;
alter table public.plan_constraints enable row level security;

create table public.transport_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  can_drive boolean not null default false,
  has_car boolean not null default false,
  passenger_capacity int not null default 0,
  needs_ride boolean not null default false,
  parent_can_drive boolean not null default false,
  max_drive_minutes int,
  required_return_time time,
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.transport_profiles to authenticated;
grant all on public.transport_profiles to service_role;
alter table public.transport_profiles enable row level security;

-- ============ recommendations / votes ============
create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  title text not null,
  subtitle text,
  category text,
  cost_min numeric,
  cost_max numeric,
  travel_minutes int,
  suggested_start time,
  suggested_end time,
  location_name text,
  tags text[] not null default '{}',
  score int not null default 0,
  feasible boolean not null default true,
  breakdown jsonb not null default '{}'::jsonb,
  rank int not null default 0,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.recommendations to authenticated;
grant all on public.recommendations to service_role;
alter table public.recommendations enable row level security;

create table public.votes (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  recommendation_id uuid not null references public.recommendations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (plan_id, profile_id)
);
grant select, insert, update, delete on public.votes to authenticated;
grant all on public.votes to service_role;
alter table public.votes enable row level security;

-- ============ parent approvals ============
create table public.parent_approvals (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  token text not null unique default replace(gen_random_uuid()::text,'-',''),
  parent_name text,
  parent_email text,
  status public.approval_status not null default 'pending',
  condition_text text,
  expires_at timestamptz not null default (now() + interval '14 days'),
  responded_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.parent_approvals to authenticated;
grant all on public.parent_approvals to service_role;
alter table public.parent_approvals enable row level security;

-- ============ transportation assignments ============
create table public.transport_assignments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  car_label text not null,
  driver_profile_id uuid references public.profiles(id) on delete set null,
  driver_label text,
  passenger_profile_ids uuid[] not null default '{}',
  leg text not null default 'both',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.transport_assignments to authenticated;
grant all on public.transport_assignments to service_role;
alter table public.transport_assignments enable row level security;

-- ============ notifications / activity ============
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid references public.plans(id) on delete cascade,
  group_id uuid references public.groups(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;

create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade,
  plan_id uuid references public.plans(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  type text not null,
  message text not null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.activity_events to authenticated;
grant all on public.activity_events to service_role;
alter table public.activity_events enable row level security;

-- ============ policies ============
create policy "profiles readable by self" on public.profiles for select to authenticated using (user_id = auth.uid());
create policy "profiles visible to co-members" on public.profiles for select to authenticated using (
  exists (
    select 1 from public.group_members a
    join public.group_members b on b.group_id = a.group_id
    join public.profiles me on me.id = b.profile_id
    where a.profile_id = profiles.id and me.user_id = auth.uid()
  )
);
create policy "profiles insert own" on public.profiles for insert to authenticated with check (user_id = auth.uid());
create policy "profiles update own" on public.profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "groups readable by members" on public.groups for select to authenticated using (public.is_group_member(id));
create policy "groups insert own" on public.groups for insert to authenticated with check (created_by = public.my_profile_id());
create policy "groups update by members" on public.groups for update to authenticated using (public.is_group_member(id)) with check (public.is_group_member(id));
create policy "groups delete by creator" on public.groups for delete to authenticated using (created_by = public.my_profile_id());

create policy "members readable" on public.group_members for select to authenticated using (public.is_group_member(group_id) or profile_id = public.my_profile_id());
create policy "members join self" on public.group_members for insert to authenticated with check (profile_id = public.my_profile_id() or public.is_group_member(group_id));
create policy "members leave self" on public.group_members for delete to authenticated using (profile_id = public.my_profile_id());

create policy "group prefs readable" on public.group_preferences for select to authenticated using (public.is_group_member(group_id));
create policy "group prefs write" on public.group_preferences for all to authenticated using (public.is_group_member(group_id)) with check (public.is_group_member(group_id));

create policy "plans readable by members" on public.plans for select to authenticated using (public.is_group_member(group_id));
create policy "plans insert by members" on public.plans for insert to authenticated with check (public.is_group_member(group_id) and created_by = public.my_profile_id());
create policy "plans update by members" on public.plans for update to authenticated using (public.is_group_member(group_id)) with check (public.is_group_member(group_id));
create policy "plans delete by creator" on public.plans for delete to authenticated using (created_by = public.my_profile_id());

create policy "participants readable" on public.plan_participants for select to authenticated using (public.can_see_plan(plan_id));
create policy "participants write" on public.plan_participants for all to authenticated using (public.can_see_plan(plan_id)) with check (public.can_see_plan(plan_id));

-- PRIVATE: only the author can ever read or write their constraints
create policy "constraints private to owner" on public.plan_constraints for all to authenticated
  using (profile_id = public.my_profile_id()) with check (profile_id = public.my_profile_id());

create policy "transport private to owner" on public.transport_profiles for all to authenticated
  using (profile_id = public.my_profile_id()) with check (profile_id = public.my_profile_id());

create policy "recs readable" on public.recommendations for select to authenticated using (public.can_see_plan(plan_id));
create policy "recs write" on public.recommendations for all to authenticated using (public.can_see_plan(plan_id)) with check (public.can_see_plan(plan_id));

create policy "votes readable" on public.votes for select to authenticated using (public.can_see_plan(plan_id));
create policy "votes own write" on public.votes for all to authenticated using (profile_id = public.my_profile_id()) with check (profile_id = public.my_profile_id() and public.can_see_plan(plan_id));

create policy "approvals readable by plan members" on public.parent_approvals for select to authenticated using (public.can_see_plan(plan_id));
create policy "approvals write own" on public.parent_approvals for all to authenticated using (profile_id = public.my_profile_id()) with check (profile_id = public.my_profile_id());

create policy "transport assignments readable" on public.transport_assignments for select to authenticated using (public.can_see_plan(plan_id));
create policy "transport assignments write" on public.transport_assignments for all to authenticated using (public.can_see_plan(plan_id)) with check (public.can_see_plan(plan_id));

create policy "notifications own" on public.notifications for all to authenticated using (profile_id = public.my_profile_id()) with check (profile_id = public.my_profile_id());

create policy "activity readable by members" on public.activity_events for select to authenticated using (group_id is null or public.is_group_member(group_id));
create policy "activity insert by members" on public.activity_events for insert to authenticated with check (group_id is null or public.is_group_member(group_id));

-- ============ updated_at ============
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

create trigger t_profiles_updated before update on public.profiles for each row execute function public.touch_updated_at();
create trigger t_groups_updated before update on public.groups for each row execute function public.touch_updated_at();
create trigger t_plans_updated before update on public.plans for each row execute function public.touch_updated_at();
create trigger t_constraints_updated before update on public.plan_constraints for each row execute function public.touch_updated_at();

create index on public.group_members (profile_id);
create index on public.plans (group_id);
create index on public.plan_participants (plan_id);
create index on public.recommendations (plan_id);
create index on public.notifications (profile_id, read);
create index on public.activity_events (group_id, created_at desc);
