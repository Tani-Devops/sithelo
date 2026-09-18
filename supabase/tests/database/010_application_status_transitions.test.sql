-- ====================================================================
-- ZENZELE/SITHELO RLS/FUNCTION SECURITY TEST SUITE — PART 10
-- Covers migration 029 (database-enforced application status
-- transitions) on top of the migration 023 baseline.
-- ====================================================================

begin;
select plan(15);

-- --------------------------------------------------------------------
-- FIXTURES: two institutions (A/B), two entrepreneurs (A/B), one
-- opportunity per institution, one application per entrepreneur.
-- --------------------------------------------------------------------

insert into auth.users (id, email) values
  ('e1111111-1111-1111-1111-111111111111', 'appx-entrepreneur-a@test.sithelo.co.za'),
  ('e2222222-2222-2222-2222-222222222222', 'appx-entrepreneur-b@test.sithelo.co.za'),
  ('e3333333-3333-3333-3333-333333333333', 'appx-institution-a@test.sithelo.co.za'),
  ('e4444444-4444-4444-4444-444444444444', 'appx-institution-b@test.sithelo.co.za');

insert into public.institutions (id, name, approval_status) values
  ('e0000001-0000-0000-0000-000000000001', 'Institution A', 'approved'),
  ('e0000002-0000-0000-0000-000000000002', 'Institution B', 'approved');

update public.profiles as p set
  role = v.role::user_role,
  full_name = v.full_name,
  email = v.email,
  institution_id = v.institution_id::uuid
from (values
  ('e1111111-1111-1111-1111-111111111111', 'entrepreneur', 'Entrepreneur A', 'appx-entrepreneur-a@test.sithelo.co.za', null),
  ('e2222222-2222-2222-2222-222222222222', 'entrepreneur', 'Entrepreneur B', 'appx-entrepreneur-b@test.sithelo.co.za', null),
  ('e3333333-3333-3333-3333-333333333333', 'institution', 'Institution A User', 'appx-institution-a@test.sithelo.co.za', 'e0000001-0000-0000-0000-000000000001'),
  ('e4444444-4444-4444-4444-444444444444', 'institution', 'Institution B User', 'appx-institution-b@test.sithelo.co.za', 'e0000002-0000-0000-0000-000000000002')
) as v(id, role, full_name, email, institution_id)
where p.id = v.id::uuid;

insert into public.business_passports (id, owner_id, business_name, trust_score, overall_verification_status, business_email, annual_turnover, business_health_score) values
  ('e5555551-1111-1111-1111-000000000001', 'e1111111-1111-1111-1111-111111111111', 'Entrepreneur A Business', 70, 'unverified', 'a@example.co.za', 500000, 50),
  ('e5555552-2222-2222-2222-000000000002', 'e2222222-2222-2222-2222-222222222222', 'Entrepreneur B Business', 70, 'unverified', 'b@example.co.za', 500000, 50);

insert into public.opportunities (id, institution_id, title, opportunity_type, status) values
  ('e6666661-1111-1111-1111-000000000001', 'e0000001-0000-0000-0000-000000000001', 'Opportunity A', 'procurement', 'active'),
  ('e6666662-2222-2222-2222-000000000002', 'e0000002-0000-0000-0000-000000000002', 'Opportunity B', 'procurement', 'active');

insert into public.applications (id, opportunity_id, passport_id, status) values
  ('e7777771-1111-1111-1111-000000000001', 'e6666661-1111-1111-1111-000000000001', 'e5555551-1111-1111-1111-000000000001', 'submitted'),
  ('e7777772-2222-2222-2222-000000000002', 'e6666662-2222-2222-2222-000000000002', 'e5555552-2222-2222-2222-000000000002', 'submitted');

-- --------------------------------------------------------------------
-- GROUP 1: entrepreneur cannot manipulate the institutional decision
-- --------------------------------------------------------------------

select test_helpers.act_as('e1111111-1111-1111-1111-111111111111'); -- owner of application 1

select throws_ok(
  $$ update public.applications set status = 'awarded' where id = 'e7777771-1111-1111-1111-000000000001' $$,
  null, null,
  'An entrepreneur cannot mark their own application as awarded'
);

select throws_ok(
  $$ update public.applications set status = 'shortlisted' where id = 'e7777771-1111-1111-1111-000000000001' $$,
  null, null,
  'An entrepreneur cannot mark their own application as shortlisted'
);

select lives_ok(
  $$ update public.applications set status = 'withdrawn' where id = 'e7777771-1111-1111-1111-000000000001' $$,
  'An entrepreneur CAN withdraw their own submitted application (the one status change they are allowed)'
);

