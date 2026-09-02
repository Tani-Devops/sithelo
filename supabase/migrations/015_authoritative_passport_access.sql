-- ====================================================================
-- Single authorization primitive + closing the graduated-access bypass
-- ====================================================================
-- Found by direct inspection (not assumed from the directive): the same
-- "does this institution have a shortlist or application relationship
-- with this passport" check was duplicated three times — inline in
-- get_passport_detail() (011), inline in list_passport_documents() (012),
-- and inline again in the Next.js signed-url route. Three copies of the
-- same security-critical logic is exactly how they drift apart over
-- time. This migration extracts it to one function; the two existing
-- functions are updated to call it; the Next.js route is updated
-- separately (see route.ts) to call it via RPC instead of running its
-- own inline queries.
--
-- Also found by direct inspection: "verifications: institution read on
-- published", "activity: institution read on published", and
-- "trust_history: institution read on published" (all from migration
-- 002) grant institution SELECT access based on `is_published = true`
-- alone — the exact same bypass pattern that made the Passport page's
-- direct queries a problem, just at the RLS layer instead of the
-- application layer. An institution with zero relationship to a
-- business could already read its full verification history (including
-- verifier identity, internal notes), its complete activity log, and
-- its full trust score trend, just because the business published its
-- passport. This closes that.

-- --------------------------------------------------------------------
-- PART A: the single authorization primitive
-- --------------------------------------------------------------------

create or replace function public.has_passport_relationship(
  p_institution_id uuid,
  p_passport_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.shortlists
    where institution_id = p_institution_id and passport_id = p_passport_id
  ) or exists (
    select 1 from public.applications a
    join public.opportunities o on o.id = a.opportunity_id
    where o.institution_id = p_institution_id and a.passport_id = p_passport_id
  );
$$;

comment on function public.has_passport_relationship is
  'THE single authorization primitive for "does this institution have a legitimate relationship with this business" — used by get_passport_detail(), list_passport_documents(), verify-business-passport, and the document signed-url route. Do not duplicate this check inline anywhere else; call this function instead, so the definition of "authorized institution" can never drift between call sites.';

revoke all on function public.has_passport_relationship from public;
grant execute on function public.has_passport_relationship(uuid, uuid) to authenticated, service_role;

-- --------------------------------------------------------------------
-- PART B: rewrite get_passport_detail() to use the shared primitive,
-- and add a minimal verification summary to tier 2 (booleans only —
-- "is CIPC verified", not the raw verifications row with reviewer
-- identity/notes/reference numbers).
-- --------------------------------------------------------------------

