-- ====================================================================
-- ZENZELE RLS SECURITY TEST SUITE — PART 2
-- Covers migrations 006 (applications/messages), 007 (discovery view),
-- 009 (admin provisioning). Run alongside 001_rls_security.test.sql via
-- `supabase test db`. Same fixture-naming convention; this file creates
-- its own independent fixtures so it can run standalone.
-- ====================================================================

begin;
select plan(18);

-- --------------------------------------------------------------------
-- FIXTURES
-- --------------------------------------------------------------------

insert into auth.users (id, email) values
  ('a1111111-1111-1111-1111-111111111111', 'app-entrepreneur-a@test.zenzele.co.za'),
  ('a3333333-3333-3333-3333-333333333333', 'app-institution-a@test.zenzele.co.za'),
  ('a4444444-4444-4444-4444-444444444444', 'app-institution-b@test.zenzele.co.za'),
  ('a5555555-5555-5555-5555-555555555555', 'app-admin@test.zenzele.co.za'),
  ('a6666666-6666-6666-6666-666666666666', 'app-entrepreneur-recipient@test.zenzele.co.za');

insert into public.institutions (id, name) values
  ('a0000001-0000-0000-0000-000000000001', 'Applications Test Institution A'),
  ('a0000002-0000-0000-0000-000000000002', 'Applications Test Institution B');

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
  ('a1111111-1111-1111-1111-111111111111', 'entrepreneur', 'App Entrepreneur A', 'app-entrepreneur-a@test.zenzele.co.za', null),
  ('a3333333-3333-3333-3333-333333333333', 'institution', 'App Institution A User', 'app-institution-a@test.zenzele.co.za', 'a0000001-0000-0000-0000-000000000001'),
  ('a4444444-4444-4444-4444-444444444444', 'institution', 'App Institution B User', 'app-institution-b@test.zenzele.co.za', 'a0000002-0000-0000-0000-000000000002'),
  ('a5555555-5555-5555-5555-555555555555', 'admin', 'App Admin', 'app-admin@test.zenzele.co.za', null),
  ('a6666666-6666-6666-6666-666666666666', 'entrepreneur', 'App Entrepreneur Recipient', 'app-entrepreneur-recipient@test.zenzele.co.za', null)
) as v(id, role, full_name, email, institution_id)
where p.id = v.id::uuid;

insert into public.business_passports (id, owner_id, business_name, is_published, trust_score, overall_verification_status, head_office_address, business_email, annual_turnover) values
  ('a2222221-1111-1111-1111-000000000001', 'a1111111-1111-1111-1111-111111111111', 'App Entrepreneur A Business', true, 60, 'unverified', '123 Private Street, Sandton', 'private@example.co.za', 5000000),
  ('a2222221-1111-1111-1111-000000000002', 'a6666666-6666-6666-6666-666666666666', 'App Entrepreneur Recipient Business', false, 30, 'unverified', null, null, null);

insert into public.opportunities (id, institution_id, created_by, title, opportunity_type, status) values
  ('a2222222-2222-2222-2222-000000000001', 'a0000001-0000-0000-0000-000000000001', 'a3333333-3333-3333-3333-333333333333', 'App Test Opportunity A', 'procurement', 'active');

insert into public.applications (id, opportunity_id, passport_id, status) values
  ('a2222223-3333-3333-3333-000000000001', 'a2222222-2222-2222-2222-000000000001', 'a2222221-1111-1111-1111-000000000001', 'submitted');

insert into public.messages (id, sender_id, recipient_id, body, is_read) values
  ('a2222224-4444-4444-4444-000000000001', 'a3333333-3333-3333-3333-333333333333', 'a6666666-6666-6666-6666-666666666666', 'We would like to discuss your application', false);

-- --------------------------------------------------------------------
-- GROUP 1: applications — entrepreneur cannot self-approve (migration 006)
-- --------------------------------------------------------------------

select test_helpers.act_as('a1111111-1111-1111-1111-111111111111');

select throws_ok(
  $$ update public.applications set status = 'awarded' where id = 'a2222223-3333-3333-3333-000000000001' $$,
  null, null,
  'Entrepreneur cannot mark their own application as awarded — now an explicit trigger rejection (migration 023) rather than silent RLS filtering, since the row IS visible/matchable to them (they own the passport); the trigger is what actually stops the status change'
);

select throws_ok(
  $$ update public.applications set status = 'shortlisted' where id = 'a2222223-3333-3333-3333-000000000001' $$,
  null, null,
  'Entrepreneur cannot mark their own application as shortlisted (same trigger rejection)'
);

select throws_ok(
  $$ update public.applications set reviewed_by = 'a1111111-1111-1111-1111-111111111111' where id = 'a2222223-3333-3333-3333-000000000001' $$,
  null, null,
  'Entrepreneur cannot forge reviewed_by on their own application — column-level permission denied (migration 021), since reviewed_by is not in the granted UPDATE column list at all'
);

select lives_ok(
  $$ update public.applications set status = 'withdrawn' where id = 'a2222223-3333-3333-3333-000000000001' $$,
  'Entrepreneur CAN withdraw their own application'
);

-- Reset for subsequent tests — must run as service_role (not the
-- entrepreneur we're still act_as'd as), since the new trigger
-- (migration 023) correctly rejects an entrepreneur setting status to
-- anything but 'withdrawn' — including this test's own reset attempt.
select test_helpers.act_as(null, 'service_role');
update public.applications set status = 'submitted' where id = 'a2222223-3333-3333-3333-000000000001';