select throws_ok(
  $$ update public.applications set status = 'submitted' where id = 'e7777771-1111-1111-1111-000000000001' $$,
  null, null,
  'Once withdrawn, the application is terminal — even its own owner cannot reopen it'
);

-- --------------------------------------------------------------------
-- GROUP 2: institution A cannot touch institution B's applications
-- (RLS-level isolation, unaffected by this migration but re-verified
-- alongside the new transition logic since both paths touch the same
-- UPDATE).
-- --------------------------------------------------------------------

select test_helpers.act_as('e3333333-3333-3333-3333-333333333333'); -- institution A user

select throws_ok(
  $$ update public.applications set status = 'under_review' where id = 'e7777772-2222-2222-2222-000000000002' $$,
  null, null,
  'Institution A cannot update institution B''s application at all (RLS ownership scoping)'
);

-- --------------------------------------------------------------------
-- GROUP 3: valid institution-side transition chain, one hop at a time
-- --------------------------------------------------------------------

select test_helpers.act_as('e4444444-4444-4444-4444-444444444444'); -- institution B user, own application

select lives_ok(
  $$ update public.applications set status = 'under_review' where id = 'e7777772-2222-2222-2222-000000000002' $$,
  'submitted -> under_review is a valid institution transition'
);

select lives_ok(
  $$ update public.applications set status = 'shortlisted' where id = 'e7777772-2222-2222-2222-000000000002' $$,
  'under_review -> shortlisted is a valid institution transition'
);

select lives_ok(
  $$ update public.applications set status = 'awarded' where id = 'e7777772-2222-2222-2222-000000000002' $$,
  'shortlisted -> awarded is a valid institution transition'
);

-- --------------------------------------------------------------------
-- GROUP 4: invalid institution-side transitions are rejected outright,
-- including status injection and terminal-state reopening.
-- --------------------------------------------------------------------

select throws_ok(
  $$ update public.applications set status = 'under_review' where id = 'e7777772-2222-2222-2222-000000000002' $$,
  null, null,
  'awarded -> under_review is rejected: awarded is terminal'
);

select throws_ok(
  $$ update public.applications set status = 'rejected' where id = 'e7777772-2222-2222-2222-000000000002' $$,
  null, null,
  'awarded -> rejected is rejected: awarded is terminal, even for the owning institution'
);

-- Fresh row for the submitted -> awarded skip test, so it is not
-- muddied by the terminal-state application used above.
insert into public.opportunities (id, institution_id, title, opportunity_type, status) values
  ('e6666663-3333-3333-3333-000000000003', 'e0000001-0000-0000-0000-000000000001', 'Opportunity A2', 'procurement', 'active');
insert into public.applications (id, opportunity_id, passport_id, status) values
  ('e7777773-3333-3333-3333-000000000003', 'e6666663-3333-3333-3333-000000000003', 'e5555552-2222-2222-2222-000000000002', 'submitted');

select test_helpers.act_as('e3333333-3333-3333-3333-333333333333'); -- institution A user, owns this one

select throws_ok(
  $$ update public.applications set status = 'awarded' where id = 'e7777773-3333-3333-3333-000000000003' $$,
  null, null,
  'submitted -> awarded is rejected outright: the direct-award skip cannot be performed even by the owning institution'
);

select throws_ok(
  $$ update public.applications set status = 'cancelled' where id = 'e7777773-3333-3333-3333-000000000003' $$,
  null, null,
  'An arbitrary/invalid status value is rejected at the enum level before the trigger even runs'
);

select lives_ok(
  $$ update public.applications set status = 'rejected' where id = 'e7777773-3333-3333-3333-000000000003' $$,
  'submitted -> rejected remains a valid direct transition'
);

select throws_ok(
  $$ update public.applications set status = 'shortlisted' where id = 'e7777773-3333-3333-3333-000000000003' $$,
  null, null,
  'rejected -> shortlisted is rejected: rejected is terminal'
);

-- --------------------------------------------------------------------
-- GROUP 5: immutability of opportunity_id/passport_id is preserved
-- from migration 023 (regression guard for this migration's rewrite).
-- --------------------------------------------------------------------

select throws_ok(
  $$ update public.applications set opportunity_id = 'e6666661-1111-1111-1111-000000000001' where id = 'e7777773-3333-3333-3333-000000000003' $$,
  null, null,
  'opportunity_id remains immutable for a non-admin caller after this migration''s rewrite of the trigger function'
);

select * from finish();
rollback;
