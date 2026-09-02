-- ====================================================================
-- ZENZELE RLS/FUNCTION SECURITY TEST SUITE — PART 4
-- Covers migrations 015 (authoritative passport access / has_passport_
-- relationship / closed RLS bypasses) and 016 (grant audit / rate limit
-- restriction / institution membership consistency).
--
-- CORRECTED during the seventh (adversarial) pass, Part 2: the original
-- version of this file had two groups (1 and the former 6) that called
-- has_passport_relationship() directly, either before any act_as() call
-- (running in the test-runner's elevated context, not as `authenticated`
-- — silently never testing the access-control boundary it appeared to)
-- or, worse, AFTER an act_as() call and AFTER migration 018 revoked
-- EXECUTE from `authenticated` — which would genuinely throw when
-- actually run, not just be misleading. Fixed by: re-scoping Group 1 to
-- explicitly test only the function's LOGIC (documented as such), and
-- replacing the former Group 6 with assertions using
-- has_my_passport_relationship() (the safe wrapper) run in a genuine
-- authenticated institution session — which is both correct and
-- actually exercises what a real caller can do. Reordered so this now
-- runs BEFORE Group 5's admin promotion, since that promotion mutates
-- the institution-A fixture this group needs to still be a genuine
-- institution user.
-- ====================================================================

begin;
select plan(13);

-- --------------------------------------------------------------------
-- FIXTURES
-- --------------------------------------------------------------------

insert into auth.users (id, email) values
  ('c1111111-1111-1111-1111-111111111111', 'auth-owner@test.zenzele.co.za'),
  ('c3333333-3333-3333-3333-333333333333', 'auth-institution-authorized@test.zenzele.co.za'),
  ('c4444444-4444-4444-4444-444444444444', 'auth-institution-unauthorized@test.zenzele.co.za'),
  ('c5555555-5555-5555-5555-555555555555', 'auth-admin@test.zenzele.co.za');

insert into public.institutions (id, name) values
  ('c0000001-0000-0000-0000-000000000001', 'Auth Test Institution A'),
  ('c0000002-0000-0000-0000-000000000002', 'Auth Test Institution B');

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
  ('c1111111-1111-1111-1111-111111111111', 'entrepreneur', 'Auth Owner', 'auth-owner@test.zenzele.co.za', null),
  ('c3333333-3333-3333-3333-333333333333', 'institution', 'Auth Inst Authorized', 'auth-institution-authorized@test.zenzele.co.za', 'c0000001-0000-0000-0000-000000000001'),
  ('c4444444-4444-4444-4444-444444444444', 'institution', 'Auth Inst Unauthorized', 'auth-institution-unauthorized@test.zenzele.co.za', 'c0000002-0000-0000-0000-000000000002'),
  ('c5555555-5555-5555-5555-555555555555', 'admin', 'Auth Admin', 'auth-admin@test.zenzele.co.za', null)
) as v(id, role, full_name, email, institution_id)
where p.id = v.id::uuid;

insert into public.business_passports (id, owner_id, business_name, is_published, trust_score, overall_verification_status, business_email) values
  ('c6666661-1111-1111-1111-000000000001', 'c1111111-1111-1111-1111-111111111111', 'Auth Test Business', true, 65, 'unverified', 'owner@example.co.za');

insert into public.verifications (id, passport_id, verification_type, status) values
  ('c7777771-1111-1111-1111-000000000001', 'c6666661-1111-1111-1111-000000000001', 'cipc', 'verified');

insert into public.passport_activity (id, passport_id, activity_type, description) values
  ('c8888881-1111-1111-1111-000000000001', 'c6666661-1111-1111-1111-000000000001', 'verification_updated', 'Internal review note');

insert into public.trust_score_history (id, passport_id, score) values
  ('c9999991-1111-1111-1111-000000000001', 'c6666661-1111-1111-1111-000000000001', 65);

insert into public.shortlists (institution_id, passport_id, created_by) values
  ('c0000001-0000-0000-0000-000000000001', 'c6666661-1111-1111-1111-000000000001', 'c3333333-3333-3333-3333-333333333333');

-- --------------------------------------------------------------------
-- GROUP 1: has_passport_relationship() — LOGIC correctness only
-- --------------------------------------------------------------------
-- These two run before any act_as() call — genuinely in the test-runner's
-- elevated context (table owner), which is not subject to the migration
-- 018 EXECUTE revoke from `authenticated`. This group deliberately tests
-- only the function's boolean LOGIC, not access control — the
-- access-control claim ("authenticated cannot call this directly") is
-- tested for real, as a genuine authenticated session, in
-- 005_adversarial_pass_regression.test.sql.

select ok(
  (select public.has_passport_relationship('c0000001-0000-0000-0000-000000000001', 'c6666661-1111-1111-1111-000000000001')),
  'has_passport_relationship() LOGIC: returns true for the institution WITH a shortlist (elevated context — see 005 for the authenticated-role access-control assertion)'
);

