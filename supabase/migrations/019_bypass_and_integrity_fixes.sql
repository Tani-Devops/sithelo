-- ====================================================================
-- Part 1 (direct-read bypass), Part 4 (storage), Part 5 (fail-closed),
-- Part 9 (actor integrity) — four confirmed findings, fixed
-- ====================================================================
-- Every finding below was confirmed against the actual current
-- policy/function SQL before writing a fix, per this pass's explicit
-- instruction not to trust prior claims (including my own).

-- --------------------------------------------------------------------
-- PART 4: institution-logos storage — role check missing entirely
-- --------------------------------------------------------------------
-- Confirmed: "logos: institution write" only checked that the upload
-- path's folder matched auth.uid() — nothing checked the uploader's
-- profile.role. Any entrepreneur could upload to
-- institution-logos/<their-own-uid>/anything.png, since the ONLY gate
-- was "is this your own folder," which is true for everyone regardless
-- of role. Fixed by joining profiles and requiring role = 'institution'.
-- passport-documents and passport-images intentionally have NO role
-- check (any entrepreneur legitimately owns their own uploads there) —
-- confirmed by reviewing the whole storage policy file, not just the
-- one bucket the directive named, per Part 4's explicit instruction.

drop policy if exists "logos: institution write" on storage.objects;

create policy "logos: institution write" on storage.objects
  for insert with check (
    bucket_id = 'institution-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'institution')
  );

-- UPDATE/DELETE reviewed for every bucket (Part 4 explicit ask): no
-- bucket currently grants owner UPDATE/DELETE at all — the consistent
-- existing pattern across passport-documents, passport-images, and
-- institution-logos alike is "upload a new object at a new path" rather
-- than mutate/replace in place. That's restrictive-by-omission, not a
-- vulnerability (nothing is over-exposed), so left unchanged rather than
-- expanding capability that wasn't asked for. Flagged as a known product
-- decision in SECURITY_AUDIT_MASTER.md, not silently resolved either way.

-- --------------------------------------------------------------------
-- PART 5: fail-closed authorization when the caller has no profile row
-- --------------------------------------------------------------------
-- Confirmed by tracing the actual three-valued SQL logic, not assumed:
-- get_passport_detail() and list_passport_documents() both do
-- `select role into v_caller_role from profiles where id = auth.uid()`
-- with no existence check. If no profile row exists, v_caller_role is
-- NULL. Every subsequent comparison against it (`v_caller_role =
-- 'admin'`, `v_caller_role <> 'admin'`, `v_caller_role not in (...)`)
-- evaluates to NULL, not FALSE, under SQL's three-valued logic — and the
-- authorization-critical IF statements that gate the exception-raise
-- become NULL-valued conjunctions whose behavior depends on exactly
-- which other operands happen to be FALSE. Relying on that for a
-- security boundary is fragile by construction, independent of whatever
-- the actual current behavior resolves to. Fixed by adding an explicit,
-- unambiguous early check.

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

  -- Explicit fail-closed check — no ambiguous NULL-propagation left to
  -- interpret. A caller with no profile row (or, in principle, no
  -- auth.uid() at all) is denied outright, before any tier logic runs.
  if v_caller_role is null then
    raise exception 'Not authorized to view this passport';
  end if;

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
  v_is_published boolean;
  v_is_authorized_institution boolean := false;
begin
  select role, institution_id into v_caller_role, v_caller_institution_id
  from public.profiles where id = auth.uid();

  if v_caller_role is null then
    raise exception 'Not authorized to view this passport''s documents';
  end if;

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

comment on function public.get_passport_detail is
  'Fails closed if the caller has no profile row (migration 019) — does not rely on SQL three-valued-logic NULL propagation through the tier checks to implicitly deny access.';
comment on function public.list_passport_documents is
  'Fails closed if the caller has no profile row (migration 019) — same reasoning as get_passport_detail().';

-- --------------------------------------------------------------------
-- PART 1: passport_activity / trust_score_history direct table reads
-- --------------------------------------------------------------------
-- The Passport page read these two tables directly (gated client-side
-- on access_tier === 'owner_admin', backed by RLS that already restricts
-- both tables to owner/admin). That's not a live vulnerability — RLS
-- independently enforces the same boundary — but it's inconsistent with
-- "get_passport_detail() is the sole authorized read path," and a future
-- RLS regression on either table would be more dangerous with a direct
-- read still in place than with a function that does its own explicit
-- authorization check. Two narrowly-scoped RPCs, not folded into
-- get_passport_detail() itself (which already returns a lot; a single
-- giant function returning everything is its own kind of risk — easier
-- to audit two small single-purpose functions than one that does
-- everything).

create or replace function public.get_passport_activity(p_passport_id uuid)
returns table (
  id uuid,
  activity_type text,
  description text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role public.user_role;
  v_owner_id uuid;
begin
  select role into v_caller_role from public.profiles where id = auth.uid();
  if v_caller_role is null then
    raise exception 'Not authorized to view this passport''s activity';
  end if;

  select owner_id into v_owner_id from public.business_passports where business_passports.id = p_passport_id;
  if v_owner_id is null then
    raise exception 'Passport not found';
  end if;

  -- Owner/admin only — deliberately no institution tier at all, matching
  -- migration 015's decision (institutions never had a legitimate need
  -- for the raw activity log, which can include internal review events).
  if v_owner_id <> auth.uid() and v_caller_role <> 'admin' then
    raise exception 'Not authorized to view this passport''s activity';
  end if;

  return query
    select a.id, a.activity_type, a.description, a.created_at
    from public.passport_activity a
    where a.passport_id = p_passport_id
    order by a.created_at desc
    limit 6;
