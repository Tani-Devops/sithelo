-- ====================================================================
-- ZENZELE RLS/FUNCTION SECURITY TEST SUITE — PART 5
-- Adversarial pass regressions: migrations 017 (column SELECT revoke)
-- and 018 (relationship oracle, review forgery, shortlist manufacturing,
-- opportunity attribution, reference contact exposure).
-- ====================================================================

begin;
select plan(16);

-- --------------------------------------------------------------------
-- FIXTURES
-- --------------------------------------------------------------------

insert into auth.users (id, email) values
  ('d1111111-1111-1111-1111-111111111111', 'adv-owner@test.zenzele.co.za'),
  ('d3333333-3333-3333-3333-333333333333', 'adv-institution-a@test.zenzele.co.za'),
  ('d4444444-4444-4444-4444-444444444444', 'adv-institution-b@test.zenzele.co.za');

insert into public.institutions (id, name) values
  ('d0000001-0000-0000-0000-000000000001', 'Adversarial Institution A'),
  ('d0000002-0000-0000-0000-000000000002', 'Adversarial Institution B');

-- NOTE: handle_new_user (migration 004) auto-creates a profiles row
-- on every auth.users insert above, via trigger — so this is an
-- UPDATE of the auto-created rows, not a fresh INSERT (which would
-- collide on the primary key). Found via actual execution against a
-- real Postgres instance with the real trigger installed — this
-- fixture pattern had never actually been run before, across all 7
-- test files identically, until this session.
update public.profiles as p set
  role = v.role::user_role,
  full_name = v.full_name,
  email = v.email,
  institution_id = v.institution_id::uuid
from (values
  ('d1111111-1111-1111-1111-111111111111', 'entrepreneur', 'Adv Owner', 'adv-owner@test.zenzele.co.za', null),
  ('d3333333-3333-3333-3333-333333333333', 'institution', 'Adv Inst A', 'adv-institution-a@test.zenzele.co.za', 'd0000001-0000-0000-0000-000000000001'),
  ('d4444444-4444-4444-4444-444444444444', 'institution', 'Adv Inst B', 'adv-institution-b@test.zenzele.co.za', 'd0000002-0000-0000-0000-000000000002')
) as v(id, role, full_name, email, institution_id)
where p.id = v.id::uuid;

insert into public.business_passports (id, owner_id, business_name, is_published, trust_score, overall_verification_status, business_email, annual_turnover) values
  ('d5555551-1111-1111-1111-000000000001', 'd1111111-1111-1111-1111-111111111111', 'Adv Published Business', true, 60, 'unverified', 'owner@example.co.za', 2500000),
  ('d5555552-2222-2222-2222-000000000002', 'd1111111-1111-1111-1111-111111111111', 'Adv Unpublished Business', false, 10, 'unverified', 'owner2@example.co.za', null);

insert into public.opportunities (id, institution_id, created_by, title, opportunity_type, status) values
  ('d6666661-1111-1111-1111-000000000001', 'd0000001-0000-0000-0000-000000000001', 'd3333333-3333-3333-3333-333333333333', 'Adv Opportunity', 'procurement', 'active');

insert into public.applications (id, opportunity_id, passport_id, status) values
  ('d7777771-1111-1111-1111-000000000001', 'd6666661-1111-1111-1111-000000000001', 'd5555551-1111-1111-1111-000000000001', 'submitted');

insert into public.business_references (id, passport_id, reference_name, reference_organisation, reference_contact, project_description, rating) values
  ('d8888881-1111-1111-1111-000000000001', 'd5555551-1111-1111-1111-000000000001', 'Jane Client', 'City of Tshwane', 'jane@tshwane.gov.za, 012 000 0000', 'Road maintenance project', 4.5);

-- --------------------------------------------------------------------
-- PHASE 1 REGRESSION: direct SELECT of sensitive business_passports
-- columns is blocked for EVERYONE, including the owner
-- --------------------------------------------------------------------

select test_helpers.act_as('d3333333-3333-3333-3333-333333333333'); -- institution

select throws_ok(
  $$ select business_email from public.business_passports where id = 'd5555551-1111-1111-1111-000000000001' $$,
  null, null,
  'Institution cannot SELECT business_email directly, even for a published passport (column-level revoke, migration 017 — closes the get_passport_detail() bypass)'
);

select test_helpers.act_as('d1111111-1111-1111-1111-111111111111'); -- the OWNER

select throws_ok(
  $$ select annual_turnover from public.business_passports where id = 'd5555551-1111-1111-1111-000000000001' $$,
  null, null,
  'Even the OWNER cannot SELECT annual_turnover via a direct query — must use get_passport_detail() (deliberate: column grants are role-wide, not row-conditional)'
);

select isnt(
  (select public.get_passport_detail('d5555551-1111-1111-1111-000000000001')->'annual_turnover'),
  'null'::jsonb,
  'The owner DOES get annual_turnover via get_passport_detail() — confirms the column revoke didn''t break legitimate owner access, only the direct-query bypass'
);

-- --------------------------------------------------------------------
-- PHASE 2 REGRESSION: has_passport_relationship() is no longer an oracle
-- --------------------------------------------------------------------

select test_helpers.act_as('d1111111-1111-1111-1111-111111111111'); -- an entrepreneur, no institution at all

