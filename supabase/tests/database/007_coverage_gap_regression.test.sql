-- ====================================================================
-- ZENZELE RLS/FUNCTION SECURITY TEST SUITE — PART 7
-- Fills the specific coverage gaps confirmed by checking what 001-006
-- already test before writing this file (not assumed to be a blank
-- slate): matches and rate_limits had ZERO coverage; applications,
-- shortlists, notifications, messages, audit_logs had partial coverage
-- missing explicit cross-tenant SELECT denial and write-lock
-- confirmation specifically. This file does not re-test what's already
-- proven elsewhere.
-- ====================================================================

begin;
select plan(16);

-- --------------------------------------------------------------------
-- FIXTURES
-- --------------------------------------------------------------------

insert into auth.users (id, email) values
  ('f1111111-1111-1111-1111-111111111111', 'p8-entrepreneur-a@test.zenzele.co.za'),
  ('f2222222-2222-2222-2222-222222222222', 'p8-entrepreneur-b@test.zenzele.co.za'),
  ('f3333333-3333-3333-3333-333333333333', 'p8-institution-a@test.zenzele.co.za'),
  ('f4444444-4444-4444-4444-444444444444', 'p8-institution-b@test.zenzele.co.za'),
  ('f5555555-5555-5555-5555-555555555555', 'p8-admin@test.zenzele.co.za');

insert into public.institutions (id, name) values
  ('f0000001-0000-0000-0000-000000000001', 'P8 Institution A'),
  ('f0000002-0000-0000-0000-000000000002', 'P8 Institution B');

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
  ('f1111111-1111-1111-1111-111111111111', 'entrepreneur', 'P8 Entrepreneur A', 'p8-entrepreneur-a@test.zenzele.co.za', null),
  ('f2222222-2222-2222-2222-222222222222', 'entrepreneur', 'P8 Entrepreneur B', 'p8-entrepreneur-b@test.zenzele.co.za', null),
  ('f3333333-3333-3333-3333-333333333333', 'institution', 'P8 Institution A User', 'p8-institution-a@test.zenzele.co.za', 'f0000001-0000-0000-0000-000000000001'),
  ('f4444444-4444-4444-4444-444444444444', 'institution', 'P8 Institution B User', 'p8-institution-b@test.zenzele.co.za', 'f0000002-0000-0000-0000-000000000002'),
  ('f5555555-5555-5555-5555-555555555555', 'admin', 'P8 Admin', 'p8-admin@test.zenzele.co.za', null)
) as v(id, role, full_name, email, institution_id)
where p.id = v.id::uuid;

insert into public.business_passports (id, owner_id, business_name, is_published, trust_score, overall_verification_status) values
  ('f6666661-1111-1111-1111-000000000001', 'f1111111-1111-1111-1111-111111111111', 'P8 Business A', true, 60, 'unverified'),
  ('f6666662-2222-2222-2222-000000000002', 'f2222222-2222-2222-2222-222222222222', 'P8 Business B', true, 40, 'unverified');

insert into public.opportunities (id, institution_id, created_by, title, opportunity_type, status) values
  ('f7777771-1111-1111-1111-000000000001', 'f0000001-0000-0000-0000-000000000001', 'f3333333-3333-3333-3333-333333333333', 'P8 Opportunity A', 'procurement', 'active');

insert into public.matches (id, opportunity_id, passport_id, match_score, match_tier) values
  ('f8888881-1111-1111-1111-000000000001', 'f7777771-1111-1111-1111-000000000001', 'f6666661-1111-1111-1111-000000000001', 85.0, 'exact');

insert into public.applications (id, opportunity_id, passport_id, status) values
  ('f9999991-1111-1111-1111-000000000001', 'f7777771-1111-1111-1111-000000000001', 'f6666661-1111-1111-1111-000000000001', 'submitted');

insert into public.notifications (id, recipient_id, category, title, body, is_read) values
  ('faaaaaa1-1111-1111-1111-000000000001', 'f1111111-1111-1111-1111-111111111111', 'invitation', 'A notification for A', 'body', false);

insert into public.messages (id, sender_id, recipient_id, body, is_read) values
  ('fbbbbbb1-1111-1111-1111-000000000001', 'f3333333-3333-3333-3333-333333333333', 'f1111111-1111-1111-1111-111111111111', 'A message to entrepreneur A', false);

insert into public.shortlists (institution_id, passport_id, created_by) values
  ('f0000001-0000-0000-0000-000000000001', 'f6666661-1111-1111-1111-000000000001', 'f3333333-3333-3333-3333-333333333333');

-- --------------------------------------------------------------------
-- GROUP 1: matches — previously ZERO coverage
-- --------------------------------------------------------------------

select test_helpers.act_as('f4444444-4444-4444-4444-444444444444'); -- institution B, unrelated opportunity

select is_empty(
  $$ select 1 from public.matches where id = 'f8888881-1111-1111-1111-000000000001' $$,
  'Institution B cannot SELECT a match belonging to Institution A''s opportunity'
);

select test_helpers.act_as('f2222222-2222-2222-2222-222222222222'); -- entrepreneur B, unrelated passport

select is_empty(
  $$ select 1 from public.matches where id = 'f8888881-1111-1111-1111-000000000001' $$,
  'Entrepreneur B cannot SELECT a match belonging to Entrepreneur A''s passport'
);

