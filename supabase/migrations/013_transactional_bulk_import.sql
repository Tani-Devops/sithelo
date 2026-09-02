-- ====================================================================
-- Transactional per-row import for bulk-import
-- ====================================================================
-- Full-batch atomicity (all 2000 rows succeed or none do) is not
-- achievable here — auth.admin.inviteUserByEmail() is a call to the
-- GoTrue Auth service, not a plain SQL statement, so it can't be wrapped
-- in the same Postgres transaction as the profile/passport/activity
-- inserts that follow it. Claiming otherwise would be dishonest about
-- what this architecture can actually guarantee.
--
-- What IS achievable, and what actually matters for "don't leave an
-- unknown partially imported state": once a row's auth user exists, the
-- three dependent writes (profile update, business_passports insert,
-- passport_activity insert) happen in ONE transaction via this function,
-- not three sequential JS-client calls. If any of the three fails, all
-- three roll back — there is no possible state where a passport exists
-- without its activity log entry, or a profile got updated but no
-- passport was created for it. Combined with bulk-import validating the
-- entire file's structural correctness BEFORE inviting anyone (see the
-- edge function), the only genuinely unavoidable partial-state case left
-- is "auth user got created via invite, but the business record creation
-- then failed" — which surfaces as a clean per-row error in the import
-- summary, not a silent inconsistency, and the invited user simply never
-- completes onboarding (no orphaned business data, just an unused
-- invite).

create or replace function public.create_imported_business(
  p_owner_id uuid,
  p_full_name text,
  p_cell_number text,
  p_business_name text,
  p_registration_number text,
  p_business_type public.business_type,
  p_industry text,
  p_province public.sa_province,
  p_municipality text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_passport_id uuid;
begin
  update public.profiles
  set full_name = p_full_name, cell_number = p_cell_number
  where id = p_owner_id;

  insert into public.business_passports (
    owner_id, business_name, registration_number, business_type,
    industry, province, municipality, overall_verification_status
  ) values (
    p_owner_id, p_business_name, p_registration_number, p_business_type,
    p_industry, p_province, p_municipality, 'pending'
  )
  returning id into v_passport_id;

  insert into public.passport_activity (passport_id, activity_type, description)
  values (v_passport_id, 'verification_updated', 'Imported via bulk-import, queued for review');

  return v_passport_id;
end;
$$;

comment on function public.create_imported_business is
  'Atomic per-row write for bulk-import: profile update + passport insert + activity log entry succeed or fail together. Called only after auth.admin.inviteUserByEmail() has already created the auth user for this row — see bulk-import/index.ts and the honesty note in this migration about what atomicity guarantee is and is not achievable here.';

-- This function is intended to be called only by bulk-import (service
-- role) — not granted to authenticated. An ordinary user calling this
-- directly could create passports for arbitrary owner_ids, since the
-- function doesn't (and can't, from inside a transaction with no request
-- context beyond its arguments) verify that p_owner_id is a legitimate
-- newly-invited user rather than an existing one being hijacked.
revoke all on function public.create_imported_business from public, authenticated;
grant execute on function public.create_imported_business to service_role;
