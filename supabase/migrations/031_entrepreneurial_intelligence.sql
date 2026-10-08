-- ====================================================================
-- SITHELO — ENTREPRENEURIAL INTELLIGENCE & OPPORTUNITY MATCHING
-- Migration 031: additive only. Does not touch existing tables/policies.
--
-- Implements the "Sithelo Entrepreneurial Profiling Framework" evolution:
--   - adaptive assessment storage (question bank versioning + runs + answers)
--   - deterministic classification snapshots + longitudinal journey history
--   - structured, categorised opportunity requirements
--   - rich, five-dimension opportunity matches (eligibility / business fit /
--     practical fit / readiness / friction)
--   - outcomes/event architecture for future validation
--
-- Security posture (mirrors migration 025 + DATA_CLASSIFICATION.md):
--   - assessment/response/snapshot/history tables are Tier 0 — owner + admin
--     only, and there is NO institution policy on any of them.
--   - snapshots + history are backend-only writes (no `authenticated`
--     INSERT/UPDATE grant), exactly like entrepreneur_persona_state.
--   - opportunity_requirements follows opportunities' visibility (institution
--     manages own, entrepreneur reads active, admin full).
--   - opportunity_matches follows matches' visibility (institution reads own,
--     entrepreneur reads own, admin full; writes service-role only).
--   - outcomes are service-role-write-only; owner reads own entrepreneur
--     outcomes; admin reads all.
-- ====================================================================

-- ---------- ASSESSMENT DEFINITIONS (versioned question bank, centralised) ----------
create table public.assessment_definitions (
  id uuid primary key default gen_random_uuid(),
  framework_version text not null unique,
  definition jsonb not null,           -- full question bank for that version
  created_at timestamptz not null default now()
);
comment on table public.assessment_definitions is
  'Versioned Sithelo Entrepreneurial Journey Assessment question bank. framework_version is the research version identifier (e.g. 1.0); definition holds the full bank so historical assessments remain interpretable. Admin-managed; the executable source of truth for the running engine is src/lib/assessment/bank.ts, kept in lockstep with the row for the current version.';

-- ---------- ASSESSMENTS (one run per entrepreneur) ----------
create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  framework_version text not null,
  status text not null default 'in_progress', -- 'in_progress' | 'completed' | 'abandoned'
  started_at timestamptz not null default now(),
  completed_at timestamptz
);
create index idx_assessments_user on public.assessments(user_id, started_at desc);
comment on table public.assessments is
  'Tier 0. One adaptive assessment run per entrepreneur. Owner + admin only.';

-- ---------- ASSESSMENT RESPONSES (append-only raw answers) ----------
create table public.assessment_responses (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  question_id text not null,
  answer jsonb not null,
  answered_at timestamptz not null default now(),
  unique(assessment_id, question_id)
);
create index idx_assessment_responses_assessment on public.assessment_responses(assessment_id);
comment on table public.assessment_responses is
  'Tier 0. Raw (typed) answers to the journey assessment, keyed by question_id. Owner + admin only.';

-- ---------- ASSESSMENT SNAPSHOTS (immutable computed result per run) ----------
create table public.assessment_snapshots (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null unique references public.assessments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  framework_version text not null,
  journey_persona jsonb not null,
  context_dimensions jsonb not null,
  constraints jsonb not null default '[]'::jsonb,
  access_flags jsonb not null default '[]'::jsonb,
  capability_gaps jsonb not null default '[]'::jsonb,
  risk_capacity text,
  growth_aspiration text,
  support_preferences jsonb not null default '[]'::jsonb,
  opportunity_readiness jsonb not null,
  strengths jsonb not null default '[]'::jsonb,
  next_moves jsonb not null default '[]'::jsonb,
  recommended_opportunity_characteristics jsonb not null default '[]'::jsonb,
  computed_by text not null default 'rules_engine_v2',
  computed_at timestamptz not null default now()
);
create index idx_assessment_snapshots_user on public.assessment_snapshots(user_id, computed_at desc);
comment on table public.assessment_snapshots is
  'Tier 0. Deterministic two-layer classification result per assessment run. Backend-only writes.';

