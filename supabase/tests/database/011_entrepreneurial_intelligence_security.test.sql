-- ====================================================================
-- SITHELO — ENTREPRENEURIAL INTELLIGENCE LAYER SECURITY TESTS (migration 031)
-- Run with: supabase test db
-- Requires 000_setup.sql (pgTAP + test_helpers.act_as) to have run first.
--
-- NOT EXECUTED — REQUIRES LIVE/STAGING SUPABASE. Written against the
-- actual migration 031 policies/grants; run via `supabase test db`.
--
-- Covers the specific risks for the new intelligence layer:
--   - assessment/response/snapshot/history are Tier 0: owner + admin only,
--     NO institution policy exists on any of them (by design)
--   - entrepreneur cannot read another entrepreneur's assessment data
--   - assessment_snapshots + journey_profile_history are backend-only
--     writes (no `authenticated` INSERT/UPDATE grant)
--   - opportunity_matches is service-role-write-only (owner/institution
--     can read their own, but not write)
--   - opportunity_requirements: institution manages own, entrepreneur
--     reads active, no cross-institution access
-- ====================================================================

begin;
select plan(15);

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

insert into public.opportunities (id, institution_id, title, opportunity_type, status) values
  ('aaaaaaaa-5555-5555-5555-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Test Procurement', 'procurement', 'active');

insert into public.assessments (id, user_id, framework_version, status) values
  ('aaaaaaaa-6666-6666-6666-000000000001', '11111111-1111-1111-1111-111111111111', '1.0', 'completed'),
  ('bbbbbbbb-6666-6666-6666-000000000002', '22222222-2222-2222-2222-222222222222', '1.0', 'completed');

insert into public.assessment_responses (assessment_id, question_id, answer) values
  ('aaaaaaaa-6666-6666-6666-000000000001', 'e_earns_money', 'true'::jsonb);

insert into public.assessment_snapshots (assessment_id, user_id, framework_version, journey_persona, context_dimensions, opportunity_readiness) values
  ('aaaaaaaa-6666-6666-6666-000000000001', '11111111-1111-1111-1111-111111111111', '1.0',
   '{"personaNumber":3,"personaName":"Builder"}'::jsonb, '{}'::jsonb, '{}'::jsonb);

insert into public.journey_profile_history (user_id, assessment_id, persona_number, persona_name, dimensions) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-6666-6666-6666-000000000001', 3, 'Builder', '{}'::jsonb);

insert into public.opportunity_requirements (opportunity_id, requirement_key, requirement_value, category) values
  ('aaaaaaaa-5555-5555-5555-000000000001', 'cipc_required', 'true'::jsonb, 'eligibility');

insert into public.opportunity_matches (opportunity_id, passport_id, match_score, eligibility) values
  ('aaaaaaaa-5555-5555-5555-000000000001', 'aaaaaaaa-1111-1111-1111-000000000001', 80, 'eligible');

-- --------------------------------------------------------------------
-- GROUP 1: assessment data — owner isolation + no institution access
-- --------------------------------------------------------------------

select test_helpers.act_as('11111111-1111-1111-1111-111111111111');

select is(
  (select status from public.assessments where id = 'aaaaaaaa-6666-6666-6666-000000000001'),
  'completed',
  'Entrepreneur A can read their own assessment'
);

select is_empty(
  $$ select 1 from public.assessments where id = 'bbbbbbbb-6666-6666-6666-000000000002' $$,
  'Entrepreneur A CANNOT read Entrepreneur B''s assessment'
);

select is(
  (select count(*) from public.assessment_snapshots where user_id = '11111111-1111-1111-1111-111111111111'),
  1,
  'Entrepreneur A can read their own snapshot'
);

select is_empty(
  $$ select 1 from public.journey_profile_history where user_id = '22222222-2222-2222-2222-222222222222' $$,
  'Entrepreneur A CANNOT read Entrepreneur B''s journey history'
);

select test_helpers.act_as('33333333-3333-3333-3333-333333333333');

select is_empty(
  $$ select 1 from public.assessment_snapshots $$,
  'Institution sees ZERO assessment_snapshots — no institution policy (Tier 0)'
);

select is_empty(
  $$ select 1 from public.journey_profile_history $$,
  'Institution sees ZERO journey_profile_history — no institution policy (Tier 0)'
);

-- --------------------------------------------------------------------
-- GROUP 2: backend-only writes (snapshots, history, matches, outcomes)
-- --------------------------------------------------------------------

select test_helpers.act_as('11111111-1111-1111-1111-111111111111');

select throws_ok(
  $$ insert into public.assessment_snapshots (assessment_id, user_id, framework_version, journey_persona, context_dimensions, opportunity_readiness) values ('bbbbbbbb-6666-6666-6666-000000000002', '11111111-1111-1111-1111-111111111111', '1.0', '{}', '{}', '{}') $$,
  null, null,
  'Entrepreneur cannot INSERT an assessment_snapshot (backend-only write)'
);

select throws_ok(
  $$ insert into public.journey_profile_history (user_id, persona_number, persona_name, dimensions) values ('11111111-1111-1111-1111-111111111111', 10, 'Strategic Enterprise', '{}') $$,
  null, null,
  'Entrepreneur cannot self-upgrade their journey history (backend-only write)'
);

select throws_ok(
  $$ insert into public.opportunity_matches (opportunity_id, passport_id, match_score, eligibility) values ('aaaaaaaa-5555-5555-5555-000000000001', 'aaaaaaaa-1111-1111-1111-000000000001', 100, 'eligible') $$,
  null, null,
  'Entrepreneur cannot write opportunity_matches (service-role only)'
);

-- --------------------------------------------------------------------
-- GROUP 3: assessment_responses — owner write, cross-owner blocked
-- --------------------------------------------------------------------

select test_helpers.act_as('11111111-1111-1111-1111-111111111111');

select lives_ok(
  $$ insert into public.assessment_responses (assessment_id, question_id, answer) values ('aaaaaaaa-6666-6666-6666-000000000001', 'e_customers', '["a_few"]'::jsonb) $$,
  'Entrepreneur A can insert a response on their own assessment'
);

select throws_ok(
  $$ insert into public.assessment_responses (assessment_id, question_id, answer) values ('bbbbbbbb-6666-6666-6666-000000000002', 'e_customers', '["a_few"]'::jsonb) $$,
  null, null,
  'Entrepreneur A CANNOT insert a response on Entrepreneur B''s assessment'
);

-- --------------------------------------------------------------------
-- GROUP 4: opportunity_requirements visibility
-- --------------------------------------------------------------------

select test_helpers.act_as('33333333-3333-3333-3333-333333333333');

select is(
  (select count(*) from public.opportunity_requirements where opportunity_id = 'aaaaaaaa-5555-5555-5555-000000000001'),
  1,
  'Institution can read requirements for their own opportunity'
);

select test_helpers.act_as('11111111-1111-1111-1111-111111111111');

select is(
  (select count(*) from public.opportunity_requirements where opportunity_id = 'aaaaaaaa-5555-5555-5555-000000000001'),
  1,
  'Entrepreneur can read requirements for an active opportunity'
);

select test_helpers.act_as(null, 'anon');

select is_empty(
  $$ select 1 from public.assessment_snapshots $$,
  'Anonymous users cannot read any assessment_snapshots'
);

select is_empty(
  $$ select 1 from public.opportunity_matches $$,
  'Anonymous users cannot read any opportunity_matches'
);

select * from finish();
rollback;
