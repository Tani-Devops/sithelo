-- ====================================================================
-- ZENZELE RLS/FUNCTION SECURITY TEST SUITE — PART 3
-- Covers migrations 010 (mark_message_read), 011 (graduated passport
-- access), 012 (list_passport_documents), 014 (notifications fix).
-- ====================================================================

begin;
select plan(13);

-- --------------------------------------------------------------------
-- FIXTURES
-- --------------------------------------------------------------------

insert into auth.users (id, email) values
  ('b1111111-1111-1111-1111-111111111111', 'fn-entrepreneur-owner@test.zenzele.co.za'),
  ('b2222222-2222-2222-2222-222222222222', 'fn-entrepreneur-other@test.zenzele.co.za'),
  ('b3333333-3333-3333-3333-333333333333', 'fn-institution-authorized@test.zenzele.co.za'),
  ('b4444444-4444-4444-4444-444444444444', 'fn-institution-unauthorized@test.zenzele.co.za');

insert into public.institutions (id, name) values
  ('b0000001-0000-0000-0000-000000000001', 'Authorized Institution'),
  ('b0000002-0000-0000-0000-000000000002', 'Unauthorized Institution');

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
  ('b1111111-1111-1111-1111-111111111111', 'entrepreneur', 'Owner', 'fn-entrepreneur-owner@test.zenzele.co.za', null),
  ('b2222222-2222-2222-2222-222222222222', 'entrepreneur', 'Other', 'fn-entrepreneur-other@test.zenzele.co.za', null),
  ('b3333333-3333-3333-3333-333333333333', 'institution', 'Authorized Inst User', 'fn-institution-authorized@test.zenzele.co.za', 'b0000001-0000-0000-0000-000000000001'),
  ('b4444444-4444-4444-4444-444444444444', 'institution', 'Unauthorized Inst User', 'fn-institution-unauthorized@test.zenzele.co.za', 'b0000002-0000-0000-0000-000000000002')
) as v(id, role, full_name, email, institution_id)
where p.id = v.id::uuid;

insert into public.business_passports (id, owner_id, business_name, is_published, trust_score, overall_verification_status, business_email, annual_turnover, business_health_score) values
  ('b5555551-1111-1111-1111-000000000001', 'b1111111-1111-1111-1111-111111111111', 'Fn Test Business', true, 70, 'unverified', 'owner@example.co.za', 1000000, 55);

-- Authorized Institution has a shortlist relationship; Unauthorized does not.
insert into public.shortlists (institution_id, passport_id, created_by) values
  ('b0000001-0000-0000-0000-000000000001', 'b5555551-1111-1111-1111-000000000001', 'b3333333-3333-3333-3333-333333333333');

insert into public.documents (id, passport_id, document_type, file_path, file_name) values
  ('b6666661-1111-1111-1111-000000000001', 'b5555551-1111-1111-1111-000000000001', 'cipc_certificate', 'b1111111-1111-1111-1111-111111111111/cipc.pdf', 'cipc.pdf');

insert into public.messages (id, sender_id, recipient_id, body, is_read) values
  ('b7777771-1111-1111-1111-000000000001', 'b3333333-3333-3333-3333-333333333333', 'b1111111-1111-1111-1111-111111111111', 'Regarding your application', false);

-- --------------------------------------------------------------------
-- GROUP 1: mark_message_read()
-- --------------------------------------------------------------------

select test_helpers.act_as('b2222222-2222-2222-2222-222222222222'); -- not the recipient

select throws_ok(
  $$ select public.mark_message_read('b7777771-1111-1111-1111-000000000001') $$,
  null, null,
  'A non-recipient cannot mark someone else''s message as read'
);

select test_helpers.act_as('b1111111-1111-1111-1111-111111111111'); -- the actual recipient

select lives_ok(
  $$ select public.mark_message_read('b7777771-1111-1111-1111-000000000001') $$,
  'The actual recipient CAN mark their message as read via the function'
);