-- ---------- JOURNEY PROFILE HISTORY (longitudinal, never overwritten) ----------
create table public.journey_profile_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  assessment_id uuid references public.assessments(id) on delete set null,
  persona_number int not null check (persona_number between 1 and 10),
  persona_name text not null,
  dimensions jsonb not null,
  constraints jsonb not null default '[]'::jsonb,
  opportunity_readiness jsonb,
  recorded_at timestamptz not null default now()
);
create index idx_journey_history_user on public.journey_profile_history(user_id, recorded_at desc);
comment on table public.journey_profile_history is
  'Tier 0. Append-only journey snapshots (Starter -> Hustler -> Builder -> ...) so Sithelo can measure entrepreneurial journeys over time. Never overwritten.';

-- ---------- OPPORTUNITY REQUIREMENTS (structured, categorised) ----------
create table public.opportunity_requirements (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  requirement_key text not null,        -- taxonomy key e.g. 'schedule', 'cipc_required', 'device_required'
  requirement_value jsonb not null,     -- typed value for that key
  category text not null,               -- 'eligibility' | 'practical_fit' | 'readiness'
  label text,                           -- optional human label
  created_at timestamptz not null default now()
);
create index idx_opportunity_requirements_opp on public.opportunity_requirements(opportunity_id);
comment on table public.opportunity_requirements is
  'Structured, categorised opportunity requirements. Replaces reliance on the freeform opportunities.requirements jsonb. Institution manages own; entrepreneur reads for active opportunities.';

-- ---------- OPPORTUNITY MATCHES (rich five-dimension breakdown) ----------
create table public.opportunity_matches (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  passport_id uuid not null references public.business_passports(id) on delete cascade,
  match_score numeric(5,2) not null,
  eligibility text not null default 'eligible', -- 'eligible' | 'ineligible' | 'unverified'
  eligibility_reasons jsonb not null default '[]'::jsonb,
  business_fit numeric(5,2),
  practical_fit numeric(5,2),
  readiness numeric(5,2),
  friction jsonb not null default '[]'::jsonb,
  match_reasons jsonb not null default '[]'::jsonb,
  match_explanation jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now(),
  unique(opportunity_id, passport_id)
);
create index idx_opportunity_matches_opp on public.opportunity_matches(opportunity_id, match_score desc);
create index idx_opportunity_matches_passport on public.opportunity_matches(passport_id);
comment on table public.opportunity_matches is
  'Rich, explainable match decomposition. Eligibility, business fit, practical fit, readiness and friction are computed separately (never conflated). Writes are service-role only.';

-- ---------- OUTCOMES (event architecture for validation) ----------
create table public.outcomes (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null,           -- 'entrepreneur' | 'business' | 'opportunity' | 'programme'
  subject_id uuid not null,
  actor_id uuid references public.profiles(id),
  outcome_type text not null,           -- 'programme_completion' | 'opportunity_uptake' | 'revenue_movement' | 'employment_transition' | 'formalisation' | 'stage_progression' | ...
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);
create index idx_outcomes_subject on public.outcomes(subject_type, subject_id, outcome_type);
comment on table public.outcomes is
  'Outcome/event stream for future validation of the profiling framework. Service-role writes only; never a source of fabricated aggregate statistics.';

-- ====================================================================
-- ROW LEVEL SECURITY
-- ====================================================================
alter table public.assessment_definitions enable row level security;
alter table public.assessments enable row level security;
alter table public.assessment_responses enable row level security;
alter table public.assessment_snapshots enable row level security;
alter table public.journey_profile_history enable row level security;
alter table public.opportunity_requirements enable row level security;
alter table public.opportunity_matches enable row level security;
alter table public.outcomes enable row level security;

-- helper: does the calling user own this assessment row?
create or replace function public.owns_assessment(p_assessment_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.assessments where id = p_assessment_id and user_id = auth.uid()
  );