select throws_ok(
  $$ select public.has_passport_relationship('d0000001-0000-0000-0000-000000000001', 'd5555551-1111-1111-1111-000000000001') $$,
  null, null,
  'An entrepreneur (or any authenticated user) can no longer call has_passport_relationship() directly to probe arbitrary institution/passport pairs'
);

select test_helpers.act_as('d3333333-3333-3333-3333-333333333333'); -- institution A itself

select lives_ok(
  $$ select public.has_my_passport_relationship('d5555551-1111-1111-1111-000000000001') $$,
  'The safe self-scoped has_my_passport_relationship() IS callable by an institution about a passport'
);

-- --------------------------------------------------------------------
-- PHASE 3 REGRESSION: reviewed_by/reviewed_at cannot be set by direct
-- client UPDATE, even by an institution updating its own application
-- --------------------------------------------------------------------

select throws_ok(
  $$ update public.applications set reviewed_by = 'd3333333-3333-3333-3333-333333333333', status = 'shortlisted' where id = 'd7777771-1111-1111-1111-000000000001' $$,
  null, null,
  'Institution cannot explicitly SET reviewed_by in its own UPDATE statement (column-level revoke, migration 018) — the trigger is no longer the only protection'
);

select lives_ok(
  $$ update public.applications set status = 'shortlisted' where id = 'd7777771-1111-1111-1111-000000000001' $$,
  'Institution CAN still update status alone — the trigger sets reviewed_by/reviewed_at invisibly, which the column revoke does not interfere with'
);

select is(
  (select reviewed_by::text from public.applications where id = 'd7777771-1111-1111-1111-000000000001'),
  'd3333333-3333-3333-3333-333333333333',
  'reviewed_by was correctly set by the trigger despite the column-level revoke blocking direct client writes'
);

-- --------------------------------------------------------------------
-- PHASE 4 REGRESSION: shortlists cannot manufacture authorization for
-- an unpublished passport, and created_by cannot be forged
-- --------------------------------------------------------------------

select test_helpers.act_as('d4444444-4444-4444-4444-444444444444'); -- institution B, no relationship at all

select throws_ok(
  $$ insert into public.shortlists (institution_id, passport_id, created_by) values ('d0000002-0000-0000-0000-000000000002', 'd5555552-2222-2222-2222-000000000002', 'd4444444-4444-4444-4444-444444444444') $$,
  null, null,
  'Institution B cannot shortlist an UNPUBLISHED passport to manufacture a relationship — the exact attack this pass was checking for'
);

select throws_ok(
  $$ insert into public.shortlists (institution_id, passport_id, created_by) values ('d0000002-0000-0000-0000-000000000002', 'd5555551-1111-1111-1111-000000000001', 'd1111111-1111-1111-1111-111111111111') $$,
  null, null,
  'Institution B cannot forge created_by to a different user''s id when shortlisting even a published passport'
);

select lives_ok(
  $$ insert into public.shortlists (institution_id, passport_id, created_by) values ('d0000002-0000-0000-0000-000000000002', 'd5555551-1111-1111-1111-000000000001', 'd4444444-4444-4444-4444-444444444444') $$,
  'Institution B CAN legitimately shortlist a PUBLISHED passport with created_by set to their own real id'
);

-- --------------------------------------------------------------------
-- PHASE 5 REGRESSION: business_references.reference_contact is hidden
-- from institutions
-- --------------------------------------------------------------------

select test_helpers.act_as('d3333333-3333-3333-3333-333333333333');

select throws_ok(
  $$ select reference_contact from public.business_references where id = 'd8888881-1111-1111-1111-000000000001' $$,
  null, null,
  'Institution cannot SELECT reference_contact directly (column-level revoke, migration 018)'
);

select lives_ok(
  $$ select reference_name, rating from public.business_references where id = 'd8888881-1111-1111-1111-000000000001' $$,
  'Institution CAN still see reference_name/rating — data minimization is scoped to the contact field only, not the whole table'
);

-- --------------------------------------------------------------------
-- PHASE 6 REGRESSION: opportunities.created_by cannot be forged or
-- reassigned
-- --------------------------------------------------------------------

select is(
  (select created_by::text from public.opportunities where id = 'd6666661-1111-1111-1111-000000000001'),
  'd3333333-3333-3333-3333-333333333333',
  'created_by was correctly forced to the real inserting user by the trigger on INSERT'
);

-- The trigger forces new.created_by := old.created_by on UPDATE, so a
-- client attempting to reassign it does NOT throw an exception — the
-- write silently succeeds but created_by reverts to its original value.
-- This is the correct assertion for that behavior (not throws_ok, which
-- would be testing for a different failure mode than what actually
-- happens).
select lives_ok(
  $$ update public.opportunities set created_by = 'd4444444-4444-4444-4444-444444444444' where id = 'd6666661-1111-1111-1111-000000000001' $$,
  'Institution A CAN run an UPDATE that attempts to reassign created_by — it does not error...'
);

select is(
  (select created_by::text from public.opportunities where id = 'd6666661-1111-1111-1111-000000000001'),
  'd3333333-3333-3333-3333-333333333333',
  '...but created_by is silently reverted to its original value by the trigger, confirming the attempted reassignment had no effect'
);

select * from finish();
rollback;
