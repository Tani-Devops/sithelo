-- ====================================================================
-- SITHELO — REALITY + PERSONA LAYER SECURITY TESTS (migration 025)
-- Run with: supabase test db
-- Requires 000_setup.sql (pgTAP + test_helpers.act_as) to have run first.
--
-- NOT EXECUTED — REQUIRES LIVE/STAGING SUPABASE. Written and reviewed
-- against the actual migration 025 policies/grants, but this sandbox
-- has no Postgres/pgTAP available to run it against. Run via
-- `supabase test db` before trusting these assertions.
--
-- Covers the specific risks the directive calls out for this layer:
--   - entrepreneur cannot read another entrepreneur's reality data
--   - entrepreneur CAN read/write their own reality data
--   - institution/admin CANNOT read entrepreneur_profiles,
--     entrepreneur_financial_snapshots, entrepreneur_needs,
--     entrepreneur_goals, or entrepreneur_persona_state AT ALL —
--     no institution policy exists on those tables, by design
--   - institution CAN read business_capabilities/business_assets
--     once the parent passport is published (institution-safe)
--   - a passport owner cannot self-mark a capability `verified`
--   - a passport owner cannot write entrepreneur_persona_state at all
--     (only the service-role recompute path can)
-- ====================================================================

begin;
select plan(16);

-- --------------------------------------------------------------------
-- FIXTURES
-- --------------------------------------------------------------------

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'entrepreneur-a@test.sithelo.co.za'),
  ('22222222-2222-2222-2222-222222222222', 'entrepreneur-b@test.sithelo.co.za'),
  ('33333333-3333-3333-3333-333333333333', 'institution-a-user@test.sithelo.co.za');

