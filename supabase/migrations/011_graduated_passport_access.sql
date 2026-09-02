-- ====================================================================
-- Business Passport graduated access
-- ====================================================================
-- Resolves the open question left in DATA_CLASSIFICATION.md. Three
-- tiers, decided explicitly rather than left binary:
--
-- TIER 1 (discovery) — any authenticated institution/admin, published
--   passports only. Exactly institution_business_directory (007).
--
-- TIER 2 (authorized institution) — an institution that has a REAL
--   relationship with the business: an active shortlist entry, or an
--   application to one of that institution's opportunities. Same
--   relationship test already used to gate document access
--   (signed-url route) — deliberately reused, not reinvented, so
--   "authorized institution" means the same thing everywhere in the
--   product. Adds: business_email, business_phone, head_office_address,
--   key_clients, capacity_range detail, annual_turnover.
--
-- TIER 3 (owner/admin) — the full row, including internal scoring
--   fields, exactly as business_passports RLS already allows.
--
-- Implementation: a SECURITY DEFINER function rather than a second view,
-- because the column set genuinely depends on a per-caller relationship
-- check (does THIS institution have a shortlist/application for THIS
-- passport), which a plain view's row-level RLS can express but its
-- fixed column list cannot conditionally narrow.

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
    select exists (
      select 1 from public.shortlists where institution_id = v_caller_institution_id and passport_id = p_passport_id
    ) or exists (
      select 1 from public.applications a
      join public.opportunities o on o.id = a.opportunity_id
      where o.institution_id = v_caller_institution_id and a.passport_id = p_passport_id
    ) into v_is_authorized_institution;
  end if;

  if not v_is_owner and not v_is_admin and not v_is_authorized_institution and not v_passport.is_published then
    raise exception 'Not authorized to view this passport';
  end if;
  if not v_is_owner and not v_is_admin and not v_is_authorized_institution and v_caller_role not in ('institution', 'admin') then
    raise exception 'Not authorized to view this passport';
  end if;

  -- TIER 1 fields — always included once we've passed the check above.
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
    'access_tier', case when v_is_owner or v_is_admin then 'owner_admin' when v_is_authorized_institution then 'authorized_institution' else 'discovery' end
  );

  -- TIER 2 fields — authorized institution relationship, or owner/admin.
  if v_is_owner or v_is_admin or v_is_authorized_institution then
    v_result := v_result || jsonb_build_object(
      'business_email', v_passport.business_email,
      'business_phone', v_passport.business_phone,
      'head_office_address', v_passport.head_office_address,
      'key_clients', v_passport.key_clients,
      'annual_turnover', v_passport.annual_turnover
    );
  end if;

  -- TIER 3 fields — owner/admin only. Internal scoring detail beyond the
  -- single trust_score number already in tier 1.
  if v_is_owner or v_is_admin then
    v_result := v_result || jsonb_build_object(
      'business_health_score', v_passport.business_health_score,
      'readiness_score', v_passport.readiness_score,
      'profile_completeness', v_passport.profile_completeness,
      'bbbee_expiry', v_passport.bbbee_expiry,
      'owner_id', v_passport.owner_id
    );
  end if;

  -- Every access is auditable, same as document access — this function
  -- is the single chokepoint for passport detail reads, so logging here
  -- covers institution/admin views uniformly. Owner viewing their own
  -- passport isn't logged (that's just using the product, not access to
  -- someone else's data) — only third-party access is.
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

comment on function public.get_passport_detail is
  'The sanctioned way to read a single Business Passport''s detail with graduated field exposure. Institutions/admins should call this, not query business_passports or institution_business_directory directly for a single-record detail view. See DATA_CLASSIFICATION.md.';

grant execute on function public.get_passport_detail(uuid) to authenticated;
