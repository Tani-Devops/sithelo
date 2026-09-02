-- ====================================================================
-- ZENZELE RLS/FUNCTION SECURITY TEST SUITE — PART 6
-- Covers migration 019: fail-closed missing-profile handling,
-- get_passport_activity/get_passport_trust_history, verifications actor
-- integrity, institution-logos storage role check, and the
-- service-role-context trigger bug found and fixed this pass.
-- ====================================================================

begin;
select plan(13);

-- --------------------------------------------------------------------
-- FIXTURES
-- --------------------------------------------------------------------

insert into auth.users (id, email) values
  ('e1111111-1111-1111-1111-111111111111', 'p6-owner@test.zenzele.co.za'),
  ('e2222222-2222-2222-2222-222222222222', 'p6-entrepreneur-no-profile@test.zenzele.co.za'),
  ('e3333333-3333-3333-3333-333333333333', 'p6-institution@test.zenzele.co.za'),
  ('e5555555-5555-5555-5555-555555555555', 'p6-admin-a@test.zenzele.co.za'),
  ('e6666666-6666-6666-6666-666666666666', 'p6-admin-b@test.zenzele.co.za');

insert into public.institutions (id, name) values
  ('e0000001-0000-0000-0000-000000000001', 'P6 Institution');

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
  ('e1111111-1111-1111-1111-111111111111', 'entrepreneur', 'P6 Owner', 'p6-owner@test.zenzele.co.za', null),
  ('e3333333-3333-3333-3333-333333333333', 'institution', 'P6 Institution User', 'p6-institution@test.zenzele.co.za', 'e0000001-0000-0000-0000-000000000001'),
  ('e5555555-5555-5555-5555-555555555555', 'admin', 'P6 Admin A', 'p6-admin-a@test.zenzele.co.za', null),
  ('e6666666-6666-6666-6666-666666666666', 'admin', 'P6 Admin B', 'p6-admin-b@test.zenzele.co.za', null)
) as v(id, role, full_name, email, institution_id)
where p.id = v.id::uuid;

-- e2222222 deliberately has NO profiles row — the handle_new_user
-- trigger would normally create one on auth.users insert, so this
-- simulates the edge case explicitly by deleting it afterward (as
-- superuser, bypassing RLS) rather than assuming the trigger never runs.
delete from public.profiles where id = 'e2222222-2222-2222-2222-222222222222';

insert into public.business_passports (id, owner_id, business_name, is_published, trust_score, overall_verification_status) values
  ('e7777771-1111-1111-1111-000000000001', 'e1111111-1111-1111-1111-111111111111', 'P6 Business', true, 55, 'unverified');

insert into public.verifications (id, passport_id, verification_type, status) values
  ('e8888881-1111-1111-1111-000000000001', 'e7777771-1111-1111-1111-000000000001', 'sars', 'pending');

insert into public.passport_activity (id, passport_id, activity_type, description) values
  ('e9999991-1111-1111-1111-000000000001', 'e7777771-1111-1111-1111-000000000001', 'verification_updated', 'Note');

insert into public.trust_score_history (id, passport_id, score) values
  ('e9999992-2222-2222-2222-000000000002', 'e7777771-1111-1111-1111-000000000001', 55);

-- --------------------------------------------------------------------
-- GROUP 1: fail-closed on missing profile
-- --------------------------------------------------------------------

select test_helpers.act_as('e2222222-2222-2222-2222-222222222222'); -- no profile row exists

select throws_ok(
  $$ select public.get_passport_detail('e7777771-1111-1111-1111-000000000001') $$,
  null, null,
  'get_passport_detail() fails closed for a caller with no profile row, rather than relying on ambiguous NULL-propagation through the tier checks'
);

select throws_ok(
  $$ select * from public.list_passport_documents('e7777771-1111-1111-1111-000000000001') $$,
  null, null,
  'list_passport_documents() fails closed for a caller with no profile row'
);

select throws_ok(
  $$ select * from public.get_passport_activity('e7777771-1111-1111-1111-000000000001') $$,
  null, null,
  'get_passport_activity() fails closed for a caller with no profile row'
);

-- --------------------------------------------------------------------
-- GROUP 2: get_passport_activity() / get_passport_trust_history() —
-- owner/admin only, matching migration 015's RLS decision
-- --------------------------------------------------------------------

select test_helpers.act_as('e1111111-1111-1111-1111-111111111111'); -- owner

