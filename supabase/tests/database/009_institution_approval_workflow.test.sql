-- ====================================================================
-- ZENZELE/SITHELO RLS/FUNCTION SECURITY TEST SUITE — PART 9
-- Covers migration 027 (institution onboarding) and migration 028
-- (institution data model + approval workflow).
-- ====================================================================

begin;
select plan(22);

-- --------------------------------------------------------------------
-- FIXTURES
-- --------------------------------------------------------------------

insert into auth.users (id, email) values
  ('d1111111-1111-1111-1111-111111111111', 'inst-onboard-fresh@test.sithelo.co.za'),
  ('d2222222-2222-2222-2222-222222222222', 'inst-onboard-entrepreneur@test.sithelo.co.za'),
  ('d3333333-3333-3333-3333-333333333333', 'inst-onboard-already-linked@test.sithelo.co.za'),
  ('d4444444-4444-4444-4444-444444444444', 'inst-onboard-admin@test.sithelo.co.za'),
  ('d5555555-5555-5555-5555-555555555555', 'inst-onboard-second-inst-user@test.sithelo.co.za'),
  ('d6666666-6666-6666-6666-666666666666', 'inst-onboard-unauth-caller@test.sithelo.co.za');

insert into public.institutions (id, name, approval_status) values
  ('d0000001-0000-0000-0000-000000000001', 'Pre-existing Test Institution', 'pending');

update public.profiles as p set
  role = v.role::user_role,
  full_name = v.full_name,
  email = v.email,
  institution_id = v.institution_id::uuid
from (values
  ('d1111111-1111-1111-1111-111111111111', 'institution', 'Fresh Institution User', 'inst-onboard-fresh@test.sithelo.co.za', null),
  ('d2222222-2222-2222-2222-222222222222', 'entrepreneur', 'Entrepreneur', 'inst-onboard-entrepreneur@test.sithelo.co.za', null),
  ('d3333333-3333-3333-3333-333333333333', 'institution', 'Already Linked', 'inst-onboard-already-linked@test.sithelo.co.za', 'd0000001-0000-0000-0000-000000000001'),
  ('d4444444-4444-4444-4444-444444444444', 'admin', 'Approving Admin', 'inst-onboard-admin@test.sithelo.co.za', null),
  ('d5555555-5555-5555-5555-555555555555', 'institution', 'Second Institution User', 'inst-onboard-second-inst-user@test.sithelo.co.za', null),
  ('d6666666-6666-6666-6666-666666666666', 'institution', 'Unauth Caller', 'inst-onboard-unauth-caller@test.sithelo.co.za', null)
) as v(id, role, full_name, email, institution_id)
where p.id = v.id::uuid;

-- --------------------------------------------------------------------
-- GROUP 1: complete_institution_onboarding() access control
-- --------------------------------------------------------------------

select test_helpers.act_as(null); -- unauthenticated
select throws_ok(
  $$ select public.complete_institution_onboarding('Anon Org', null, null, null, null, null, 'a@b.co.za', null, null, null) $$,
  null, null,
  'Unauthenticated caller cannot complete institution onboarding'
);

select test_helpers.act_as('d2222222-2222-2222-2222-222222222222'); -- entrepreneur
select throws_ok(
  $$ select public.complete_institution_onboarding('Entrepreneur Org', null, null, null, null, null, 'a@b.co.za', null, null, null) $$,
  null, null,
  'An entrepreneur account cannot complete institution onboarding'
);

select test_helpers.act_as('d4444444-4444-4444-4444-444444444444'); -- admin
select throws_ok(
  $$ select public.complete_institution_onboarding('Admin-Impersonated Org', null, null, null, null, null, 'a@b.co.za', null, null, null) $$,
  null, null,
  'An admin cannot use the onboarding function to impersonate an institution user (role check rejects non-institution accounts)'
);

select test_helpers.act_as('d3333333-3333-3333-3333-333333333333'); -- already linked institution user
select throws_ok(
  $$ select public.complete_institution_onboarding('Second Org For Existing User', null, null, null, null, null, 'a@b.co.za', null, null, null) $$,
  null, null,
  'An institution user already linked to an institution cannot create a second institution'
);

-- --------------------------------------------------------------------
-- GROUP 2: successful onboarding writes real columns, not just audit log
-- --------------------------------------------------------------------

select test_helpers.act_as('d1111111-1111-1111-1111-111111111111'); -- fresh institution user

select lives_ok(
  $$ select public.complete_institution_onboarding(
       'Fresh Test Institution', 'municipality', 'Gauteng', 'Johannesburg',
       'https://example.co.za', 'Jane Contact', 'jane@example.co.za', '0110000000',
       'A test institution', 'construction'
     ) $$,
  'A fresh institution-role account can complete onboarding'
);

select is(
  (select institution_id from public.profiles where id = 'd1111111-1111-1111-1111-111111111111'),
  (select institution_id from public.institutions where primary_contact_id = 'd1111111-1111-1111-1111-111111111111'),
  'Caller was linked to the institution row created in the same transaction'
);

select is(
  (select approval_status::text from public.institutions where primary_contact_id = 'd1111111-1111-1111-1111-111111111111'),
  'pending',
  'A freshly onboarded institution starts in approval_status = pending, not auto-trusted'
);