create or replace function public.get_passport_detail(p_passport_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role public.user_role;
  v_caller_institution_id uuid;
  v_passport record;
  v_is_owner boolean;
  v_is_admin boolean;
  v_is_authorized_institution boolean := false;
  v_result jsonb;
  v_verification_summary jsonb;
begin
  select role, institution_id into v_caller_role, v_caller_institution_id
  from public.profiles where id = auth.uid();

  select * into v_passport from public.business_passports where id = p_passport_id;
  if not found then
    raise exception 'Passport not found';
  end if;

  v_is_owner := v_passport.owner_id = auth.uid();
  v_is_admin := v_caller_role = 'admin';

  if v_caller_role = 'institution' and v_caller_institution_id is not null and v_passport.is_published then
    v_is_authorized_institution := public.has_passport_relationship(v_caller_institution_id, p_passport_id);
  end if;

  if not v_is_owner and not v_is_admin and not v_is_authorized_institution and not v_passport.is_published then
    raise exception 'Not authorized to view this passport';
  end if;
  if not v_is_owner and not v_is_admin and not v_is_authorized_institution and v_caller_role not in ('institution', 'admin') then
    raise exception 'Not authorized to view this passport';
  end if;

  -- Minimal verification summary (boolean per type — no reviewer
  -- identity, notes, or reference numbers) — available at tier 1
  -- already, since "is this business CIPC-verified" is exactly the kind
  -- of discovery-appropriate signal institutions need without seeing
  -- who reviewed it or what internal notes exist.
  select coalesce(jsonb_object_agg(verification_type, status = 'verified'), '{}'::jsonb)
  into v_verification_summary
  from public.verifications where passport_id = p_passport_id;

  v_result := jsonb_build_object(
    'id', v_passport.id,
    'passport_code', v_passport.passport_code,
    'business_name', v_passport.business_name,
    'business_type', v_passport.business_type,
    'established_year', v_passport.established_year,
    'industry', v_passport.industry,
    'sub_industry', v_passport.sub_industry,
    'province', v_passport.province,
    'municipality', v_passport.municipality,
    'business_description', v_passport.business_description,
    'core_services', v_passport.core_services,
    'equipment_owned', v_passport.equipment_owned,
    'capacity_range', v_passport.capacity_range,
    'employees_count', v_passport.employees_count,
    'years_trading', v_passport.years_trading,
    'website', v_passport.website,
    'logo_url', v_passport.logo_url,
    'cover_image_url', v_passport.cover_image_url,
    'trust_score', v_passport.trust_score,
    'overall_verification_status', v_passport.overall_verification_status,
    'bbbee_level', v_passport.bbbee_level,
    'is_published', v_passport.is_published,
    'verification_summary', v_verification_summary,
    'access_tier', case when v_is_owner or v_is_admin then 'owner_admin' when v_is_authorized_institution then 'authorized_institution' else 'discovery' end
  );

  if v_is_owner or v_is_admin or v_is_authorized_institution then
    v_result := v_result || jsonb_build_object(
      'business_email', v_passport.business_email,
      'business_phone', v_passport.business_phone,
      'head_office_address', v_passport.head_office_address,
      'key_clients', v_passport.key_clients,
      'annual_turnover', v_passport.annual_turnover
    );
  end if;

  if v_is_owner or v_is_admin then
    v_result := v_result || jsonb_build_object(
      'business_health_score', v_passport.business_health_score,
      'readiness_score', v_passport.readiness_score,
      'profile_completeness', v_passport.profile_completeness,
      'bbbee_expiry', v_passport.bbbee_expiry,
      'owner_id', v_passport.owner_id
    );
  end if;

  if not v_is_owner then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (
      auth.uid(), 'passport.detail_accessed', 'business_passport', p_passport_id,
      jsonb_build_object('access_tier', v_result->>'access_tier', 'institution_id', v_caller_institution_id)
    );
  end if;

  return v_result;
end;
$$;

revoke all on function public.get_passport_detail from public;
grant execute on function public.get_passport_detail(uuid) to authenticated;

-- --------------------------------------------------------------------
-- PART C: rewrite list_passport_documents() to use the shared primitive
-- --------------------------------------------------------------------

create or replace function public.list_passport_documents(p_passport_id uuid)
returns table (
  id uuid,
  document_type text,
  file_name text,
  status public.document_status,
  issued_date date,
  expiry_date date,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role public.user_role;
  v_caller_institution_id uuid;
  v_owner_id uuid;
  v_is_published boolean;
  v_is_authorized_institution boolean := false;
begin
  select role, institution_id into v_caller_role, v_caller_institution_id
  from public.profiles where id = auth.uid();

  select owner_id, is_published into v_owner_id, v_is_published
  from public.business_passports where business_passports.id = p_passport_id;

  if v_owner_id is null then
    raise exception 'Passport not found';
  end if;

  if v_caller_role = 'institution' and v_caller_institution_id is not null and v_is_published then
    v_is_authorized_institution := public.has_passport_relationship(v_caller_institution_id, p_passport_id);
  end if;

  if v_owner_id <> auth.uid() and v_caller_role <> 'admin' and not v_is_authorized_institution then
    raise exception 'Not authorized to view this passport''s documents';
  end if;

  return query
    select d.id, d.document_type, d.file_name, d.status, d.issued_date, d.expiry_date, d.created_at
    from public.documents d
    where d.passport_id = p_passport_id
    order by d.created_at desc;
end;
$$;

revoke all on function public.list_passport_documents from public;
grant execute on function public.list_passport_documents(uuid) to authenticated;

-- --------------------------------------------------------------------
-- PART D: close the RLS-layer version of the same bypass
-- --------------------------------------------------------------------

drop policy if exists "verifications: institution read on published" on public.verifications;
drop policy if exists "activity: institution read on published" on public.passport_activity;
drop policy if exists "trust_history: institution read on published" on public.trust_score_history;

comment on table public.verifications is
  'No institution SELECT policy exists on this table (migration 015) — institutions get a minimized boolean-only verification_summary via get_passport_detail(), never raw rows (which include reviewer identity, notes, reference numbers). Owner and admin retain full access.';
comment on table public.passport_activity is
  'No institution SELECT policy exists on this table (migration 015) — the activity log was never actually needed by institutions in the product as built (no UI surface consumes it for institutions), and it can contain admin/internal-review events not appropriate for cross-tenant visibility. Owner and admin retain full access. If institutions genuinely need an activity feed later, build a minimized function like get_passport_detail(), not a blanket RLS grant.';
comment on table public.trust_score_history is
  'No institution SELECT policy exists on this table (migration 015) — institutions get the current trust_score (a single number) via get_passport_detail() tier 1; the full historical trend is owner/admin only, since a score''s trajectory can reveal more about a business''s internal trouble/recovery pattern than the single current number does. Owner and admin retain full access.';
