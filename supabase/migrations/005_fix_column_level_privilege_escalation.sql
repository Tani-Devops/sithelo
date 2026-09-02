-- ====================================================================
-- SECURITY FIX: institution_id tenant-isolation gap +
--               Business Passport self-verification gap
-- ====================================================================
-- Both bugs share a root cause: the previous RLS policies checked WHO
-- owns a row (owner_id = auth.uid()) but placed no constraint on WHICH
-- COLUMNS that owner could write. RLS in Postgres is row-level by
-- design — it was never going to solve this on its own. The real fix is
-- Postgres's column-level GRANT/REVOKE privileges, which reject a write
-- to a specific column regardless of which row-level policy passes.

-- --------------------------------------------------------------------
-- PART A: profiles.institution_id immutability
-- --------------------------------------------------------------------
-- Bug: "profiles: update own non-privileged fields" (migration 004)
-- locked `role` but never touched `institution_id`. An institution user
-- could UPDATE their own profile row and set institution_id to any
-- other institution's id, instantly gaining tenant access they were
-- never granted — every downstream policy that trusts
-- current_institution_id() (opportunities, shortlists, applications
-- review) would then treat them as a legitimate member of that
-- institution.

drop policy if exists "profiles: update own non-privileged fields" on public.profiles;

create policy "profiles: update own non-privileged fields" on public.profiles
  for update using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select role from public.profiles where id = auth.uid())
    and institution_id is not distinct from (select institution_id from public.profiles where id = auth.uid())
  );

-- Column-level belt-and-braces, same reasoning as the profiles INSERT
-- revoke in migration 004: even if a future policy regression reopens
-- this, Postgres rejects the write at the grant layer before RLS is
-- ever evaluated.
revoke update (institution_id, role) on public.profiles from authenticated;

-- Secure path for legitimate institution membership changes: a
-- SECURITY DEFINER function that only admins can execute. This is the
-- ONLY way institution_id may change after profile creation. Wire this
-- to an admin UI action, not a public endpoint.
create or replace function public.admin_set_institution_membership(
  target_user_id uuid,
  new_institution_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins may change institution membership';
  end if;

  update public.profiles
  set institution_id = new_institution_id
  where id = target_user_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, changes)
  values (
    auth.uid(), 'institution_membership.changed', 'profile', target_user_id,
    jsonb_build_object('new_institution_id', new_institution_id)
  );
end;
$$;

comment on function public.admin_set_institution_membership is
  'The only sanctioned path to change a user''s institution_id after signup. Admin-only, audited. Institution self-service member management, if built later, must call this rather than updating profiles directly.';

-- --------------------------------------------------------------------
-- PART B: Business Passport self-verification gap
-- --------------------------------------------------------------------
-- Bug: "passports: owner full access" was `for all ... using (owner_id
-- = auth.uid())` — that grants UPDATE on the ENTIRE row, including
-- trust_score, overall_verification_status, is_published,
-- business_health_score, readiness_score, and profile_completeness. A
-- malicious entrepreneur could set overall_verification_status =
-- 'verified' and is_published = true directly through the Supabase
-- client SDK, self-verifying with no admin ever involved.
--
-- Fix: split "for all" into per-operation policies, and use column-level
-- REVOKE/GRANT so Postgres rejects any UPDATE statement that touches a
-- Zenzele-controlled column, independent of which row-level policy
-- would otherwise pass. Row ownership stops being the only gate.

drop policy if exists "passports: owner full access" on public.business_passports;

create policy "passports: owner select own" on public.business_passports
  for select using (owner_id = auth.uid());
create policy "passports: owner insert own" on public.business_passports
  for insert with check (owner_id = auth.uid());
create policy "passports: owner update own" on public.business_passports
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "passports: owner delete own" on public.business_passports
  for delete using (owner_id = auth.uid());

-- Zenzele-controlled: only calculate-trust-score / admin-verification
-- (service role) may ever write these. Entrepreneurs keep SELECT (they
-- need to see their own trust score) but lose UPDATE entirely.
revoke update (
  trust_score,
  business_health_score,
  readiness_score,
  profile_completeness,
  overall_verification_status,
  is_published,
  owner_id,
  passport_code
) on public.business_passports from authenticated;

comment on table public.business_passports is
  'Trust/verification/publication columns (trust_score, business_health_score, readiness_score, profile_completeness, overall_verification_status, is_published, owner_id, passport_code) are protected by column-level REVOKE from authenticated — see migration 005. Only the service role (edge functions) may write them. All other columns remain owner-editable.';

-- --------------------------------------------------------------------
-- PART C: same bug class, applied to documents.status
-- --------------------------------------------------------------------
-- "documents: owner manage" is `for all` — an entrepreneur uploading a
-- document could set status = 'valid' themselves instead of the honest
-- default of 'pending_review', bypassing admin document review
-- entirely. Same fix: column-level revoke, DEFAULT handles the insert
-- case so entrepreneurs never need write access to this column at all.

alter table public.documents alter column status set default 'pending_review';
revoke update (status), insert (status) on public.documents from authenticated;

comment on column public.documents.status is
  'Admin-controlled only (see migration 005). Entrepreneurs upload documents which always start pending_review regardless of what they send; only admin-verification (service role) may change status.';