select is(
  (select count(*)::int from public.get_passport_activity('e7777771-1111-1111-1111-000000000001')),
  1,
  'Owner CAN read their own passport''s activity via the RPC'
);

select is(
  (select count(*)::int from public.get_passport_trust_history('e7777771-1111-1111-1111-000000000001')),
  1,
  'Owner CAN read their own passport''s trust score history via the RPC'
);

select test_helpers.act_as('e3333333-3333-3333-3333-333333333333'); -- institution, no legitimate use case for either table

select throws_ok(
  $$ select * from public.get_passport_activity('e7777771-1111-1111-1111-000000000001') $$,
  null, null,
  'Institution cannot read passport activity via the RPC — owner/admin only, no institution tier exists for this data'
);

select throws_ok(
  $$ select * from public.get_passport_trust_history('e7777771-1111-1111-1111-000000000001') $$,
  null, null,
  'Institution cannot read trust score history via the RPC — owner/admin only'
);

-- --------------------------------------------------------------------
-- GROUP 3: verifications.verified_by/verified_at — admin cannot
-- impersonate another admin
-- --------------------------------------------------------------------

select test_helpers.act_as('e5555555-5555-5555-5555-555555555555'); -- Admin A

select throws_ok(
  $$ update public.verifications set status = 'verified', verified_by = 'e6666666-6666-6666-6666-666666666666' where id = 'e8888881-1111-1111-1111-000000000001' $$,
  null, null,
  'Admin A cannot explicitly credit Admin B for a verification decision they are actually making themselves (column-level revoke)'
);

select lives_ok(
  $$ update public.verifications set status = 'verified' where id = 'e8888881-1111-1111-1111-000000000001' $$,
  'Admin A CAN update status alone — the trigger stamps verified_by/verified_at invisibly'
);

select is(
  (select verified_by::text from public.verifications where id = 'e8888881-1111-1111-1111-000000000001'),
  'e5555555-5555-5555-5555-555555555555',
  'verified_by was correctly set to the REAL acting admin (A), not forgeable to B, and not left null'
);

-- --------------------------------------------------------------------
-- GROUP 4: the service-role-context trigger bug — confirmed fixed
-- --------------------------------------------------------------------
-- Simulates a service-role INSERT (auth.uid() is null in that context,
-- same as this fixture-setup context before any act_as() call) with an
-- explicit created_by, and confirms the trigger does NOT null it out —
-- the exact bug found and fixed in migration 019 for
-- enforce_opportunity_created_by. This runs after the act_as() calls
-- above, so it's important this INSERT itself is not wrapped in another
-- act_as — it needs to run as whatever "no session" context the prior
-- act_as('e5555555...') left behind... actually act_as always sets a
-- role, so to truly simulate "no auth.uid()" here we reset explicitly.

select test_helpers.act_as(null, 'service_role');

insert into public.opportunities (id, institution_id, created_by, title, opportunity_type, status)
values ('e9999993-3333-3333-3333-000000000003', 'e0000001-0000-0000-0000-000000000001', 'e3333333-3333-3333-3333-333333333333', 'P6 Service-Role-Simulated Opportunity', 'procurement', 'active');

select is(
  (select created_by::text from public.opportunities where id = 'e9999993-3333-3333-3333-000000000003'),
  'e3333333-3333-3333-3333-333333333333',
  'A service-role-style insert (no auth.uid() session) with an explicit created_by is preserved, not nulled out — regression test for the bug found this pass, where the original migration 018 trigger would have nulled created_by on every opportunity created through the normal create-opportunity edge function path'
);

-- --------------------------------------------------------------------
-- GROUP 5: institution-logos storage — role check, not just path match
-- --------------------------------------------------------------------

select test_helpers.act_as('e1111111-1111-1111-1111-111111111111'); -- entrepreneur, NOT an institution

select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner) values ('institution-logos', 'e1111111-1111-1111-1111-111111111111/logo.png', 'e1111111-1111-1111-1111-111111111111') $$,
  null, null,
  'An entrepreneur cannot upload to institution-logos even in their own uid-matching folder — role check added in migration 019, closing the gap where only the path was ever checked'
);

select test_helpers.act_as('e3333333-3333-3333-3333-333333333333'); -- genuine institution user

select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner) values ('institution-logos', 'e3333333-3333-3333-3333-333333333333/logo.png', 'e3333333-3333-3333-3333-333333333333') $$,
  'A genuine institution user CAN upload to institution-logos in their own folder'
);

select * from finish();
rollback;
