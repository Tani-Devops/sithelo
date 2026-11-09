-- ====================================================================
-- Migration 032: narrow the institutions read surface
-- ====================================================================
-- Audit finding (HIGH): migration 028 added primary_contact_name,
-- primary_contact_email, primary_contact_phone, reviewed_by, reviewed_at
-- and rejection_reason to institutions, but the SELECT surface remained
-- the 002-era broad policy ("institutions: read all authenticated") with
-- full table-level column grants. Registration is open, so any
-- authenticated account — including throwaway signups — could enumerate
-- every institution's staff contact details, which admin reviewed them
-- (admin profile UUIDs), and why an institution was rejected.
--
-- Fix, same pattern as 021: revoke table-level SELECT from
-- authenticated, grant back only the non-PII columns. The sensitive
-- columns become readable exclusively through the SECURITY DEFINER
-- functions below, gated on is_admin() or row ownership.
--
-- Admins share the `authenticated` role, so the column grant also covers
-- them — which is why the admin approval queue now reads through
-- list_institutions_for_review(), same reasoning as get_passport_detail()
-- (011) being the sanctioned owner/admin read path for passports.
-- ====================================================================

revoke select on public.institutions from authenticated;

grant select (
  id, name, institution_type, logo_url, approval_status, province,
  municipality, website, description, focus_area, created_at
) on public.institutions to authenticated;
-- Deliberately excluded from SELECT: primary_contact_id,
-- primary_contact_name, primary_contact_email, primary_contact_phone,
-- reviewed_by, reviewed_at, rejection_reason — readable only through
-- the functions below.

-- --------------------------------------------------------------------
-- get_institution_detail(institution_id): sanctioned read of a single
-- institution's full record — the caller's own row (including
-- rejection_reason), or any row for admins. Mirrors
-- get_passport_detail()'s tiered pattern (011).
-- --------------------------------------------------------------------
create or replace function public.get_institution_detail(
  p_institution_id uuid
)
returns public.institutions
language sql
stable
security definer
set search_path = public
as $$
  select i.*
  from public.institutions i
  where i.id = p_institution_id
    and (
      public.is_admin()
      or i.id = public.current_institution_id()
    );
$$;

revoke all on function public.get_institution_detail(uuid) from public;
grant execute on function public.get_institution_detail(uuid) to authenticated;

comment on function public.get_institution_detail(uuid) is
  'Sanctioned read of one institution''s full record (primary contact PII, reviewed_by/at, rejection_reason): the caller''s own institution, or any institution for admins. Returns a null row otherwise. Direct table SELECT of the sensitive columns is revoked from authenticated (032).';

-- --------------------------------------------------------------------
-- list_institutions_for_review(): the admin approval-queue read, now
-- that admins (role `authenticated`) can no longer select the PII
-- columns directly.
-- --------------------------------------------------------------------
create or replace function public.list_institutions_for_review()
returns setof public.institutions
language sql
stable
security definer
set search_path = public
as $$
  select i.*
  from public.institutions i
  where public.is_admin()
    and i.approval_status = 'pending'
  order by i.created_at asc;
$$;

revoke all on function public.list_institutions_for_review() from public;
grant execute on function public.list_institutions_for_review() to authenticated;

comment on function public.list_institutions_for_review() is
  'Admin-only approval-queue read (032): returns full pending-institution rows (incl. primary contact PII) for the approval queue. Required because admins share the authenticated role whose direct column grants now exclude the PII columns.';
