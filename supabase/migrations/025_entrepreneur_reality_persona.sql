-- ====================================================================
-- SITHELO — ENTREPRENEUR REALITY + PERSONA LAYER
-- Migration 025: additive only. Does not touch existing tables/policies.
--
-- Implements MASTER_BUILD_DIRECTIVE sections 6-9:
--   - entrepreneur_profiles / entrepreneur_financial_snapshots
--   - entrepreneur_needs / entrepreneur_goals
--   - business_capabilities / business_assets
--   - entrepreneur_persona_state (recalculable, explainable)
--
-- Security posture:
--   - entrepreneur_* personal/reality tables: owner-only + admin. NEVER
--     exposed to institutions (no institution policy exists on these
--     tables at all — default-deny is intentional, not an oversight).
--   - business_capabilities / business_assets: institution-safe. These
--     describe the business, not the person, so published-passport
--     read access mirrors the existing business_passports policy.
--   - `verified` on capabilities/assets and all persona-state columns
--     are backend/service-role-only writes (column grant/revoke,
--     matching the pattern established in migration 021).
-- ====================================================================

-- ---------- ENUMS ----------
create type revenue_range as enum (
  'under_1k','1k_2_5k','2_5k_5k','5k_10k','10k_25k','25k_plus'
);
create type income_consistency as enum ('consistent','seasonal','unpredictable');
create type dependency_level as enum ('low','medium','high');

-- ---------- ENTREPRENEUR PROFILES (reality layer, 1:1 with profiles) ----------
create table public.entrepreneur_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,

  province sa_province,
  municipality text,
  primary_income_source boolean,

  -- reality (sensitive personal/economic — see DATA_CLASSIFICATION.md)
  dependants_count int,
  household_income_dependency dependency_level,
  operating_location_type text, -- 'home','street','premises','mobile','online'
  transport_mode text,
  internet_access boolean,
  electricity_access boolean,
  premises_status text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_entrepreneur_profiles_user on public.entrepreneur_profiles(user_id);

-- ---------- FINANCIAL SNAPSHOTS (self-reported ranges, append-only history) ----------
create table public.entrepreneur_financial_snapshots (
  id uuid primary key default gen_random_uuid(),
  entrepreneur_profile_id uuid not null references public.entrepreneur_profiles(id) on delete cascade,
  weekly_revenue_range revenue_range,
  weekly_business_expense_range revenue_range,
  personal_draw_range revenue_range,
  income_consistency income_consistency,
  created_at timestamptz not null default now()
);
create index idx_fin_snapshots_profile on public.entrepreneur_financial_snapshots(entrepreneur_profile_id, created_at desc);

