-- ====================================================================
-- Migration 037: application-based access to unpublished passports,
-- and an admin review path for renewal documents
-- ====================================================================

-- --------------------------------------------------------------------
-- PART A — an application shares the passport with that institution
-- --------------------------------------------------------------------
-- Until now has_passport_relationship() was only consulted for
-- PUBLISHED passports. An entrepreneur can apply before their passport
-- is published (035 publishes only after a verification), which left
-- the receiving institution with an applicant it could not open.
--
-- Applying is an explicit choice by the owner to share their passport
-- with that institution, so the relationship now grants access
-- regardless of publication. Nothing else changes:
--   - shortlists still require a published passport at insert (018), so
--     an institution cannot manufacture a relationship to an
--     unpublished business — only the owner's application creates one;
--   - unrelated institutions still get nothing for unpublished passports;
--   - the tier contents (what each tier sees) are unchanged.
-- Function bodies are 019's get_passport_detail() and 024's
-- list_passport_documents() with only the publication condition on the
-- relationship check removed.

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

  if v_caller_role is null then
    raise exception 'Not authorized to view this passport';
  end if;

  select * into v_passport from public.business_passports where id = p_passport_id;
  if not found then
    raise exception 'Passport not found';
  end if;

  v_is_owner := v_passport.owner_id = auth.uid();
  v_is_admin := v_caller_role = 'admin';

  -- 037: no longer conditional on is_published (see PART A above).
  if v_caller_role = 'institution' and v_caller_institution_id is not null then
    v_is_authorized_institution := public.has_passport_relationship(v_caller_institution_id, p_passport_id);
  end if;

  if not v_is_owner and not v_is_admin and not v_is_authorized_institution and not v_passport.is_published then
    raise exception 'Not authorized to view this passport';
  end if;
  if not v_is_owner and not v_is_admin and not v_is_authorized_institution and v_caller_role not in ('institution', 'admin') then
    raise exception 'Not authorized to view this passport';
  end if;

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
  v_is_authorized_institution boolean := false;
begin
  select role, institution_id into v_caller_role, v_caller_institution_id
  from public.profiles where profiles.id = auth.uid();

  if v_caller_role is null then
    raise exception 'Not authorized to view this passport''s documents';
  end if;

  select owner_id into v_owner_id
  from public.business_passports where business_passports.id = p_passport_id;

  if v_owner_id is null then
    raise exception 'Passport not found';
  end if;

  -- 037: no longer conditional on is_published (see PART A above).
  if v_caller_role = 'institution' and v_caller_institution_id is not null then
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
-- PART B — renewal documents
-- --------------------------------------------------------------------
-- A document uploaded while its verification is still 'verified' is a
-- renewal. 035 deliberately leaves the verification verified (the
-- business must not drop back to pending), so the document sits in
-- 'pending_review' and needs its own admin decision:
--   accept -> document valid; verification keeps 'verified' and takes
--             the new document's issued/expiry dates
--   reject -> document 'rejected'; verification untouched; owner notified

create or replace function public.admin_accept_document_renewal(p_document_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc record;
  v_type text;
begin
  if not public.is_admin() then
    raise exception 'not_authorized';
  end if;

  select * into v_doc from public.documents where id = p_document_id for update;
  if not found then
    raise exception 'document_not_found';
  end if;
  if v_doc.status <> 'pending_review' then
    raise exception 'document_already_reviewed';
  end if;

  v_type := public.verification_type_for_document(v_doc.document_type);
  if v_type is null then
    raise exception 'document_type_not_verifiable';
  end if;

  update public.verifications
    set issued_date = coalesce(v_doc.issued_date, issued_date),
        expiry_date = coalesce(v_doc.expiry_date, expiry_date)
    where passport_id = v_doc.passport_id
      and verification_type = v_type
      and status = 'verified';
  if not found then
    raise exception 'verification_not_verified';
  end if;

  update public.documents set status = 'valid' where id = p_document_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'document.renewal_accepted', 'document', p_document_id,
          jsonb_build_object('passport_id', v_doc.passport_id, 'verification_type', v_type));

  return v_doc.passport_id;
end;
$$;

create or replace function public.admin_reject_document(p_document_id uuid, p_notes text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc record;
  v_owner_id uuid;
begin
  if not public.is_admin() then
    raise exception 'not_authorized';
  end if;

  select * into v_doc from public.documents where id = p_document_id for update;
  if not found then
    raise exception 'document_not_found';
  end if;
  if v_doc.status <> 'pending_review' then
    raise exception 'document_already_reviewed';
  end if;

  update public.documents set status = 'rejected' where id = p_document_id;

  select owner_id into v_owner_id from public.business_passports where id = v_doc.passport_id;

  insert into public.notifications (recipient_id, category, title, body, metadata)
  values (
    v_owner_id,
    'verification',
    'A document needs attention',
    trim(format('Your document "%s" could not be accepted. %s', v_doc.file_name, coalesce(left(p_notes, 1000), ''))),
    jsonb_build_object('passport_id', v_doc.passport_id, 'document_id', p_document_id)
  );

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, changes)
  values (auth.uid(), 'document.rejected', 'document', p_document_id,
          jsonb_build_object('notes', left(p_notes, 1000)));

  return v_doc.passport_id;
end;
$$;

revoke all on function public.admin_accept_document_renewal(uuid) from public;
revoke all on function public.admin_reject_document(uuid, text) from public;
grant execute on function public.admin_accept_document_renewal(uuid) to authenticated;
grant execute on function public.admin_reject_document(uuid, text) to authenticated;

-- --------------------------------------------------------------------
-- PART C — expiry re-opens a verification that has a renewal waiting
-- --------------------------------------------------------------------
-- If a renewal document is still waiting when the verification expires,
-- move the verification back to 'pending' so it lands in the normal
-- queue instead of sitting expired next to a document nobody reviewed.
-- Otherwise identical to 035's version.
create or replace function public.apply_verification_outcome()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'verified' then
    update public.documents d
      set status = 'valid'
      where d.passport_id = new.passport_id
        and d.status = 'pending_review'
        and public.verification_type_for_document(d.document_type) = new.verification_type;

    update public.business_passports
      set updated_at = now()
      where id = new.passport_id
        and coalesce(is_published, false) = false;
  elsif new.status = 'expired' then
    update public.documents d
      set status = 'expired'
      where d.passport_id = new.passport_id
        and d.status = 'valid'
        and public.verification_type_for_document(d.document_type) = new.verification_type;

    if exists (
      select 1 from public.documents d
      where d.passport_id = new.passport_id
        and d.status = 'pending_review'
        and public.verification_type_for_document(d.document_type) = new.verification_type
    ) then
      -- Re-fires this trigger with status 'pending', which matches no branch.
      update public.verifications
        set status = 'pending', verified_by = null, verified_at = null
        where id = new.id;
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.apply_verification_outcome() from public;