end;
$$;

revoke all on function public.get_passport_activity from public;
grant execute on function public.get_passport_activity(uuid) to authenticated;

create or replace function public.get_passport_trust_history(p_passport_id uuid)
returns table (
  score int,
  recorded_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role public.user_role;
  v_owner_id uuid;
begin
  select role into v_caller_role from public.profiles where id = auth.uid();
  if v_caller_role is null then
    raise exception 'Not authorized to view this passport''s trust score history';
  end if;

  select owner_id into v_owner_id from public.business_passports where business_passports.id = p_passport_id;
  if v_owner_id is null then
    raise exception 'Passport not found';
  end if;

  if v_owner_id <> auth.uid() and v_caller_role <> 'admin' then
    raise exception 'Not authorized to view this passport''s trust score history';
  end if;

  return query
    select h.score, h.recorded_at
    from public.trust_score_history h
    where h.passport_id = p_passport_id
    order by h.recorded_at asc
    limit 12;
end;
$$;

revoke all on function public.get_passport_trust_history from public;
grant execute on function public.get_passport_trust_history(uuid) to authenticated;

-- --------------------------------------------------------------------
-- --------------------------------------------------------------------
-- PART 9b: correcting a bug in migration 018's opportunity trigger,
-- found while checking whether the SAME auth.uid()-in-service-role-
-- context issue existed elsewhere (it did)
-- --------------------------------------------------------------------
-- create-opportunity (the edge function, the normal path for creating
-- opportunities) uses the service-role client for its INSERT. Migration
-- 018's enforce_opportunity_created_by trigger unconditionally set
-- `new.created_by := auth.uid()` on INSERT — which is NULL in a
-- service-role context with no user JWT session. This would have
-- nulled out created_by on every opportunity created through the
-- primary, normal path — the exact same bug just found and fixed in the
-- verification trigger above. Caught by checking whether the same class
-- of issue existed elsewhere after finding it once, not assumed to be
-- isolated. Same fix: only force auth.uid() when it's actually present.

create or replace function public.enforce_opportunity_created_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and auth.uid() is not null then
    new.created_by := auth.uid();
  elsif tg_op = 'UPDATE' then
    new.created_by := old.created_by; -- immutable after creation, regardless of caller context
  end if;
  return new;
end;
$$;

comment on function public.enforce_opportunity_created_by is
  'Corrected in migration 019: only forces created_by on INSERT when auth.uid() is present (a real user session) — a service-role INSERT (the normal create-opportunity edge function path) keeps whatever created_by the trusted server-side code already set, since that code independently verified the real actor before writing. The original migration 018 version unconditionally overwrote with auth.uid(), which would have nulled created_by on every opportunity created through the primary path. UPDATE remains unconditionally immutable regardless of caller context, since there is no legitimate reason for created_by to ever change after insert, by anyone, including service role.';

-- --------------------------------------------------------------------
-- PART 9: verifications.verified_by / verified_at — admin-to-admin
-- impersonation was possible
-- --------------------------------------------------------------------
-- Confirmed: "verifications: admin manage" is `for all using
-- (is_admin())` with NO WITH CHECK restricting verified_by/verified_at.
-- The admin-verification edge function correctly sets verified_by from
-- the verified caller's own JWT — but nothing stopped a real admin from
-- bypassing that function entirely and directly UPDATE-ing a
-- verification row to credit a DIFFERENT admin's UUID, corrupting the
-- accountability trail (the actor is legitimately an admin; WHO gets
-- recorded as having made the decision is what's forgeable). Same fix
-- pattern as applications.reviewed_by: trigger forces the real actor,
-- column-level revoke as defense in depth.

create or replace function public.set_verification_review_metadata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only override when there's a real authenticated session (auth.uid()
  -- is not null) — i.e. when a real admin is updating this row directly
  -- via their own client session, which is exactly the impersonation
  -- vector this trigger exists to close. When called via the service-
  -- role client (auth.uid() is null — no user JWT session, as is the
  -- case for admin-verification's edge function), auth.uid() would
  -- otherwise NULL OUT the explicitly-provided, already-verified
  -- verified_by/verified_at instead of protecting them — found and
  -- fixed before this migration shipped, not after: admin-verification
  -- already independently verifies the real admin's identity via
  -- requireRole() before ever reaching this write, so a service-role
  -- call's explicit values are already trustworthy and must be left
  -- alone.
  if new.status is distinct from old.status and new.status in ('verified', 'rejected') and auth.uid() is not null then
    new.verified_by := auth.uid();
    new.verified_at := now();
  end if;
  return new;
end;
$$;

revoke execute on function public.set_verification_review_metadata() from public;

drop trigger if exists trg_verifications_review_metadata on public.verifications;
create trigger trg_verifications_review_metadata
  before update on public.verifications
  for each row execute function public.set_verification_review_metadata();

revoke update (verified_by, verified_at) on public.verifications from authenticated;

comment on table public.verifications is
  'verified_by/verified_at: UPDATE revoked from authenticated entirely, forced to the real auth.uid() by trigger on any status change to verified/rejected (migration 019) — a real admin can no longer credit a different admin for their own decision. Same pattern as applications.reviewed_by.';