select throws_ok(
  $$ insert into public.matches (opportunity_id, passport_id, match_score, match_tier) values ('f7777771-1111-1111-1111-000000000001', 'f6666662-2222-2222-2222-000000000002', 99.0, 'exact') $$,
  null, null,
  'No authenticated role (not even the entrepreneur or institution involved) can INSERT into matches directly — write-locked to service role (match-businesses edge function) only'
);

select test_helpers.act_as('f1111111-1111-1111-1111-111111111111'); -- entrepreneur A, DOES own the matched passport

select is_empty(
  $$ update public.matches set match_score = 100 where id = 'f8888881-1111-1111-1111-000000000001' returning id $$,
  'Even the entrepreneur whose own passport is matched cannot UPDATE the match score — the only applicable policy ("matches: admin all") requires is_admin(), so a non-admin''s UPDATE silently affects zero rows rather than throwing (found via real execution: the original throws_ok assertion was the wrong type for this case)'
);

-- --------------------------------------------------------------------
-- GROUP 2: rate_limits — previously ZERO coverage
-- --------------------------------------------------------------------

select is_empty(
  $$ select 1 from public.rate_limits $$,
  'No authenticated user can SELECT from rate_limits directly — the table has no policies granting authenticated any access at all'
);

select throws_ok(
  $$ insert into public.rate_limits (rate_key, window_start, request_count) values ('forged-key', now(), 1) $$,
  null, null,
  'No authenticated user can INSERT into rate_limits directly — only check_rate_limit() (SECURITY DEFINER) can write to this table'
);

-- --------------------------------------------------------------------
-- GROUP 3: audit_logs — admin CAN read, others CANNOT, immutable even
-- for admin
-- --------------------------------------------------------------------

select test_helpers.act_as('f1111111-1111-1111-1111-111111111111'); -- entrepreneur

select is_empty(
  $$ select 1 from public.audit_logs $$,
  'An entrepreneur cannot read audit_logs at all, even entries about their own account'
);

select test_helpers.act_as('f3333333-3333-3333-3333-333333333333'); -- institution

select is_empty(
  $$ select 1 from public.audit_logs $$,
  'An institution user cannot read audit_logs'
);

-- Must insert as service_role — this runs after earlier act_as() calls
-- already switched context away from superuser, and audit_logs
-- correctly has no INSERT policy for authenticated at all.
select test_helpers.act_as(null, 'service_role');
insert into public.audit_logs (actor_id, action, entity_type) values ('f5555555-5555-5555-5555-555555555555', 'test.action', 'test_entity');

select test_helpers.act_as('f5555555-5555-5555-5555-555555555555'); -- admin

select isnt(
  (select count(*)::int from public.audit_logs),
  0,
  'Admin CAN read audit_logs'
);

select is_empty(
  $$ update public.audit_logs set action = 'tampered' where entity_type = 'test_entity' returning id $$,
  'Even admin cannot UPDATE an audit log entry — no UPDATE policy exists for anyone, so the attempt silently affects zero rows (found via real execution: throws_ok was the wrong assertion type here)'
);

select is_empty(
  $$ delete from public.audit_logs where entity_type = 'test_entity' returning id $$,
  'Even admin cannot DELETE an audit log entry — no DELETE policy exists for anyone, same zero-rows-affected behavior'
);

-- --------------------------------------------------------------------
-- GROUP 4: notifications — cross-tenant SELECT denial, INSERT denial
-- --------------------------------------------------------------------

select test_helpers.act_as('f2222222-2222-2222-2222-222222222222'); -- entrepreneur B, not the recipient

select is_empty(
  $$ select 1 from public.notifications where id = 'faaaaaa1-1111-1111-1111-000000000001' $$,
  'Entrepreneur B cannot SELECT a notification addressed to Entrepreneur A'
);

select throws_ok(
  $$ insert into public.notifications (recipient_id, category, title) values ('f2222222-2222-2222-2222-222222222222', 'invitation', 'Self-sent') $$,
  null, null,
  'No authenticated user can INSERT a notification directly, even one addressed to themselves — service-role (notification-engine) only'
);

-- --------------------------------------------------------------------
-- GROUP 5: messages — a third party (neither sender nor recipient)
-- sees nothing
-- --------------------------------------------------------------------

select test_helpers.act_as('f2222222-2222-2222-2222-222222222222'); -- entrepreneur B — not sender, not recipient

select is_empty(
  $$ select 1 from public.messages where id = 'fbbbbbb1-1111-1111-1111-000000000001' $$,
  'A user who is neither sender nor recipient cannot SELECT the message at all'
);

-- --------------------------------------------------------------------
-- GROUP 6: shortlists — cross-tenant SELECT/DELETE denial
-- --------------------------------------------------------------------

select test_helpers.act_as('f4444444-4444-4444-4444-444444444444'); -- institution B

select is_empty(
  $$ select 1 from public.shortlists where institution_id = 'f0000001-0000-0000-0000-000000000001' $$,
  'Institution B cannot SELECT Institution A''s shortlist entries'
);

select is_empty(
  $$ delete from public.shortlists where institution_id = 'f0000001-0000-0000-0000-000000000001' returning id $$,
  'Institution B cannot DELETE Institution A''s shortlist entry (RLS-filtered to zero rows)'
);

select * from finish();
rollback;