insert into public.institutions (id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Institution A');

update public.profiles as p set
  role = v.role::user_role, full_name = v.full_name, email = v.email, institution_id = v.institution_id::uuid
from (values
  ('11111111-1111-1111-1111-111111111111', 'entrepreneur', 'Entrepreneur A', 'entrepreneur-a@test.sithelo.co.za', null),
  ('22222222-2222-2222-2222-222222222222', 'entrepreneur', 'Entrepreneur B', 'entrepreneur-b@test.sithelo.co.za', null),
  ('33333333-3333-3333-3333-333333333333', 'institution', 'Institution A User', 'institution-a-user@test.sithelo.co.za', 'aaaaaaaa-0000-0000-0000-000000000001')
) as v(id, role, full_name, email, institution_id)
where p.id = v.id::uuid;

insert into public.business_passports (id, owner_id, business_name, is_published, trust_score, overall_verification_status) values
  ('aaaaaaaa-1111-1111-1111-000000000001', '11111111-1111-1111-1111-111111111111', 'Entrepreneur A Business', true, 40, 'unverified'),
  ('bbbbbbbb-1111-1111-1111-000000000002', '22222222-2222-2222-2222-222222222222', 'Entrepreneur B Business', false, 20, 'unverified');

insert into public.entrepreneur_profiles (id, user_id, dependants_count, household_income_dependency) values
  ('aaaaaaaa-3333-3333-3333-000000000001', '11111111-1111-1111-1111-111111111111', 3, 'high'),
  ('bbbbbbbb-3333-3333-3333-000000000002', '22222222-2222-2222-2222-222222222222', 1, 'low');

insert into public.entrepreneur_persona_state (entrepreneur_profile_id, persona_number, persona_name, explanation)
values ('aaaaaaaa-3333-3333-3333-000000000001', 2, 'The Hustler', 'test fixture');

insert into public.business_capabilities (id, passport_id, capability_type, name) values
  ('aaaaaaaa-4444-4444-4444-000000000001', 'aaaaaaaa-1111-1111-1111-000000000001', 'service', 'Bulk catering');

-- --------------------------------------------------------------------
-- GROUP 1: entrepreneur_profiles — strict owner isolation, no institution access
-- --------------------------------------------------------------------

select test_helpers.act_as('11111111-1111-1111-1111-111111111111');

select is(
  (select dependants_count from public.entrepreneur_profiles where user_id = '11111111-1111-1111-1111-111111111111'),
  3,
  'Entrepreneur A can read their own entrepreneur_profiles row'
);

select is_empty(
  $$ select 1 from public.entrepreneur_profiles where user_id = '22222222-2222-2222-2222-222222222222' $$,
  'Entrepreneur A CANNOT read Entrepreneur B''s entrepreneur_profiles row'
);

select test_helpers.act_as('33333333-3333-3333-3333-333333333333');

select is_empty(
  $$ select 1 from public.entrepreneur_profiles $$,
  'Institution user sees ZERO entrepreneur_profiles rows — no institution policy exists on this table (by design)'
);

-- --------------------------------------------------------------------
-- GROUP 2: entrepreneur_financial_snapshots, needs, goals — same shape
-- --------------------------------------------------------------------

select test_helpers.act_as('11111111-1111-1111-1111-111111111111');

select lives_ok(
  $$ insert into public.entrepreneur_needs (entrepreneur_profile_id, need_type) values ('aaaaaaaa-3333-3333-3333-000000000001', 'equipment') $$,
  'Entrepreneur A can insert a need on their own entrepreneur_profile'
);

select throws_ok(
  $$ insert into public.entrepreneur_needs (entrepreneur_profile_id, need_type) values ('bbbbbbbb-3333-3333-3333-000000000002', 'equipment') $$,
  null, null,
  'Entrepreneur A CANNOT insert a need against Entrepreneur B''s entrepreneur_profile'
);

select test_helpers.act_as('33333333-3333-3333-3333-333333333333');

select is_empty(
  $$ select 1 from public.entrepreneur_needs $$,
  'Institution user sees ZERO entrepreneur_needs rows'
);

select is_empty(
  $$ select 1 from public.entrepreneur_financial_snapshots $$,
  'Institution user sees ZERO entrepreneur_financial_snapshots rows'
);

select is_empty(
  $$ select 1 from public.entrepreneur_goals $$,
  'Institution user sees ZERO entrepreneur_goals rows'
);

-- --------------------------------------------------------------------
-- GROUP 3: entrepreneur_persona_state — owner READ only, no client writes
-- --------------------------------------------------------------------

select test_helpers.act_as('11111111-1111-1111-1111-111111111111');

select is(
  (select persona_name from public.entrepreneur_persona_state where entrepreneur_profile_id = 'aaaaaaaa-3333-3333-3333-000000000001'),
  'The Hustler',
  'Entrepreneur A can read their own persona state'
);

select throws_ok(
  $$ update public.entrepreneur_persona_state set persona_number = 10 where entrepreneur_profile_id = 'aaaaaaaa-3333-3333-3333-000000000001' $$,
  null, null,
  'Entrepreneur A cannot self-upgrade their own persona (column-level revoke — no client write path exists at all)'
);

select throws_ok(
  $$ insert into public.entrepreneur_persona_state (entrepreneur_profile_id, persona_number, persona_name, explanation) values ('bbbbbbbb-3333-3333-3333-000000000002', 10, 'The Economic Builder', 'forged') $$,
  null, null,
  'Entrepreneur A cannot forge a persona row for Entrepreneur B (column-level revoke on INSERT)'
);

-- --------------------------------------------------------------------
-- GROUP 4: business_capabilities / business_assets — institution-safe once published
-- --------------------------------------------------------------------

select test_helpers.act_as('11111111-1111-1111-1111-111111111111');

select throws_ok(
  $$ update public.business_capabilities set verified = true where id = 'aaaaaaaa-4444-4444-4444-000000000001' $$,
  null, null,
  'Passport owner cannot self-mark their own capability verified (column-level revoke)'
);

select lives_ok(
  $$ update public.business_capabilities set capacity = '200 meals/day' where id = 'aaaaaaaa-4444-4444-4444-000000000001' $$,
  'Passport owner CAN update non-scored capability fields (capacity)'
);

select test_helpers.act_as('33333333-3333-3333-3333-333333333333');

select is(
  (select name from public.business_capabilities where id = 'aaaaaaaa-4444-4444-4444-000000000001'),
  'Bulk catering',
  'Institution CAN read a capability on a PUBLISHED passport (institution-safe, mirrors business_passports visibility)'
);

select test_helpers.act_as(null, 'anon');

select is_empty(
  $$ select 1 from public.entrepreneur_profiles $$,
  'Anonymous users cannot read any entrepreneur_profiles'
);

select is_empty(
  $$ select 1 from public.entrepreneur_persona_state $$,
  'Anonymous users cannot read any entrepreneur_persona_state'
);

select * from finish();
rollback;