select is(
  (select is_read from public.messages where id = 'b7777771-1111-1111-1111-000000000001'),
  true,
  'is_read was actually set to true by the function call'
);

-- --------------------------------------------------------------------
-- GROUP 2: get_passport_detail() tier gating
-- --------------------------------------------------------------------

select test_helpers.act_as('b1111111-1111-1111-1111-111111111111'); -- owner

select is(
  (select public.get_passport_detail('b5555551-1111-1111-1111-000000000001')->>'access_tier'),
  'owner_admin',
  'Owner gets access_tier = owner_admin'
);

select isnt(
  (select public.get_passport_detail('b5555551-1111-1111-1111-000000000001')->'business_health_score'),
  'null'::jsonb,
  'Owner CAN see tier-3 field business_health_score'
);

select test_helpers.act_as('b3333333-3333-3333-3333-333333333333'); -- authorized institution (has shortlist)

select is(
  (select public.get_passport_detail('b5555551-1111-1111-1111-000000000001')->>'access_tier'),
  'authorized_institution',
  'Institution WITH a shortlist relationship gets access_tier = authorized_institution'
);

select isnt(
  (select public.get_passport_detail('b5555551-1111-1111-1111-000000000001')->'business_email'),
  'null'::jsonb,
  'Authorized institution CAN see tier-2 field business_email'
);

select ok(
  (select public.get_passport_detail('b5555551-1111-1111-1111-000000000001')->'business_health_score') is null,
  'Authorized institution CANNOT see tier-3 field business_health_score (owner/admin only) — fixed comparison: a missing jsonb key via -> returns SQL NULL, not the JSON null value (''null''::jsonb), so is() against ''null''::jsonb was comparing the wrong thing; found via real execution'
);

select test_helpers.act_as('b4444444-4444-4444-4444-444444444444'); -- unauthorized institution (no relationship)

select is(
  (select public.get_passport_detail('b5555551-1111-1111-1111-000000000001')->>'access_tier'),
  'discovery',
  'Institution WITHOUT any relationship gets access_tier = discovery only'
);

select ok(
  (select public.get_passport_detail('b5555551-1111-1111-1111-000000000001')->'business_email') is null,
  'Unauthorized institution CANNOT see tier-2 field business_email (same NULL-vs-''null''::jsonb comparison fix)'
);

-- --------------------------------------------------------------------
-- GROUP 3: list_passport_documents() authorization
-- --------------------------------------------------------------------

select test_helpers.act_as('b3333333-3333-3333-3333-333333333333'); -- authorized institution

select is(
  (select count(*)::int from public.list_passport_documents('b5555551-1111-1111-1111-000000000001')),
  1,
  'Authorized institution CAN list the passport''s documents'
);

select test_helpers.act_as('b4444444-4444-4444-4444-444444444444'); -- unauthorized institution

select throws_ok(
  $$ select * from public.list_passport_documents('b5555551-1111-1111-1111-000000000001') $$,
  null, null,
  'Unauthorized institution cannot list the passport''s documents'
);

-- --------------------------------------------------------------------
-- GROUP 4: notifications content-tampering fix (migration 014)
-- --------------------------------------------------------------------

-- Must insert as service_role — this fixture runs after Group 3's
-- act_as() already switched the session to authenticated (institution
-- B), and notifications correctly has no INSERT policy for authenticated
-- at all (service-role/notification-engine only).
select test_helpers.act_as(null, 'service_role');

insert into public.notifications (id, recipient_id, category, title, body, is_read)
values ('b8888881-1111-1111-1111-000000000001', 'b1111111-1111-1111-1111-111111111111', 'verification', 'Original title', 'Original body', false);

select test_helpers.act_as('b1111111-1111-1111-1111-111111111111');

select throws_ok(
  $$ update public.notifications set title = 'Hijacked' where id = 'b8888881-1111-1111-1111-000000000001' $$,
  null, null,
  'Recipient cannot rewrite notification title (column-level revoke, migration 014)'
);

select * from finish();
rollback;