-- --------------------------------------------------------------------
-- GROUP 2: applications — institution cross-tenant isolation
-- --------------------------------------------------------------------

select test_helpers.act_as('a4444444-4444-4444-4444-444444444444');

select is_empty(
  $$ update public.applications set status = 'shortlisted' where id = 'a2222223-3333-3333-3333-000000000001' returning id $$,
  'Institution B cannot modify Institution A''s application (RLS-filtered to zero rows)'
);

-- --------------------------------------------------------------------
-- GROUP 3: applications — authorized institution CAN review, and
-- reviewed_by/reviewed_at are trigger-enforced regardless of input
-- --------------------------------------------------------------------

select test_helpers.act_as('a3333333-3333-3333-3333-333333333333');

select lives_ok(
  $$ update public.applications set status = 'shortlisted' where id = 'a2222223-3333-3333-3333-000000000001' $$,
  'Institution A (owning the opportunity) CAN update the application status'
);

select is(
  (select reviewed_by::text from public.applications where id = 'a2222223-3333-3333-3333-000000000001'),
  'a3333333-3333-3333-3333-333333333333',
  'reviewed_by was set to the real caller by the trigger, not left null or forgeable'
);

select throws_ok(
  $$ update public.applications set passport_id = 'a2222221-1111-1111-1111-000000000002', status = 'shortlisted' where id = 'a2222223-3333-3333-3333-000000000001' $$,
  null, null,
  'Institution cannot reassign an application it legitimately owns to a different passport (WITH CHECK violation)'
);

-- --------------------------------------------------------------------
-- GROUP 4: applications — admin can manage
-- --------------------------------------------------------------------

select test_helpers.act_as('a5555555-5555-5555-5555-555555555555');

select lives_ok(
  $$ update public.applications set status = 'awarded' where id = 'a2222223-3333-3333-3333-000000000001' $$,
  'Admin CAN update application status directly'
);

-- --------------------------------------------------------------------
-- GROUP 5: messages — recipient can mark read, cannot rewrite content
-- --------------------------------------------------------------------

select test_helpers.act_as('a6666666-6666-6666-6666-666666666666');

-- Migration 010 replaced column-scoped UPDATE access with a table-wide
-- REVOKE + dedicated mark_message_read() function — a raw UPDATE (even
-- of just is_read) is now expected to throw, not succeed. See
-- 003_new_functions_security.test.sql for the function-based coverage.
select throws_ok(
  $$ update public.messages set is_read = true where id = 'a2222224-4444-4444-4444-000000000001' $$,
  null, null,
  'Recipient cannot mark a message read via raw UPDATE post-migration-010 (table-wide revoke; must use mark_message_read())'
);

select throws_ok(
  $$ update public.messages set body = 'Hijacked content' where id = 'a2222224-4444-4444-4444-000000000001' $$,
  null, null,
  'Recipient cannot rewrite message body (column-level revoke)'
);

select throws_ok(
  $$ update public.messages set sender_id = 'a6666666-6666-6666-6666-666666666666' where id = 'a2222224-4444-4444-4444-000000000001' $$,
  null, null,
  'Recipient cannot change sender_id (column-level revoke)'
);

select throws_ok(
  $$ update public.messages set recipient_id = 'a1111111-1111-1111-1111-111111111111' where id = 'a2222224-4444-4444-4444-000000000001' $$,
  null, null,
  'Recipient cannot reassign the message to a different recipient (column-level revoke)'
);

-- Sender identity on insert
select throws_ok(
  $$ insert into public.messages (sender_id, recipient_id, body) values ('a1111111-1111-1111-1111-111111111111', 'a6666666-6666-6666-6666-666666666666', 'Forged sender') $$,
  null, null,
  'A user cannot send a message forging a different sender_id than their own'
);

-- --------------------------------------------------------------------
-- GROUP 6: institution_business_directory data minimization (migration 007)
-- --------------------------------------------------------------------

select is_empty(
  $$ select column_name from information_schema.columns where table_name = 'institution_business_directory' and table_schema = 'public' and column_name in ('head_office_address', 'business_email', 'business_phone', 'key_clients', 'annual_turnover', 'owner_id') $$,
  'institution_business_directory view does not expose head_office_address/business_email/business_phone/key_clients/annual_turnover/owner_id at the schema level'
);

select test_helpers.act_as('a3333333-3333-3333-3333-333333333333');

select is_empty(
  $$ select 1 from public.institution_business_directory where id = 'a2222221-1111-1111-1111-000000000001' and business_name is null $$,
  'Institution A CAN see the published passport via the discovery view (sanity check the view isn''t over-restrictive)'
);

-- --------------------------------------------------------------------
-- GROUP 7: admin provisioning (migration 009)
-- --------------------------------------------------------------------

select test_helpers.act_as('a1111111-1111-1111-1111-111111111111');

select throws_ok(
  $$ select public.admin_promote_user('a6666666-6666-6666-6666-666666666666') $$,
  'P0001',
  'Only admins may promote users to admin',
  'A non-admin cannot call admin_promote_user'
);

select test_helpers.act_as('a5555555-5555-5555-5555-555555555555');

select throws_ok(
  $$ select public.admin_demote_user('a5555555-5555-5555-5555-555555555555', 'entrepreneur') $$,
  'P0001',
  'Cannot demote the last remaining admin',
  'admin_demote_user refuses to demote the only remaining admin (last-admin protection)'
);

select * from finish();
rollback;
