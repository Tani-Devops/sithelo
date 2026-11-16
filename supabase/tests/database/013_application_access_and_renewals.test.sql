-- ====================================================================
-- SITHELO FUNCTION/TRIGGER TEST SUITE — PART 13
-- Covers migrations 036/037: an application shares an unpublished
-- passport with that institution only, and the admin renewal review.
-- ====================================================================

begin;
select plan(12);

-- --------------------------------------------------------------------
-- FIXTURES
-- --------------------------------------------------------------------

insert into auth.users (id, email) values
  ('13111111-1111-1111-1111-111111111111', 'p13-owner@test.sithelo.co.za'),
  ('13222222-2222-2222-2222-222222222222', 'p13-inst-applied@test.sithelo.co.za'),
  ('13333333-3333-3333-3333-333333333333', 'p13-inst-other@test.sithelo.co.za'),
  ('13444444-4444-4444-4444-444444444444', 'p13-admin@test.sithelo.co.za');

insert into public.institutions (id, name, approval_status) values
  ('13000001-0000-0000-0000-000000000001', 'P13 Applied-To Institution', 'approved'),
  ('13000002-0000-0000-0000-000000000002', 'P13 Other Institution', 'approved');

update public.profiles as p set role = v.role::user_role, full_name = v.full_name, institution_id = v.institution_id::uuid
from (values
  ('13111111-1111-1111-1111-111111111111', 'entrepreneur', 'P13 Owner', null),
  ('13222222-2222-2222-2222-222222222222', 'institution', 'P13 Applied', '13000001-0000-0000-0000-000000000001'),
  ('13333333-3333-3333-3333-333333333333', 'institution', 'P13 Other', '13000002-0000-0000-0000-000000000002'),
  ('13444444-4444-4444-4444-444444444444', 'admin', 'P13 Admin', null)
) as v(id, role, full_name, institution_id)
where p.id = v.id::uuid;

insert into public.business_passports (id, owner_id, business_name, is_published) values
  ('13aaaaaa-1111-1111-1111-000000000001', '13111111-1111-1111-1111-111111111111', 'P13 Unpublished Business', false);

insert into public.opportunities (id, institution_id, title, opportunity_type, status) values
  ('13bbbbbb-1111-1111-1111-000000000001', '13000001-0000-0000-0000-000000000001', 'P13 Tender', 'procurement', 'active');

insert into public.applications (opportunity_id, passport_id) values
  ('13bbbbbb-1111-1111-1111-000000000001', '13aaaaaa-1111-1111-1111-000000000001');

-- --------------------------------------------------------------------
-- GROUP 1: application-based access to an unpublished passport
-- --------------------------------------------------------------------

select test_helpers.act_as('13222222-2222-2222-2222-222222222222'); -- applied-to institution

select is(
  (select public.get_passport_detail('13aaaaaa-1111-1111-1111-000000000001') ->> 'access_tier'),
  'authorized_institution',
  'The institution an entrepreneur applied to can open their unpublished passport'
);

select lives_ok(
  $$ select * from public.list_passport_documents('13aaaaaa-1111-1111-1111-000000000001') $$,
  'The applied-to institution can list the unpublished passport''s documents'
);

select throws_ok(
  $$ insert into public.shortlists (institution_id, passport_id, created_by) values ('13000001-0000-0000-0000-000000000001', '13aaaaaa-1111-1111-1111-000000000001', '13222222-2222-2222-2222-222222222222') $$,
  null, null,
  'Shortlisting an unpublished passport is still refused, even with an application'
);

select test_helpers.act_as('13333333-3333-3333-3333-333333333333'); -- unrelated institution

select throws_ok(
  $$ select public.get_passport_detail('13aaaaaa-1111-1111-1111-000000000001') $$,
  null, null,
  'An unrelated institution still cannot open an unpublished passport'
);

select throws_ok(
  $$ select * from public.list_passport_documents('13aaaaaa-1111-1111-1111-000000000001') $$,
  null, null,
  'An unrelated institution still cannot list an unpublished passport''s documents'
);

-- --------------------------------------------------------------------
-- GROUP 2: renewal review
-- --------------------------------------------------------------------

select test_helpers.act_as(null, 'service_role');

insert into public.verifications (passport_id, verification_type, status, expiry_date) values
  ('13aaaaaa-1111-1111-1111-000000000001', 'sars', 'verified', '2026-12-31');

-- Uploaded while verified: a renewal. The verification must stay verified.
insert into public.documents (id, passport_id, document_type, file_path, file_name, expiry_date) values
  ('13d00001-0000-0000-0000-000000000001', '13aaaaaa-1111-1111-1111-000000000001', 'tax_clearance', 'p13/a/tax-2027.pdf', 'tax-2027.pdf', '2027-12-31'),
  ('13d00002-0000-0000-0000-000000000002', '13aaaaaa-1111-1111-1111-000000000001', 'tax_clearance', 'p13/a/tax-bad.pdf', 'tax-bad.pdf', '2028-01-31');

select is(
  (select status::text from public.verifications where passport_id = '13aaaaaa-1111-1111-1111-000000000001' and verification_type = 'sars'),
  'verified',
  'A renewal upload does not drop a verified verification back to pending'
);

select test_helpers.act_as('13111111-1111-1111-1111-111111111111'); -- owner

select throws_ok(
  $$ select public.admin_accept_document_renewal('13d00001-0000-0000-0000-000000000001') $$,
  null, null,
  'A non-admin cannot accept a renewal'
);

select test_helpers.act_as('13444444-4444-4444-4444-444444444444'); -- admin

select lives_ok(
  $$ select public.admin_accept_document_renewal('13d00001-0000-0000-0000-000000000001') $$,
  'Admin can accept a renewal'
);

select test_helpers.act_as(null, 'service_role');

select is(
  (select expiry_date::text from public.verifications where passport_id = '13aaaaaa-1111-1111-1111-000000000001' and verification_type = 'sars'),
  '2027-12-31',
  'Accepting a renewal moves the verification''s expiry date to the new document''s'
);

select test_helpers.act_as('13444444-4444-4444-4444-444444444444');

select lives_ok(
  $$ select public.admin_reject_document('13d00002-0000-0000-0000-000000000002', 'Wrong year') $$,
  'Admin can reject a renewal document'
);

select test_helpers.act_as(null, 'service_role');

select is(
  (select status::text from public.documents where id = '13d00002-0000-0000-0000-000000000002'),
  'rejected',
  'A rejected renewal document is marked rejected'
);

select is(
  (select count(*)::int from public.notifications where recipient_id = '13111111-1111-1111-1111-111111111111' and category = 'verification'),
  1,
  'The owner is notified when a document is rejected'
);

select * from finish();
rollback;