select ok(
  not (select public.has_passport_relationship('c0000002-0000-0000-0000-000000000002', 'c6666661-1111-1111-1111-000000000001')),
  'has_passport_relationship() LOGIC: returns false for the institution WITHOUT any relationship (same elevated-context caveat)'
);

-- --------------------------------------------------------------------
-- GROUP 2: RLS-layer bypass closed — verifications/activity/trust_score_history
-- --------------------------------------------------------------------

select test_helpers.act_as('c4444444-4444-4444-4444-444444444444'); -- unauthorized institution, published passport

select is_empty(
  $$ select 1 from public.verifications where passport_id = 'c6666661-1111-1111-1111-000000000001' $$,
  'Institution with NO relationship cannot read verifications directly, even though the passport is published (RLS policy removed in migration 015)'
);

select is_empty(
  $$ select 1 from public.passport_activity where passport_id = 'c6666661-1111-1111-1111-000000000001' $$,
  'Institution with NO relationship cannot read passport_activity directly, even though the passport is published'
);

select is_empty(
  $$ select 1 from public.trust_score_history where passport_id = 'c6666661-1111-1111-1111-000000000001' $$,
  'Institution with NO relationship cannot read trust_score_history directly, even though the passport is published'
);

select test_helpers.act_as('c3333333-3333-3333-3333-333333333333'); -- authorized institution

select is_empty(
  $$ select 1 from public.verifications where passport_id = 'c6666661-1111-1111-1111-000000000001' $$,
  'Even an AUTHORIZED institution cannot read raw verifications rows directly — only the minimized boolean summary via get_passport_detail()'
);

-- --------------------------------------------------------------------
-- GROUP 3: get_passport_detail() includes verification_summary
-- --------------------------------------------------------------------

select is(
  (select public.get_passport_detail('c6666661-1111-1111-1111-000000000001')->'verification_summary'->>'cipc'),
  'true',
  'Authorized institution sees verification_summary.cipc = true via get_passport_detail() (minimized signal, not the raw row)'
);

select test_helpers.act_as('c4444444-4444-4444-4444-444444444444'); -- unauthorized institution

select is(
  (select public.get_passport_detail('c6666661-1111-1111-1111-000000000001')->>'access_tier'),
  'discovery',
  'Unauthorized institution still gets discovery-tier access via get_passport_detail() (published passport), consistent with the RLS-layer denial on raw tables above'
);

-- --------------------------------------------------------------------
-- GROUP 4: check_rate_limit() no longer callable by authenticated
-- --------------------------------------------------------------------

select test_helpers.act_as('c1111111-1111-1111-1111-111111111111');

select throws_ok(
  $$ select public.check_rate_limit('arbitrary-key', 1000000, 1) $$,
  null, null,
  'An authenticated client cannot call check_rate_limit() directly anymore (migration 016) — was previously reachable, letting a client write arbitrary rows into rate_limits with a made-up key'
);

-- --------------------------------------------------------------------
-- GROUP 5 (formerly Group 6): has_my_passport_relationship() — the safe
-- wrapper — actually callable by a real authenticated institution
-- session, unlike has_passport_relationship() itself. Runs BEFORE the
-- admin-promotion group below, since that mutates institution A's
-- fixture (c3333333) and this group needs it to still be a genuine
-- institution user.
-- --------------------------------------------------------------------

select test_helpers.act_as('c3333333-3333-3333-3333-333333333333'); -- institution A, authorized (has a shortlist)

select ok(
  (select public.has_my_passport_relationship('c6666661-1111-1111-1111-000000000001')),
  'has_my_passport_relationship() returns true for institution A (real authenticated session, self-scoped to their own institution) — this is what verify-business-passport actually relies on in production'
);

select test_helpers.act_as('c4444444-4444-4444-4444-444444444444'); -- institution B, unauthorized (no relationship)

select ok(
  not (select public.has_my_passport_relationship('c6666661-1111-1111-1111-000000000001')),
  'has_my_passport_relationship() returns false for institution B (real authenticated session, no relationship) — confirms the safe wrapper correctly denies in a genuine authenticated context, not just in the elevated test-runner context Group 1 used'
);

-- --------------------------------------------------------------------
-- GROUP 6 (formerly Group 5): institution membership consistency trigger
-- Runs LAST because it mutates c3333333's role — nothing after this
-- point in the file may assume c3333333 is still an institution user.
-- --------------------------------------------------------------------

select test_helpers.act_as('c5555555-5555-5555-5555-555555555555'); -- admin

select lives_ok(
  $$ select public.admin_promote_user('c3333333-3333-3333-3333-333333333333') $$,
  'Admin promotes an institution user (who has institution_id set) to admin'
);

select is(
  (select institution_id from public.profiles where id = 'c3333333-3333-3333-3333-333333333333'),
  null,
  'institution_id was automatically cleared by the consistency trigger when role changed away from institution — no inconsistent (role=admin, institution_id=set) state exists'
);

select * from finish();
rollback;
