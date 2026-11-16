-- ====================================================================
-- SITHELO FUNCTION/TRIGGER TEST SUITE — PART 12
-- Covers migration 035: document upload -> verification request,
-- verification decision -> document status, and automatic one-way
-- passport publication once the threshold is met.
-- ====================================================================

begin;
select plan(14);

-- --------------------------------------------------------------------
-- FIXTURES
-- --------------------------------------------------------------------

insert into auth.users (id, email) values
  ('12111111-1111-1111-1111-111111111111', 'p12-owner-a@test.sithelo.co.za'),
  ('12222222-2222-2222-2222-222222222222', 'p12-owner-b@test.sithelo.co.za');

-- handle_new_user (004) auto-creates the profiles rows; update them.
update public.profiles set role = 'entrepreneur', full_name = 'P12 Owner A'
  where id = '12111111-1111-1111-1111-111111111111';
update public.profiles set role = 'entrepreneur', full_name = 'P12 Owner B'
  where id = '12222222-2222-2222-2222-222222222222';

-- Passport A: profile complete, nothing verified yet.
insert into public.business_passports (id, owner_id, business_name, industry, province, business_description, is_published) values
  ('12aaaaaa-1111-1111-1111-000000000001', '12111111-1111-1111-1111-111111111111', 'P12 Complete Business', 'Construction', 'Gauteng', 'Civil works contractor.', false);

-- Passport B: name only.
insert into public.business_passports (id, owner_id, business_name, is_published) values
  ('12bbbbbb-2222-2222-2222-000000000002', '12222222-2222-2222-2222-222222222222', 'P12 Incomplete Business', false);

-- --------------------------------------------------------------------
-- GROUP 1: uploading a document requests a verification
-- (service_role, as /api/documents/upload writes)
-- --------------------------------------------------------------------

select test_helpers.act_as(null, 'service_role');

insert into public.documents (id, passport_id, document_type, file_path, file_name) values
  ('12d00001-0000-0000-0000-000000000001', '12aaaaaa-1111-1111-1111-000000000001', 'cipc_certificate', 'p12/a/cipc-1.pdf', 'cipc-1.pdf');

select is(
  (select status::text from public.verifications where passport_id = '12aaaaaa-1111-1111-1111-000000000001' and verification_type = 'cipc'),
  'pending',
  'Uploading a CIPC certificate creates a pending cipc verification'
);

insert into public.documents (id, passport_id, document_type, file_path, file_name) values
  ('12d00002-0000-0000-0000-000000000002', '12aaaaaa-1111-1111-1111-000000000001', 'other', 'p12/a/other.pdf', 'other.pdf'),
  ('12d00003-0000-0000-0000-000000000003', '12aaaaaa-1111-1111-1111-000000000001', 'cipc_certificate', 'p12/a/cipc-2.pdf', 'cipc-2.pdf');

select is(
  (select count(*)::int from public.verifications where passport_id = '12aaaaaa-1111-1111-1111-000000000001'),
  1,
  'An "other" document requests nothing, and a second CIPC document does not create a duplicate verification'
);

select is(
  (select is_published from public.business_passports where id = '12aaaaaa-1111-1111-1111-000000000001'),
  false,
  'A pending verification does not publish the passport'
);

-- --------------------------------------------------------------------
-- GROUP 2: publication needs a VERIFIED verification
-- --------------------------------------------------------------------

select test_helpers.act_as('12111111-1111-1111-1111-111111111111'); -- owner A

select lives_ok(
  $$ update public.business_passports set business_description = 'Civil works and paving contractor.' where id = '12aaaaaa-1111-1111-1111-000000000001' $$,
  'Owner can edit their own profile'
);

select test_helpers.act_as(null, 'service_role');

select is(
  (select is_published from public.business_passports where id = '12aaaaaa-1111-1111-1111-000000000001'),
  false,
  'A complete profile alone does not publish — nothing is verified yet'
);

update public.verifications set status = 'verified'
  where passport_id = '12aaaaaa-1111-1111-1111-000000000001' and verification_type = 'cipc';

select is(
  (select is_published from public.business_passports where id = '12aaaaaa-1111-1111-1111-000000000001'),
  true,
  'Approving a verification publishes a passport whose profile is complete'
);

select is(
  (select count(*)::int from public.documents where passport_id = '12aaaaaa-1111-1111-1111-000000000001' and status = 'valid'),
  2,
  'Approving the verification marks both CIPC documents valid'
);

select is(
  (select status::text from public.documents where id = '12d00002-0000-0000-0000-000000000002'),
  'pending_review',
  'The unrelated "other" document is left pending review'
);

select is(
  (select count(*)::int from public.passport_activity where passport_id = '12aaaaaa-1111-1111-1111-000000000001' and activity_type = 'published'),
  1,
  'Publication is recorded once in passport activity'
);

-- --------------------------------------------------------------------
-- GROUP 3: publication needs a COMPLETE profile
-- --------------------------------------------------------------------

insert into public.verifications (passport_id, verification_type, status) values
  ('12bbbbbb-2222-2222-2222-000000000002', 'bank', 'verified');

select is(
  (select is_published from public.business_passports where id = '12bbbbbb-2222-2222-2222-000000000002'),
  false,
  'A verified verification alone does not publish an incomplete profile'
);

select test_helpers.act_as('12222222-2222-2222-2222-222222222222'); -- owner B

update public.business_passports
  set industry = 'Retail', province = 'Limpopo', business_description = 'Spaza shop.'
  where id = '12bbbbbb-2222-2222-2222-000000000002';

select test_helpers.act_as(null, 'service_role');

select is(
  (select is_published from public.business_passports where id = '12bbbbbb-2222-2222-2222-000000000002'),
  true,
  'Completing the profile publishes a passport that already has a verified verification'
);

-- --------------------------------------------------------------------
-- GROUP 4: rejection, re-upload and expiry
-- --------------------------------------------------------------------

insert into public.documents (passport_id, document_type, file_path, file_name) values
  ('12aaaaaa-1111-1111-1111-000000000001', 'tax_clearance', 'p12/a/tax-1.pdf', 'tax-1.pdf');
update public.verifications set status = 'rejected'
  where passport_id = '12aaaaaa-1111-1111-1111-000000000001' and verification_type = 'sars';
insert into public.documents (passport_id, document_type, file_path, file_name) values
  ('12aaaaaa-1111-1111-1111-000000000001', 'tax_clearance', 'p12/a/tax-2.pdf', 'tax-2.pdf');

select is(
  (select status::text from public.verifications where passport_id = '12aaaaaa-1111-1111-1111-000000000001' and verification_type = 'sars'),
  'pending',
  'Uploading a new document re-opens a rejected verification'
);

update public.verifications set status = 'expired'
  where passport_id = '12aaaaaa-1111-1111-1111-000000000001' and verification_type = 'cipc';

select is(
  (select count(*)::int from public.documents where passport_id = '12aaaaaa-1111-1111-1111-000000000001' and status = 'expired'),
  2,
  'Expiring a verification marks its valid documents expired'
);

select is(
  (select is_published from public.business_passports where id = '12aaaaaa-1111-1111-1111-000000000001'),
  true,
  'Publication is one-way: an expired verification does not unpublish the passport'
);

select * from finish();
rollback;
