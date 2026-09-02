-- ====================================================================
-- ZENZELE RLS SECURITY TEST SUITE
-- Run with: supabase test db
-- Requires 000_setup.sql to have run first (pgTAP + test_helpers.act_as).
--
-- This tests the DATABASE layer only — the actual authorization ground
-- truth. It does not test edge function auth (HTTP concern — see
-- scripts/test-edge-function-auth.sh) or middleware routing (see
-- SECURITY_TESTS.md for how to exercise that manually / via Playwright).
--
-- IMPORTANT on assertion choice: an RLS `USING` clause that excludes a
-- row makes an UPDATE/DELETE silently affect zero rows — it does NOT
-- throw. Only a `WITH CHECK` violation or a column-level `REVOKE` throws
-- an actual exception. Using throws_ok() for a USING-filtered no-op
-- would make the test pass even if RLS were completely broken (0 rows
-- either way), so this suite is deliberate about which assertion each
-- case actually needs — see the comment on each test.
-- ====================================================================

begin;
select plan(27);

-- --------------------------------------------------------------------
-- FIXTURES (inserted as superuser, bypassing RLS — this is setup, not
-- the thing under test)
-- --------------------------------------------------------------------

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'entrepreneur-a@test.zenzele.co.za'),
  ('22222222-2222-2222-2222-222222222222', 'entrepreneur-b@test.zenzele.co.za'),
  ('33333333-3333-3333-3333-333333333333', 'institution-a-user@test.zenzele.co.za'),
  ('44444444-4444-4444-4444-444444444444', 'institution-b-user@test.zenzele.co.za'),
  ('55555555-5555-5555-5555-555555555555', 'admin@test.zenzele.co.za');

insert into public.institutions (id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Institution A'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Institution B');

-- Direct insert, not through handle_new_user — this is fixture setup
-- for real signups, not an attempt to prove the trigger works (that's
-- implicitly exercised by every real signup and isn't itself a
-- cross-tenant-isolation concern this suite is about).
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
  ('11111111-1111-1111-1111-111111111111', 'entrepreneur', 'Entrepreneur A', 'entrepreneur-a@test.zenzele.co.za', null),
  ('22222222-2222-2222-2222-222222222222', 'entrepreneur', 'Entrepreneur B', 'entrepreneur-b@test.zenzele.co.za', null),
  ('33333333-3333-3333-3333-333333333333', 'institution', 'Institution A User', 'institution-a-user@test.zenzele.co.za', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('44444444-4444-4444-4444-444444444444', 'institution', 'Institution B User', 'institution-b-user@test.zenzele.co.za', 'bbbbbbbb-0000-0000-0000-000000000002'),
  ('55555555-5555-5555-5555-555555555555', 'admin', 'Zenzele Admin', 'admin@test.zenzele.co.za', null)
) as v(id, role, full_name, email, institution_id)
where p.id = v.id::uuid;

insert into public.business_passports (id, owner_id, business_name, is_published, trust_score, overall_verification_status) values
  ('aaaaaaaa-1111-1111-1111-000000000001', '11111111-1111-1111-1111-111111111111', 'Entrepreneur A Business', true, 40, 'unverified'),
  ('bbbbbbbb-1111-1111-1111-000000000002', '22222222-2222-2222-2222-222222222222', 'Entrepreneur B Business', false, 20, 'unverified');