select is(
  (select province::text from public.institutions where primary_contact_id = 'd1111111-1111-1111-1111-111111111111'),
  'Gauteng',
  'Onboarding fields (province) are stored on the institutions row itself, not only in the audit log'
);

select is(
  (select primary_contact_email from public.institutions where primary_contact_id = 'd1111111-1111-1111-1111-111111111111'),
  'jane@example.co.za',
  'primary_contact_email is stored as a real institutions column'
);

-- Cannot onboard a second time.
select throws_ok(
  $$ select public.complete_institution_onboarding('Repeat Org', null, null, null, null, null, 'repeat@example.co.za', null, null, null) $$,
  null, null,
  'The same institution user cannot call onboarding a second time (already_onboarded)'
);

-- --------------------------------------------------------------------
-- GROUP 3: cannot attach to an existing institution / cannot choose one
-- --------------------------------------------------------------------

select test_helpers.act_as('d5555555-5555-5555-5555-555555555555'); -- second, unlinked institution user

-- The function signature never accepts an institution_id at all — the
-- only thing it is even capable of doing is creating a brand-new row.
-- This assertion documents that guarantee by confirming a second call
-- results in a second, distinct institution, never a join to the first.
select lives_ok(
  $$ select public.complete_institution_onboarding('Second Fresh Institution', null, null, null, null, null, 'second@example.co.za', null, null, null) $$,
  'A second, independent institution user can onboard their own new institution'
);

select isnt(
  (select institution_id from public.profiles where id = 'd5555555-5555-5555-5555-555555555555'),
  (select institution_id from public.profiles where id = 'd1111111-1111-1111-1111-111111111111'),
  'Two different institution users onboarding independently never end up sharing an institution_id'
);

-- --------------------------------------------------------------------
-- GROUP 4: RLS prevents cross-institution access to the institutions
-- table for non-admin UPDATE (the only sanctioned write path is the
-- SECURITY DEFINER functions above).
-- --------------------------------------------------------------------

select test_helpers.act_as('d1111111-1111-1111-1111-111111111111'); -- institution user, not admin

select throws_ok(
  $$ update public.institutions set approval_status = 'approved' where primary_contact_id = 'd1111111-1111-1111-1111-111111111111' $$,
  null, null,
  'An institution user cannot approve their own institution via a direct table UPDATE (no non-admin UPDATE policy exists on institutions)'
);

select throws_ok(
  $$ update public.institutions set name = 'Hijacked Name' where id = 'd0000001-0000-0000-0000-000000000001' $$,
  null, null,
  'An institution user cannot edit a DIFFERENT institution''s row directly'
);

-- --------------------------------------------------------------------
-- GROUP 5: admin_review_institution() — approval decision function
-- --------------------------------------------------------------------

select test_helpers.act_as('d1111111-1111-1111-1111-111111111111'); -- institution user, not admin

select throws_ok(
  $$ select public.admin_review_institution(
       (select institution_id from public.profiles where id = 'd1111111-1111-1111-1111-111111111111'),
       'approve', null
     ) $$,
  null, null,
  'A non-admin (including the institution''s own user) cannot call admin_review_institution at all'
);

select test_helpers.act_as('d4444444-4444-4444-4444-444444444444'); -- admin

select lives_ok(
  $$ select public.admin_review_institution(
       (select institution_id from public.profiles where id = 'd1111111-1111-1111-1111-111111111111'),
       'approve', null
     ) $$,
  'An admin can approve a pending institution'
);

select is(
  (select approval_status::text from public.institutions where primary_contact_id = 'd1111111-1111-1111-1111-111111111111'),
  'approved',
  'approval_status actually moved to approved after admin decision'
);

select throws_ok(
  $$ select public.admin_review_institution(
       (select institution_id from public.profiles where id = 'd1111111-1111-1111-1111-111111111111'),
       'approve', null
     ) $$,
  null, null,
  'A second decision on an already-approved institution is rejected (institution_already_reviewed), not silently re-applied'
);

select lives_ok(
  $$ select public.admin_review_institution(
       (select institution_id from public.profiles where id = 'd5555555-5555-5555-5555-555555555555'),
       'reject', 'Missing supporting documentation'
     ) $$,
  'An admin can reject a pending institution with a reason'
);

select is(
  (select approval_status::text from public.institutions where primary_contact_id = 'd5555555-5555-5555-5555-555555555555'),
  'rejected',
  'approval_status moved to rejected'
);

-- --------------------------------------------------------------------
-- GROUP 6: an unapproved institution cannot publish an active opportunity
-- --------------------------------------------------------------------

select test_helpers.act_as('d5555555-5555-5555-5555-555555555555'); -- rejected institution's own user

select throws_ok(
  $$ insert into public.opportunities (institution_id, title, opportunity_type, status)
     values ((select institution_id from public.profiles where id = 'd5555555-5555-5555-5555-555555555555'), 'Should be blocked', 'procurement', 'active') $$,
  null, null,
  'A rejected institution cannot create an active opportunity (trigger-enforced, not just RLS)'
);

select test_helpers.act_as('d1111111-1111-1111-1111-111111111111'); -- now-approved institution's own user

select lives_ok(
  $$ insert into public.opportunities (institution_id, title, opportunity_type, status)
     values ((select institution_id from public.profiles where id = 'd1111111-1111-1111-1111-111111111111'), 'Should be allowed', 'procurement', 'active') $$,
  'An approved institution CAN create an active opportunity'
);

select * from finish();
rollback;