$$;

-- helper: does the calling user own this assessment response (via parent assessment)?
create or replace function public.owns_assessment_response(p_assessment_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.assessments where id = p_assessment_id and user_id = auth.uid()
  );
$$;

-- ---------- assessment_definitions: admin only ----------
create policy "assessment_definitions: admin full access" on public.assessment_definitions
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- assessments: owner + admin ----------
create policy "assessments: owner full access" on public.assessments
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "assessments: admin full access" on public.assessments
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- assessment_responses: owner + admin (NO institution policy) ----------
create policy "assessment_responses: owner full access" on public.assessment_responses
  for all using (public.owns_assessment_response(assessment_id))
  with check (public.owns_assessment_response(assessment_id));
create policy "assessment_responses: admin full access" on public.assessment_responses
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- assessment_snapshots: owner read + admin. Backend-only writes. ----------
create policy "assessment_snapshots: owner read" on public.assessment_snapshots
  for select using (user_id = auth.uid());
create policy "assessment_snapshots: admin full access" on public.assessment_snapshots
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- journey_profile_history: owner read + admin. Backend-only writes. ----------
create policy "journey_history: owner read" on public.journey_profile_history
  for select using (user_id = auth.uid());
create policy "journey_history: admin full access" on public.journey_profile_history
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- opportunity_requirements: institution manages own, entrepreneur reads active, admin full ----------
create policy "opportunity_requirements: institution manage own" on public.opportunity_requirements
  for all using (
    exists (select 1 from public.opportunities o where o.id = opportunity_id and o.institution_id = public.current_institution_id())
  ) with check (
    exists (select 1 from public.opportunities o where o.id = opportunity_id and o.institution_id = public.current_institution_id())
  );
create policy "opportunity_requirements: entrepreneur read active" on public.opportunity_requirements
  for select using (
    exists (
      select 1 from public.opportunities o
      join public.profiles p on p.id = auth.uid()
      where o.id = opportunity_id and o.status = 'active' and p.role in ('entrepreneur','admin')
    )
  );
create policy "opportunity_requirements: admin full access" on public.opportunity_requirements
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- opportunity_matches: mirrors matches visibility. Writes service-role only. ----------
create policy "opportunity_matches: institution read own" on public.opportunity_matches
  for select using (
    exists (select 1 from public.opportunities o where o.id = opportunity_id and o.institution_id = public.current_institution_id())
  );
create policy "opportunity_matches: entrepreneur read own" on public.opportunity_matches
  for select using (
    exists (select 1 from public.business_passports bp where bp.id = passport_id and bp.owner_id = auth.uid())
  );
create policy "opportunity_matches: admin all" on public.opportunity_matches
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- outcomes: owner reads own entrepreneur outcomes + admin. Writes service-role only. ----------
create policy "outcomes: owner read own" on public.outcomes
  for select using (subject_type = 'entrepreneur' and subject_id = auth.uid());
create policy "outcomes: admin full access" on public.outcomes
  for all using (public.is_admin()) with check (public.is_admin());

-- ====================================================================
-- COLUMN-LEVEL GRANTS (matching the migration 021 / 025 pattern: computed
-- artifacts are backend-only writes, never `authenticated`.)
-- ====================================================================

-- snapshots: no authenticated INSERT/UPDATE at all — rows land via the
-- service-role recompute path only.
revoke insert, update on public.assessment_snapshots from authenticated;

-- journey history: no authenticated INSERT/UPDATE at all.
revoke insert, update on public.journey_profile_history from authenticated;

-- opportunity_matches: no authenticated INSERT/UPDATE (writes are
-- service-role only, like `matches`).
revoke insert, update on public.opportunity_matches from authenticated;

-- outcomes: no authenticated INSERT/UPDATE (service-role only).
revoke insert, update on public.outcomes from authenticated;

-- assessment_definitions: admin-managed (no authenticated write).
revoke insert, update, delete on public.assessment_definitions from authenticated;