insert into public.opportunities (id, institution_id, created_by, title, opportunity_type, status) values
  ('aaaaaaaa-2222-2222-2222-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'Institution A Opportunity', 'procurement', 'active'),
  ('bbbbbbbb-2222-2222-2222-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', '44444444-4444-4444-4444-444444444444', 'Institution B Opportunity', 'procurement', 'active');

-- --------------------------------------------------------------------
-- GROUP 1: profiles.institution_id / role immutability (migration 005)
-- Both hit column-level REVOKE — these DO throw.
-- --------------------------------------------------------------------

select test_helpers.act_as('33333333-3333-3333-3333-333333333333');

select throws_ok(
  $$ update public.profiles set institution_id = 'bbbbbbbb-0000-0000-0000-000000000002' where id = '33333333-3333-3333-3333-333333333333' $$,
  null, null,
  'Institution A user changing their own institution_id to Institution B MUST FAIL (column-level revoke)'
);

select throws_ok(
  $$ update public.profiles set role = 'admin' where id = '33333333-3333-3333-3333-333333333333' $$,
  null, null,
  'Institution A user self-promoting to admin MUST FAIL (column-level revoke)'
);

-- --------------------------------------------------------------------
-- GROUP 2: cross-institution opportunity isolation
-- These are USING-filtered no-ops, not exceptions — assert via
-- RETURNING + is_empty (touched zero rows) instead of throws_ok.
-- --------------------------------------------------------------------

select is_empty(
  $$ update public.opportunities set title = 'Hijacked' where id = 'bbbbbbbb-2222-2222-2222-000000000002' returning id $$,
  'Institution A cannot modify Institution B''s opportunity (RLS-filtered to zero rows)'
);

-- NOTE (fixed after actual execution surfaced this): this assertion
-- must run in a context that can actually SEE Institution B's row to
-- confirm it's unchanged — Institution A legitimately cannot see it at
-- all via RLS, so checking "unchanged" from A's own session trivially
-- returns NULL rather than verifying anything. Real execution against a
-- real Postgres instance caught this; it's the kind of bug that's
-- invisible from reading the SQL alone. Switch to service_role
-- momentarily, then back to Institution A for the assertions that
-- follow.
select test_helpers.act_as(null, 'service_role');

select is(
  (select title from public.opportunities where id = 'bbbbbbbb-2222-2222-2222-000000000002'),
  'Institution B Opportunity',
  'Institution B''s opportunity title is unchanged after Institution A''s attempted update (verified from a context that can actually see the row)'
);

select test_helpers.act_as('33333333-3333-3333-3333-333333333333');

select is_empty(
  $$ select 1 from public.opportunities where id = 'bbbbbbbb-2222-2222-2222-000000000002' $$,
  'Institution A user querying Institution B''s specific opportunity by id returns nothing'
);

select is_empty(
  $$ delete from public.opportunities where id = 'bbbbbbbb-2222-2222-2222-000000000002' returning id $$,
  'Institution A cannot delete Institution B''s opportunity (RLS-filtered to zero rows)'
);

select throws_ok(
  $$ insert into public.opportunities (institution_id, created_by, title, opportunity_type, status) values ('bbbbbbbb-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'Forged', 'procurement', 'active') $$,
  null, null,
  'Institution A user creating an opportunity under Institution B''s institution_id MUST FAIL (WITH CHECK violation)'
);

-- --------------------------------------------------------------------
-- GROUP 3: entrepreneur cross-tenant isolation (USING-filtered no-ops)
-- --------------------------------------------------------------------

select test_helpers.act_as('11111111-1111-1111-1111-111111111111');

select is_empty(
  $$ select 1 from public.business_passports where id = 'bbbbbbbb-1111-1111-1111-000000000002' $$,
  'Entrepreneur A cannot SELECT Entrepreneur B''s unpublished passport'
);

select is_empty(
  $$ update public.business_passports set business_name = 'Hijacked' where id = 'bbbbbbbb-1111-1111-1111-000000000002' returning id $$,
  'Entrepreneur A cannot UPDATE Entrepreneur B''s passport (RLS-filtered to zero rows)'
);

select is_empty(
  $$ delete from public.business_passports where id = 'bbbbbbbb-1111-1111-1111-000000000002' returning id $$,
  'Entrepreneur A cannot DELETE Entrepreneur B''s passport (RLS-filtered to zero rows)'
);

-- Confirm Entrepreneur B's passport is genuinely untouched, not just
-- invisible — check as the actual owner, not as Entrepreneur A (whose
-- SELECT of this row correctly returns null/no-row, which would make
-- an equality assertion here meaningless).
select test_helpers.act_as('22222222-2222-2222-2222-222222222222');

select is(
  (select business_name from public.business_passports where id = 'bbbbbbbb-1111-1111-1111-000000000002'),
  'Entrepreneur B Business',
  'Entrepreneur B''s own passport is confirmed unchanged by Entrepreneur A''s prior attempted update/delete'
);

select test_helpers.act_as('11111111-1111-1111-1111-111111111111');

-- --------------------------------------------------------------------
-- GROUP 4: Business Passport self-verification gap (migration 005)
-- All hit column-level REVOKE on the row the entrepreneur DOES own —
-- these DO throw, regardless of ownership, which is the whole point.
-- --------------------------------------------------------------------

select throws_ok(
  $$ update public.business_passports set trust_score = 100 where id = 'aaaaaaaa-1111-1111-1111-000000000001' $$,
  null, null,
  'Entrepreneur cannot set their own trust_score (column-level revoke)'
);

select throws_ok(
  $$ update public.business_passports set overall_verification_status = 'verified' where id = 'aaaaaaaa-1111-1111-1111-000000000001' $$,
  null, null,
  'Entrepreneur cannot self-verify overall_verification_status (column-level revoke)'
);

select throws_ok(
  $$ update public.business_passports set is_published = true where id = 'aaaaaaaa-1111-1111-1111-000000000001' $$,
  null, null,
  'Entrepreneur cannot self-publish is_published (column-level revoke)'
);

select throws_ok(
  $$ update public.business_passports set owner_id = '22222222-2222-2222-2222-222222222222' where id = 'aaaaaaaa-1111-1111-1111-000000000001' $$,
  null, null,
  'Entrepreneur cannot transfer ownership of their own passport (column-level revoke)'
);

select lives_ok(
  $$ update public.business_passports set business_description = 'We do earthworks' where id = 'aaaaaaaa-1111-1111-1111-000000000001' $$,
  'Entrepreneur CAN still update their own editable fields (business_description) — the fix is scoped, not a blanket lockout'
);

-- --------------------------------------------------------------------
-- GROUP 5: documents.status protection (migration 005)
-- --------------------------------------------------------------------

insert into public.documents (id, passport_id, document_type, file_path, file_name)
values ('aaaaaaaa-3333-3333-3333-000000000001', 'aaaaaaaa-1111-1111-1111-000000000001', 'cipc_certificate', '11111111-1111-1111-1111-111111111111/cipc.pdf', 'cipc.pdf');

select is(
  (select status::text from public.documents where id = 'aaaaaaaa-3333-3333-3333-000000000001'),
  'pending_review',
  'Newly inserted document defaults to pending_review regardless of caller intent'
);

select throws_ok(
  $$ update public.documents set status = 'valid' where id = 'aaaaaaaa-3333-3333-3333-000000000001' $$,
  null, null,
  'Entrepreneur cannot mark their own document as valid (column-level revoke)'
);

-- --------------------------------------------------------------------
-- GROUP 6: verifications — entrepreneurs have no write path at all
-- --------------------------------------------------------------------

select throws_ok(
  $$ insert into public.verifications (passport_id, verification_type, status) values ('aaaaaaaa-1111-1111-1111-000000000001', 'cipc', 'verified') $$,
  null, null,
  'Entrepreneur cannot insert a verification record for themselves (no INSERT policy grants this)'
);

-- --------------------------------------------------------------------
-- GROUP 7: audit_logs — no authenticated write path
-- --------------------------------------------------------------------

select throws_ok(
  $$ insert into public.audit_logs (actor_id, action, entity_type) values ('11111111-1111-1111-1111-111111111111', 'fake.action', 'profile') $$,
  null, null,
  'A normal authenticated user cannot write audit_logs directly (service-role only)'
);

-- --------------------------------------------------------------------
-- GROUP 8: admin-only institution membership function
-- --------------------------------------------------------------------

select test_helpers.act_as('55555555-5555-5555-5555-555555555555');

-- Uses '33333333...' (already role=institution, member of Institution A)
-- rather than an entrepreneur — admin_set_institution_membership() now
-- requires the target to already be an institution-role user (migration
-- 022, corrected after real execution showed the original version of
-- this test silently no-op'd via the consistency trigger when targeting
-- an entrepreneur).
select lives_ok(
  $$ select public.admin_set_institution_membership('33333333-3333-3333-3333-333333333333', 'bbbbbbbb-0000-0000-0000-000000000002') $$,
  'Admin CAN move an institution user to a different institution via the sanctioned function'
);

select is(
  (select institution_id::text from public.profiles where id = '33333333-3333-3333-3333-333333333333'),
  'bbbbbbbb-0000-0000-0000-000000000002',
  'Institution membership change via the admin function actually took effect'
);

select test_helpers.act_as('11111111-1111-1111-1111-111111111111');

select throws_ok(
  $$ select public.admin_set_institution_membership('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000002') $$,
  'P0001',
  'Only admins may change institution membership',
  'A non-admin calling admin_set_institution_membership MUST FAIL with the explicit guard message'
);

-- --------------------------------------------------------------------
-- GROUP 9: anonymous access
-- --------------------------------------------------------------------

select test_helpers.act_as(null, 'anon');

select is_empty(
  $$ select 1 from public.business_passports $$,
  'Anonymous users see zero business_passports — Zenzele is permissioned search, not a public directory (see PRODUCT_REQUIREMENTS.md)'
);

select is_empty(
  $$ select 1 from public.profiles $$,
  'Anonymous users cannot read any profiles'
);

select is_empty(
  $$ select 1 from public.verifications $$,
  'Anonymous users cannot read any verifications'
);

select is_empty(
  $$ select 1 from public.audit_logs $$,
  'Anonymous users cannot read any audit_logs'
);

select * from finish();
rollback;