-- ---------- NEEDS ----------
create table public.entrepreneur_needs (
  id uuid primary key default gen_random_uuid(),
  entrepreneur_profile_id uuid not null references public.entrepreneur_profiles(id) on delete cascade,
  need_type text not null, -- 'customers','markets','funding','equipment','registration','compliance','premises','transport','suppliers','skills','employees','digital_tools','unknown'
  priority int default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_needs_profile on public.entrepreneur_needs(entrepreneur_profile_id);

-- ---------- GOALS ----------
create table public.entrepreneur_goals (
  id uuid primary key default gen_random_uuid(),
  entrepreneur_profile_id uuid not null references public.entrepreneur_profiles(id) on delete cascade,
  goal_type text not null,
  priority int default 0,
  target_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_goals_profile on public.entrepreneur_goals(entrepreneur_profile_id);

-- ---------- BUSINESS CAPABILITIES (institution-safe: describes the business) ----------
create table public.business_capabilities (
  id uuid primary key default gen_random_uuid(),
  passport_id uuid not null references public.business_passports(id) on delete cascade,
  capability_type text not null,
  name text not null,
  description text,
  capacity text,
  verified boolean not null default false, -- backend-only, see grants below
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_capabilities_passport on public.business_capabilities(passport_id);

-- ---------- BUSINESS ASSETS (institution-safe: describes the business) ----------
create table public.business_assets (
  id uuid primary key default gen_random_uuid(),
  passport_id uuid not null references public.business_passports(id) on delete cascade,
  asset_type text not null,
  name text not null,
  quantity int,
  condition text,
  capacity text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_assets_passport on public.business_assets(passport_id);

-- ---------- PERSONA STATE (recalculable, explainable — never client-set) ----------
create table public.entrepreneur_persona_state (
  id uuid primary key default gen_random_uuid(),
  entrepreneur_profile_id uuid not null unique references public.entrepreneur_profiles(id) on delete cascade,
  persona_number int not null check (persona_number between 1 and 10),
  persona_name text not null,
  explanation text not null,
  strengths jsonb not null default '[]'::jsonb,
  constraints jsonb not null default '[]'::jsonb,
  recommended_focus text,
  computed_at timestamptz not null default now(),
  computed_by text not null default 'rules_engine_v1' -- always deterministic-engine attributed, never fabricated
);
create index idx_persona_profile on public.entrepreneur_persona_state(entrepreneur_profile_id);

-- ====================================================================
-- ROW LEVEL SECURITY
-- ====================================================================
alter table public.entrepreneur_profiles enable row level security;
alter table public.entrepreneur_financial_snapshots enable row level security;
alter table public.entrepreneur_needs enable row level security;
alter table public.entrepreneur_goals enable row level security;
alter table public.business_capabilities enable row level security;
alter table public.business_assets enable row level security;
alter table public.entrepreneur_persona_state enable row level security;

-- helper: does the calling user own this entrepreneur_profile row?
create or replace function public.owns_entrepreneur_profile(p_profile_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.entrepreneur_profiles
    where id = p_profile_id and user_id = auth.uid()
  );
$$;

-- helper: does the calling user own the passport behind a capability/asset row?
create or replace function public.owns_passport_for(p_passport_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.business_passports
    where id = p_passport_id and owner_id = auth.uid()
  );
$$;

-- ---------- entrepreneur_profiles: strictly owner + admin. NO institution policy. ----------
create policy "entrepreneur_profiles: owner full access" on public.entrepreneur_profiles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "entrepreneur_profiles: admin full access" on public.entrepreneur_profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- financial snapshots: owner insert/read own history + admin. NO institution policy. ----------
create policy "fin_snapshots: owner read own" on public.entrepreneur_financial_snapshots
  for select using (public.owns_entrepreneur_profile(entrepreneur_profile_id));
create policy "fin_snapshots: owner insert own" on public.entrepreneur_financial_snapshots
  for insert with check (public.owns_entrepreneur_profile(entrepreneur_profile_id));
create policy "fin_snapshots: admin full access" on public.entrepreneur_financial_snapshots
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- needs / goals: owner + admin. NO institution policy. ----------
create policy "needs: owner full access" on public.entrepreneur_needs
  for all using (public.owns_entrepreneur_profile(entrepreneur_profile_id))
  with check (public.owns_entrepreneur_profile(entrepreneur_profile_id));
create policy "needs: admin full access" on public.entrepreneur_needs
  for all using (public.is_admin()) with check (public.is_admin());

create policy "goals: owner full access" on public.entrepreneur_goals
  for all using (public.owns_entrepreneur_profile(entrepreneur_profile_id))
  with check (public.owns_entrepreneur_profile(entrepreneur_profile_id));
create policy "goals: admin full access" on public.entrepreneur_goals
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- persona_state: owner READ only (never writable by client) + admin ----------
create policy "persona: owner read own" on public.entrepreneur_persona_state
  for select using (public.owns_entrepreneur_profile(entrepreneur_profile_id));
create policy "persona: admin full access" on public.entrepreneur_persona_state
  for all using (public.is_admin()) with check (public.is_admin());
-- Recalculation happens exclusively through a SECURITY DEFINER RPC /
-- service-role Edge Function (see recompute_persona, to be added
-- alongside the persona rules engine). No direct client INSERT/UPDATE
-- grant is given below on purpose.

-- ---------- capabilities / assets: owner full access + institution-safe read on published passports ----------
create policy "capabilities: owner full access" on public.business_capabilities
  for all using (public.owns_passport_for(passport_id)) with check (public.owns_passport_for(passport_id));
create policy "capabilities: published readable by institutions" on public.business_capabilities
  for select using (
    exists (
      select 1 from public.business_passports bp
      where bp.id = passport_id and bp.is_published = true
    )
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('institution','admin'))
  );
create policy "capabilities: admin full access" on public.business_capabilities
  for all using (public.is_admin()) with check (public.is_admin());

create policy "assets: owner full access" on public.business_assets
  for all using (public.owns_passport_for(passport_id)) with check (public.owns_passport_for(passport_id));
create policy "assets: published readable by institutions" on public.business_assets
  for select using (
    exists (
      select 1 from public.business_passports bp
      where bp.id = passport_id and bp.is_published = true
    )
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('institution','admin'))
  );
create policy "assets: admin full access" on public.business_assets
  for all using (public.is_admin()) with check (public.is_admin());

-- ====================================================================
-- COLUMN-LEVEL GRANTS (matches the revoke-table / grant-columns
-- pattern established in migration 021 — RLS alone does not stop an
-- owner from setting a "verified" flag on their own row)
-- ====================================================================

-- capabilities: owner may set everything except `verified`
revoke insert on public.business_capabilities from authenticated;
grant insert (id, passport_id, capability_type, name, description, capacity) on public.business_capabilities to authenticated;

revoke update on public.business_capabilities from authenticated;
grant update (capability_type, name, description, capacity) on public.business_capabilities to authenticated;
-- `verified` is updated only by service-role / admin (default postgres role), never by `authenticated`.

-- persona_state: no authenticated insert/update grant at all — every row
-- must come from the SECURITY DEFINER recompute RPC or service role.
revoke insert, update on public.entrepreneur_persona_state from authenticated;

comment on table public.entrepreneur_profiles is
  'SENSITIVE PERSONAL/ECONOMIC data per DATA_CLASSIFICATION.md. Owner + admin only. Never exposed to institution_business_directory or any institution-facing view/RPC.';
comment on table public.entrepreneur_financial_snapshots is
  'SENSITIVE PERSONAL/ECONOMIC data. Self-reported ranges only, append-only. Owner + admin only.';
comment on table public.business_capabilities is
  'BUSINESS data. Institution-safe once the parent passport is published — mirrors business_passports visibility.';
comment on table public.business_assets is
  'BUSINESS data. Institution-safe once the parent passport is published — mirrors business_passports visibility.';
